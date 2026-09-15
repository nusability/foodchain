/**
 * Just enough music theory to write songs as data.
 *
 * Pure functions, no Web Audio — so the composition side of the audio system
 * is unit-testable, which matters because "does this song actually change key
 * three times" is a property we assert in tests.
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const PITCH_CLASS: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5,
  F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11,
};

/** "C#4" / "Eb2" / "A5" -> MIDI note number. Middle C (C4) is 60. */
export function noteToMidi(note: string): number {
  const m = /^([A-Ga-g])([#b]{0,2})(-?\d+)$/.exec(note.trim());
  if (!m) throw new Error(`bad note name "${note}"`);
  const [, letter, accidental, octave] = m;
  let pc = PITCH_CLASS[letter.toUpperCase()];
  for (const ch of accidental) pc += ch === '#' ? 1 : -1;
  return (Number(octave) + 1) * 12 + ((pc % 12) + 12) % 12;
}

export function midiToNote(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc]}${octave}`;
}

/** Equal temperament, A4 = 440 Hz. */
export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

export function toMidi(pitch: string | number): number {
  return typeof pitch === 'number' ? pitch : noteToMidi(pitch);
}

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  wholeTone: [0, 2, 4, 6, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  /** Wacky on purpose — great for lurching biome themes. */
  octatonic: [0, 2, 3, 5, 6, 8, 9, 11],
  hungarian: [0, 2, 3, 6, 7, 8, 11],
} as const;

export type ScaleName = keyof typeof SCALES;

/**
 * Degree 0 is the root; degrees wrap into higher octaves and go negative.
 *
 * `root` accepts a bare tonic ("G", "Bb") as well as a full note name — a
 * section's `key` field is a tonic, and having to remember to append an octave
 * there was a trap worth closing.
 */
export function scaleDegree(root: string | number, scale: ScaleName, degree: number): number {
  const steps = SCALES[scale];
  const rootMidi = typeof root === 'string' && !/-?\d/.test(root) ? noteToMidi(`${root}3`) : toMidi(root);
  const octave = Math.floor(degree / steps.length);
  const index = ((degree % steps.length) + steps.length) % steps.length;
  return rootMidi + steps[index] + octave * 12;
}

const CHORD_QUALITIES: Record<string, number[]> = {
  '': [0, 4, 7],
  maj: [0, 4, 7],
  m: [0, 3, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '5': [0, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  mmaj7: [0, 3, 7, 11],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  '9': [0, 4, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  '7b9': [0, 4, 7, 10, 13],
  '7#9': [0, 4, 7, 10, 15],
  '7#11': [0, 4, 7, 10, 18],
  '7sus4': [0, 5, 7, 10],
  '11': [0, 7, 10, 14, 17],
  '13': [0, 4, 7, 10, 14, 21],
  maj13: [0, 4, 7, 11, 14, 21],
  m11: [0, 3, 7, 10, 14, 17],
  m13: [0, 3, 7, 10, 14, 21],
  'maj7#11': [0, 4, 7, 11, 18],
  'maj9#11': [0, 4, 7, 11, 14, 18],
  '9sus4': [0, 5, 7, 10, 14],
  '13sus4': [0, 5, 7, 10, 14, 21],
  '7b5': [0, 4, 6, 10],
  '7#5': [0, 4, 8, 10],
  '7b13': [0, 4, 7, 10, 20],
  'maj7#5': [0, 4, 8, 11],
  '6/9': [0, 4, 7, 9, 14],
  'm6/9': [0, 3, 7, 9, 14],
  add11: [0, 4, 7, 17],
  madd11: [0, 3, 7, 17],
  m9b5: [0, 3, 6, 10, 14],
};

export interface ParsedChord {
  root: number;
  /** Pitch classes relative to the root. */
  intervals: number[];
  bass: number;
  symbol: string;
}

/**
 * Parses chord symbols like "Dm7", "F#maj9", "Bb7#9", "Cmaj7/E".
 * Octave defaults to 3, which sits nicely under a lead in this game's mixes.
 */
export function parseChord(symbol: string, octave = 3): ParsedChord {
  const [main, bassPart] = symbol.trim().split('/');
  const m = /^([A-Ga-g][#b]{0,2})(.*)$/.exec(main);
  if (!m) throw new Error(`bad chord symbol "${symbol}"`);
  const [, rootName, qualityRaw] = m;
  const quality = qualityRaw.trim();
  const intervals = CHORD_QUALITIES[quality];
  if (!intervals) throw new Error(`unknown chord quality "${quality}" in "${symbol}"`);
  const root = noteToMidi(`${rootName}${octave}`);
  let bass = root;
  if (bassPart) {
    bass = noteToMidi(`${bassPart}${octave}`);
    if (bass > root) bass -= 12;
  }
  return { root, intervals: [...intervals], bass, symbol };
}

/**
 * Absolute MIDI notes for a chord symbol.
 *
 * A slash bass is included as the lowest note — `"Cmaj7/E"` really does put an
 * E underneath, which matters because arp/pad/bassline all build on this.
 */
export function chordNotes(symbol: string, octave = 3): number[] {
  const { root, intervals, bass } = parseChord(symbol, octave);
  const notes = intervals.map((i) => root + i);
  if (bass !== root && !notes.includes(bass)) notes.unshift(bass);
  return notes.sort((a, b) => a - b);
}

/**
 * Drops a chord into a target register without changing its colour — keeps
 * pads from flying off into dog-whistle territory when a song modulates up.
 */
export function voiceChord(symbol: string, lowest: string | number, span = 14): number[] {
  const low = toMidi(lowest);
  const notes = chordNotes(symbol, 3).map((n) => {
    let v = n;
    while (v < low) v += 12;
    while (v > low + span) v -= 12;
    return v;
  });
  return [...new Set(notes)].sort((a, b) => a - b);
}

/** Semitone distance between two keys, shortest way round the circle. */
export function keyDistance(from: string, to: string): number {
  const a = noteToMidi(`${from}4`);
  const b = noteToMidi(`${to}4`);
  let d = (b - a) % 12;
  if (d > 6) d -= 12;
  if (d < -6) d += 12;
  return d;
}

export function transpose(notes: readonly number[], semitones: number): number[] {
  return notes.map((n) => n + semitones);
}

/** Beats -> seconds at a tempo. */
export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats * 60) / bpm;
}
