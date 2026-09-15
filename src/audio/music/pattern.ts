/**
 * Composition helpers.
 *
 * These exist so a 36-bar arrangement is written as musical intent
 * ("arpeggiate this progression in sixteenths for eight bars") rather than as
 * hundreds of literal note objects. Pure functions — all unit-testable.
 */
import type { ChordEvent, NoteEvent } from './song';
import { chordNotes, scaleDegree, toMidi, type ScaleName } from './theory';

export interface GridOptions {
  /** Absolute bar to start on. */
  startBar: number;
  /** How many bars to fill. */
  bars: number;
  beatsPerBar: number;
  /** Steps per bar — 16 gives sixteenths in 4/4. */
  steps: number;
  vel?: number;
  dur?: number;
}

/**
 * Turns a step string into notes. `x` = hit, `X` = accent, `.`/`-` = rest,
 * `o` = ghost note. The string loops to fill the requested bars.
 *
 *   drums('x...x...x..xx...', { startBar: 0, bars: 4, ... }, 'C2')
 */
export function steps(
  pattern: string,
  opts: GridOptions,
  pitch: number | string,
): NoteEvent[] {
  const chars = pattern.replace(/\s/g, '').split('');
  if (chars.length === 0) return [];
  const beatsPerStep = opts.beatsPerBar / opts.steps;
  const out: NoteEvent[] = [];
  for (let b = 0; b < opts.bars; b++) {
    for (let s = 0; s < opts.steps; s++) {
      const ch = chars[(b * opts.steps + s) % chars.length];
      if (ch === '.' || ch === '-' || ch === ' ') continue;
      const vel = ch === 'X' ? 1 : ch === 'o' ? 0.42 : (opts.vel ?? 0.8);
      out.push({
        bar: opts.startBar + b,
        beat: s * beatsPerStep,
        dur: opts.dur ?? beatsPerStep * 0.9,
        pitch,
        vel,
      });
    }
  }
  return out;
}

/** Euclidean rhythm — `hits` spread as evenly as possible over `steps`. */
export function euclid(hits: number, stepCount: number, rotate = 0): string {
  if (hits <= 0 || stepCount <= 0) return '.'.repeat(Math.max(0, stepCount));
  const out: string[] = [];
  let bucket = 0;
  for (let i = 0; i < stepCount; i++) {
    bucket += hits;
    if (bucket >= stepCount) {
      bucket -= stepCount;
      out.push('x');
    } else {
      out.push('.');
    }
  }
  const r = ((rotate % stepCount) + stepCount) % stepCount;
  return [...out.slice(r), ...out.slice(0, r)].join('');
}

export type ArpShape = 'up' | 'down' | 'updown' | 'downup' | 'random' | 'pinky' | 'thumb';

export interface ArpOptions extends GridOptions {
  shape?: ArpShape;
  /** Octave span to spread the chord across. */
  octaves?: number;
  /** Lowest note the arp is allowed to reach. */
  low?: number | string;
  /** Deterministic seed for the 'random' shape. */
  seed?: number;
}

