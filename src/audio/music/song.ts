/**
 * The song format.
 *
 * A song is data: sections (which carry the key), chord events, and note
 * events per track. Composers write TypeScript that *computes* those arrays
 * using the helpers in pattern.ts, which is how a 36+ bar arrangement stays
 * readable instead of becoming a wall of literals.
 *
 * See docs/MUSIC_AUTHORING.md.
 */
import type { ScaleName } from './theory';

export type InstrumentId =
  // pitched
  | 'supersaw'
  | 'pluck'
  | 'kalimba'
  | 'fmbell'
  | 'marimba'
  | 'subbass'
  | 'reese'
  | 'choirpad'
  | 'organ'
  | 'brass'
  | 'squelch'
  | 'glass'
  | 'banjo'
  | 'vox'
  | 'tuba'
  | 'whistle'
  // percussion (pitch still matters — it tunes the drum)
  | 'kick'
  | 'snare'
  | 'clap'
  | 'hat'
  | 'openhat'
  | 'tom'
  | 'rim'
  | 'shaker'
  | 'crash'
  | 'woodblock'
  | 'cowbell'
  | 'gong';

export interface NoteEvent {
  /** Absolute bar index from the top of the song, 0-based. */
  bar: number;
  /** Beat within the bar, 0-based, fractional allowed. */
  beat: number;
  /** Length in beats. */
  dur: number;
  /** MIDI number or note name ("C4"). */
  pitch: number | string;
  /** 0..1. */
  vel: number;
  /** Optional per-note glide from the previous note, in beats. */
  slide?: number;
}

export interface ChordEvent {
  bar: number;
  beat: number;
  /** Chord symbol, e.g. "Dm9", "Bb7#11", "Amaj7/C#". */
  chord: string;
}

export interface TrackDef {
  name: string;
  instrument: InstrumentId;
  /** Linear gain, roughly 0..1.2. */
  gain: number;
  /** -1 (left) .. 1 (right). */
  pan?: number;
  send?: { reverb?: number; delay?: number; chorus?: number };
  notes: NoteEvent[];
  /** Skip this track on low-end devices. */
  optional?: boolean;
}

export interface SectionDef {
  name: string;
  /** Absolute bar this section starts on. */
  startBar: number;
  bars: number;
  /** Tonic, e.g. "D", "Bb". A change between sections is a key change. */
  key: string;
  mode: ScaleName;
  /** Intensity 0..1 — the engine uses it for filter/level automation. */
  energy?: number;
}

export interface SongDef {
  id: string;
  title: string;
  /** Which biome this belongs to (informational). */
  biome?: string;
  bpm: number;
  /** Beats per bar. Odd meters are encouraged; this game is wacky. */
  beatsPerBar: number;
  /** 0 = straight, 0.66 = hard shuffle. Applied to off-eighths. */
  swing?: number;
  sections: SectionDef[];
  chords: ChordEvent[];
  tracks: TrackDef[];
  mix?: {
    /** Reverb decay in seconds. */
    reverb?: number;
    /** Delay time in beats. */
    delayBeats?: number;
    delayFeedback?: number;
    masterGain?: number;
  };
  /** Bar to jump back to when looping. Defaults to 0. */
  loopFromBar?: number;
}

export function songLengthBars(song: SongDef): number {
  let bars = 0;
  for (const section of song.sections) bars = Math.max(bars, section.startBar + section.bars);
  for (const track of song.tracks) {
    for (const note of track.notes) bars = Math.max(bars, note.bar + 1);
  }
  return bars;
}

export function keyChangeCount(song: SongDef): number {
  let changes = 0;
  for (let i = 1; i < song.sections.length; i++) {
    const prev = song.sections[i - 1];
    const cur = song.sections[i];
    if (prev.key !== cur.key || prev.mode !== cur.mode) changes++;
  }
  return changes;
}

export function sectionAtBar(song: SongDef, bar: number): SectionDef | undefined {
  return song.sections.find((s) => bar >= s.startBar && bar < s.startBar + s.bars);
}

export function noteCount(song: SongDef): number {
  return song.tracks.reduce((n, t) => n + t.notes.length, 0);
}
