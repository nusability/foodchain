/**
 * Song validation.
 *
 * The brief for every biome theme is specific — at least 36 bars, real
 * harmony, at least one key change — so those requirements live here as
 * assertions rather than as good intentions. Every song in the registry is
 * run through this in the test suite.
 */
import { noteToMidi, parseChord } from './theory';
import {
  keyChangeCount,
  noteCount,
  sectionAtBar,
  songLengthBars,
  type SongDef,
} from './song';

export interface SongIssue {
  severity: 'error' | 'warning';
  path: string;
  message: string;
}

export interface SongValidation {
  issues: SongIssue[];
  errors: SongIssue[];
  ok: boolean;
  stats: {
    bars: number;
    notes: number;
    keyChanges: number;
    tracks: number;
    durationSeconds: number;
    distinctChords: number;
    pitchRange: [number, number] | null;
  };
}

export const MIN_BARS = 36;

export function validateSong(song: SongDef): SongValidation {
  const issues: SongIssue[] = [];
  const err = (path: string, message: string) =>
    issues.push({ severity: 'error', path, message });
  const warn = (path: string, message: string) =>
    issues.push({ severity: 'warning', path, message });

  const at = song.id || '<unnamed song>';
  if (!song.id) err(at, 'song.id is required');
  if (!song.title) warn(at, 'song.title is empty');
  if (!(song.bpm > 20 && song.bpm < 300)) err(`${at}.bpm`, `${song.bpm} is not a sane tempo`);
  if (!(song.beatsPerBar >= 2 && song.beatsPerBar <= 13)) {
    err(`${at}.beatsPerBar`, `${song.beatsPerBar} beats per bar is outside the supported range`);
  }
  if (song.swing !== undefined && (song.swing < 0 || song.swing > 0.75)) {
    err(`${at}.swing`, 'swing must be between 0 and 0.75');
  }

  const bars = songLengthBars(song);
  if (bars < MIN_BARS) {
    err(`${at}.length`, `song is ${bars} bars; every biome theme must be at least ${MIN_BARS}`);
  }

  // Sections must tile the song without gaps or overlaps.
  const sorted = [...song.sections].sort((a, b) => a.startBar - b.startBar);
  if (sorted.length === 0) err(`${at}.sections`, 'song has no sections');
  if (sorted[0] && sorted[0].startBar !== 0) {
    err(`${at}.sections`, `first section starts at bar ${sorted[0].startBar}, expected 0`);
  }
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const p = `${at}.sections.${s.name}`;
    if (s.bars <= 0) err(p, 'section length must be > 0');
    try {
      noteToMidi(`${s.key}4`);
    } catch {
      err(p, `"${s.key}" is not a valid key name`);
    }
    const next = sorted[i + 1];
    if (next && s.startBar + s.bars !== next.startBar) {
      err(p, `ends at bar ${s.startBar + s.bars} but "${next.name}" starts at ${next.startBar}`);
    }
    if (s.energy !== undefined && (s.energy < 0 || s.energy > 1)) {
      err(p, 'energy must be between 0 and 1');
    }
  }

  const keyChanges = keyChangeCount(song);
  if (keyChanges < 1) {
    err(`${at}.sections`, 'no key change — every biome theme must modulate at least once');
  }

  // Chords must parse and must cover the song.
  const chordSymbols = new Set<string>();
  for (const [i, c] of song.chords.entries()) {
    const p = `${at}.chords[${i}]`;
    if (c.bar < 0 || c.bar >= bars) err(p, `bar ${c.bar} is outside the song`);
    if (c.beat < 0 || c.beat >= song.beatsPerBar) err(p, `beat ${c.beat} is outside the bar`);
    try {
      parseChord(c.chord);
      chordSymbols.add(c.chord);
    } catch (e) {
      err(p, (e as Error).message);
    }
  }
  if (song.chords.length === 0) err(`${at}.chords`, 'song has no chord track');
  if (chordSymbols.size < 4) {
    warn(`${at}.chords`, `only ${chordSymbols.size} distinct chords — the harmony will feel thin`);
  }
  if (song.chords.length > 0) {
    const firstBar = Math.min(...song.chords.map((c) => c.bar));
    if (firstBar > 0) warn(`${at}.chords`, `harmony does not start until bar ${firstBar}`);
  }

  // Tracks and notes.
  if (song.tracks.length < 3) {
    warn(`${at}.tracks`, `${song.tracks.length} tracks will sound sparse; aim for 5+`);
  }
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  const names = new Set<string>();
  for (const track of song.tracks) {
    const p = `${at}.tracks.${track.name}`;
    if (names.has(track.name)) err(p, 'duplicate track name');
    names.add(track.name);
    if (track.gain < 0 || track.gain > 2) err(`${p}.gain`, 'gain must be between 0 and 2');
    if (track.pan !== undefined && Math.abs(track.pan) > 1) err(`${p}.pan`, 'pan must be -1..1');
    if (track.notes.length === 0) warn(p, 'track has no notes');
    for (const [i, n] of track.notes.entries()) {
      const np = `${p}.notes[${i}]`;
      if (n.bar < 0) err(np, 'bar must be >= 0');
      if (n.beat < 0 || n.beat >= song.beatsPerBar) {
        err(np, `beat ${n.beat} is outside a ${song.beatsPerBar}-beat bar`);
      }
      if (!(n.dur > 0)) err(np, 'dur must be > 0');
      if (n.vel < 0 || n.vel > 1) err(np, 'vel must be 0..1');
      let midi: number;
      try {
        midi = typeof n.pitch === 'number' ? n.pitch : noteToMidi(n.pitch);
      } catch (e) {
        err(np, (e as Error).message);
        continue;
      }
      if (midi < 12 || midi > 108) err(np, `pitch ${n.pitch} is outside the playable range`);
      lo = Math.min(lo, midi);
      hi = Math.max(hi, midi);
    }
  }

  const notes = noteCount(song);
  if (notes < bars * 6) {
    warn(`${at}.tracks`, `${notes} notes across ${bars} bars is sparse for an arcade theme`);
  }

  // Every bar should have *something* playing.
  const busy = new Set<number>();
  for (const track of song.tracks) for (const n of track.notes) busy.add(n.bar);
  const silent: number[] = [];
  for (let b = 0; b < bars; b++) if (!busy.has(b)) silent.push(b);
  if (silent.length > 0) {
    warn(`${at}.tracks`, `silent bars: ${silent.slice(0, 8).join(', ')}${silent.length > 8 ? '…' : ''}`);
  }

  // Notes must fall inside a declared section.
  for (const track of song.tracks) {
    for (const n of track.notes) {
      if (!sectionAtBar(song, n.bar)) {
        err(`${at}.tracks.${track.name}`, `bar ${n.bar} is not covered by any section`);
        break;
      }
    }
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const secondsPerBar = (song.beatsPerBar * 60) / song.bpm;

  return {
    issues,
    errors,
    ok: errors.length === 0,
    stats: {
      bars,
      notes,
      keyChanges,
      tracks: song.tracks.length,
      durationSeconds: bars * secondsPerBar,
      distinctChords: chordSymbols.size,
      pitchRange: Number.isFinite(lo) ? [lo, hi] : null,
    },
  };
}

export function formatSongIssues(v: SongValidation): string {
  if (v.issues.length === 0) return 'song ok';
  return v.issues.map((i) => `${i.severity === 'error' ? 'ERROR' : 'warn '}  ${i.path}: ${i.message}`).join('\n');
}