function shapeOrder(notes: number[], shape: ArpShape, seed: number): number[] {
  switch (shape) {
    case 'down':
      return [...notes].reverse();
    case 'updown':
      return [...notes, ...notes.slice(1, -1).reverse()];
    case 'downup': {
      const d = [...notes].reverse();
      return [...d, ...d.slice(1, -1).reverse()];
    }
    case 'pinky': {
      const top = notes[notes.length - 1];
      return notes.slice(0, -1).flatMap((n) => [n, top]);
    }
    case 'thumb': {
      const bottom = notes[0];
      return notes.slice(1).flatMap((n) => [bottom, n]);
    }
    case 'random': {
      // Deterministic shuffle so songs sound identical every playthrough.
      const out = [...notes];
      let s = seed || 1;
      for (let i = out.length - 1; i > 0; i--) {
        s = (s * 1664525 + 1013904223) >>> 0;
        const j = s % (i + 1);
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    }
    default:
      return notes;
  }
}

/**
 * Arpeggiates a chord progression across a span of bars. `progression` is one
 * chord symbol per bar (it loops if shorter than `bars`).
 */
export function arp(progression: string[], opts: ArpOptions): NoteEvent[] {
  const { shape = 'up', octaves = 2, low = 'C3', seed = 7 } = opts;
  const beatsPerStep = opts.beatsPerBar / opts.steps;
  const lowMidi = toMidi(low);
  const out: NoteEvent[] = [];

  for (let b = 0; b < opts.bars; b++) {
    const symbol = progression[b % progression.length];
    let notes = chordNotes(symbol, 3);
    notes = notes.map((n) => {
      let v = n;
      while (v < lowMidi) v += 12;
      return v;
    });
    const spread: number[] = [];
    for (let o = 0; o < octaves; o++) for (const n of notes) spread.push(n + o * 12);
    spread.sort((a, b2) => a - b2);
    const order = shapeOrder(spread, shape, seed + b);
    for (let s = 0; s < opts.steps; s++) {
      out.push({
        bar: opts.startBar + b,
        beat: s * beatsPerStep,
        dur: opts.dur ?? beatsPerStep * 0.85,
        pitch: order[s % order.length],
        vel: opts.vel ?? (s % 4 === 0 ? 0.85 : 0.6),
      });
    }
  }
  return out;
}

/** Sustained chord stabs/pads — one voicing per bar of the progression. */
export function pad(
  progression: string[],
  opts: {
    startBar: number;
    bars: number;
    beatsPerBar: number;
    low?: number | string;
    span?: number;
    vel?: number;
    /** Bars each chord is held for. */
    hold?: number;
    /** Extra octave doubling below. */
    doubleBass?: boolean;
  },
): NoteEvent[] {
  const { low = 'C3', span = 16, vel = 0.5, hold = 1 } = opts;
  const lowMidi = toMidi(low);
  const out: NoteEvent[] = [];
  for (let b = 0; b < opts.bars; b += hold) {
    const symbol = progression[(b / hold) % progression.length];
    const notes = chordNotes(symbol, 3)
      .map((n) => {
        let v = n;
        while (v < lowMidi) v += 12;
        while (v > lowMidi + span) v -= 12;
        return v;
      })
      .filter((v, i, a) => a.indexOf(v) === i);
    for (const pitch of notes) {
      out.push({
        bar: opts.startBar + b,
        beat: 0,
        dur: opts.beatsPerBar * hold - 0.1,
        pitch,
        vel,
      });
    }
    if (opts.doubleBass) {
      out.push({
        bar: opts.startBar + b,
        beat: 0,
        dur: opts.beatsPerBar * hold - 0.1,
        pitch: Math.min(...notes) - 12,
        vel: vel * 0.9,
      });
    }
  }
  return out;
}

/** Root-note bassline following the progression, with a rhythm pattern. */
export function bassline(
  progression: string[],
  pattern: string,
  opts: GridOptions & { octave?: number; fifths?: boolean },
): NoteEvent[] {
  const octave = opts.octave ?? 2;
  const chars = pattern.replace(/\s/g, '').split('');
  const beatsPerStep = opts.beatsPerBar / opts.steps;
  const out: NoteEvent[] = [];
  for (let b = 0; b < opts.bars; b++) {
    const symbol = progression[b % progression.length];
    const notes = chordNotes(symbol, octave);
    const root = notes[0];
    const fifth = notes.find((n) => n - root === 7) ?? root + 7;
    for (let s = 0; s < opts.steps; s++) {
      const ch = chars[(b * opts.steps + s) % chars.length];
      if (ch === '.' || ch === '-') continue;
      const useFifth = opts.fifths && s % 8 >= 4;
      out.push({
        bar: opts.startBar + b,
        beat: s * beatsPerStep,
        dur: opts.dur ?? beatsPerStep * 0.85,
        pitch: useFifth ? fifth : root,
        vel: ch === 'X' ? 0.95 : (opts.vel ?? 0.8),
      });
    }
  }
  return out;
}

/** A melody written as scale degrees — retunes automatically on a key change. */
export function melody(
  degrees: Array<number | null>,
  opts: GridOptions & { key: string | number; scale: ScaleName; octaveOffset?: number },
): NoteEvent[] {
  const beatsPerStep = opts.beatsPerBar / opts.steps;
  const offset = (opts.octaveOffset ?? 0) * 12;
  const out: NoteEvent[] = [];
  for (let b = 0; b < opts.bars; b++) {
    for (let s = 0; s < opts.steps; s++) {
      const degree = degrees[(b * opts.steps + s) % degrees.length];
      if (degree === null || degree === undefined) continue;
      out.push({
        bar: opts.startBar + b,
        beat: s * beatsPerStep,
        dur: opts.dur ?? beatsPerStep * 0.9,
        pitch: scaleDegree(opts.key, opts.scale, degree) + offset,
        vel: opts.vel ?? 0.85,
      });
    }
  }
  return out;
}

/** Shifts a block of notes by whole bars — for repeating a section. */
export function shiftBars(notes: readonly NoteEvent[], bars: number): NoteEvent[] {
  return notes.map((n) => ({ ...n, bar: n.bar + bars }));
}

/** Repeats a block `times`, each copy offset by `everyBars`. */
export function repeat(notes: readonly NoteEvent[], times: number, everyBars: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (let i = 0; i < times; i++) out.push(...shiftBars(notes, i * everyBars));
  return out;
}

export function transposeNotes(notes: readonly NoteEvent[], semitones: number): NoteEvent[] {
  return notes.map((n) => ({ ...n, pitch: toMidi(n.pitch) + semitones }));
}

export function withVelocity(notes: readonly NoteEvent[], scale: number): NoteEvent[] {
  return notes.map((n) => ({ ...n, vel: Math.max(0, Math.min(1, n.vel * scale)) }));
}

/** One chord per bar, laid on beat 0. */
export function chordTrack(progression: string[], startBar: number, bars: number, hold = 1): ChordEvent[] {
  const out: ChordEvent[] = [];
  for (let b = 0; b < bars; b += hold) {
    out.push({ bar: startBar + b, beat: 0, chord: progression[(b / hold) % progression.length] });
  }
  return out;
}

/** Concatenates note blocks. Convenience so track bodies read as a list. */
export function merge(...blocks: Array<readonly NoteEvent[]>): NoteEvent[] {
  return blocks.flat() as NoteEvent[];
}

/** The same, for chord tracks assembled section by section. */
export function mergeChords(...blocks: Array<readonly ChordEvent[]>): ChordEvent[] {
  return blocks.flat() as ChordEvent[];
}
