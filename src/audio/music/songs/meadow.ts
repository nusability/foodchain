/**
 * "Buttercup Meadow" — the tutorial biome. Sunlit grass, bumbling insects,
 * a king who is not yet sure this whole "food chain" thing was a good idea.
 *
 * Concept: a hurdy-gurdy fairground band that just discovered a synthesizer.
 * `organ` and `banjo` carry the acoustic fairground-band identity; `supersaw`
 * and `squelch` are the synth the band is delighted and slightly alarmed to
 * have found. The form is a classic pop shape (intro / A / B / A' / wacky C
 * / outro) so it stays hummable for a tutorial biome, with one deliberate
 * gear-change into a lopsided quintuplet groove and the Hungarian scale
 * before snapping back home.
 */
import type { SongDef } from '../song';
import {
  arp,
  bassline,
  chordTrack,
  euclid,
  melody,
  merge,
  pad,
  steps,
} from '../pattern';

const BPB = 4;

// ---------------------------------------------------------------- sections
const INTRO_START = 0;
const INTRO_BARS = 4;
const A_START = 4;
const A_BARS = 8;
const B_START = 12;
const B_BARS = 8;
const A2_START = 20;
const A2_BARS = 8;
const C_START = 28;
const C_BARS = 8;
const OUTRO_START = 36;
const OUTRO_BARS = 8;
// = 44 bars total

// ------------------------------------------------------------- harmony
// G major throughout the "home" sections, extensions rather than triads so
// the fairground organ has something to chew on. B section modulates up a
// fifth to D major (the bright, expected fairground-tune move). The wacky
// section lurches to B Hungarian minor — a scale with a raised 4th that
// makes every chord sound like it's wearing a slightly crooked hat — then
// the outro resolves back to G for a clean loop into bar 4.
const INTRO_PROG = ['Gmaj7', 'Em9', 'Cadd9', 'D9'];
const A_PROG = ['Gmaj7', 'Em9', 'Cadd9', 'D9', 'Gmaj7', 'Em7', 'Am9', 'D7sus4'];
const B_PROG = ['Dmaj7', 'Bm9', 'Gadd9', 'A9', 'Dmaj7', 'F#m7', 'Gmaj7', 'A7sus4'];
const A2_PROG = ['Gmaj9', 'Em9', 'Cadd9', 'D13', 'Bm7', 'Em9', 'Cmaj9', 'D7sus4'];
// Half-diminished / altered-dominant / diminished-7 — genuinely odd, still
// resolves by function (i, IV7#11, ii-dim, V7#9) so it reads as harmony and
// not noise.
const C_PROG = ['Bm7b5', 'F7#11', 'Ddim7', 'G7#9'];
const OUTRO_PROG = ['Cadd9', 'D7sus4', 'Em9', 'D9', 'Cadd9', 'Bm7', 'Cmaj7', 'D9'];

const chords = [
  ...chordTrack(INTRO_PROG, INTRO_START, INTRO_BARS),
  ...chordTrack(A_PROG, A_START, A_BARS),
  ...chordTrack(B_PROG, B_START, B_BARS),
  ...chordTrack(A2_PROG, A2_START, A2_BARS),
  ...chordTrack(C_PROG, C_START, C_BARS),
  ...chordTrack(OUTRO_PROG, OUTRO_START, OUTRO_BARS),
];

// ---------------------------------------------------------------- drums
// Four-on-the-floor with a dotted-eighth "skip" kick in the groove sections;
// a genuinely lopsided euclidean kick for the wacky section.
const kickNotes = merge(
  steps('x...x...x...x...', { startBar: INTRO_START, bars: INTRO_BARS, beatsPerBar: BPB, steps: 16, vel: 0.7 }, 'C1'),
  steps('x...x.x.x...x.x.', { startBar: A_START, bars: A_BARS, beatsPerBar: BPB, steps: 16, vel: 0.88 }, 'C1'),
  steps('x...x.x.x...x.x.', { startBar: B_START, bars: B_BARS, beatsPerBar: BPB, steps: 16, vel: 0.9 }, 'C1'),
  steps('x.x.x.x.x...x.x.', { startBar: A2_START, bars: A2_BARS, beatsPerBar: BPB, steps: 16, vel: 0.92 }, 'C1'),
  // 5-against-16 euclidean kick — the meter itself seems to trip over its feet.
  steps(euclid(5, 16, 1), { startBar: C_START, bars: C_BARS, beatsPerBar: BPB, steps: 16, vel: 0.95 }, 'C1'),
  steps('x...x...x.......', { startBar: OUTRO_START, bars: OUTRO_BARS, beatsPerBar: BPB, steps: 16, vel: 0.6 }, 'C1'),
);

const snareNotes = merge(
  steps('....x.......x...', { startBar: INTRO_START, bars: INTRO_BARS, beatsPerBar: BPB, steps: 16, vel: 0.55 }, 'D2'),
  steps('....x..o....x.o.', { startBar: A_START, bars: A_BARS, beatsPerBar: BPB, steps: 16 }, 'D2'),
  steps('....x..o....x.o.', { startBar: B_START, bars: B_BARS, beatsPerBar: BPB, steps: 16, vel: 0.85 }, 'D2'),
  steps('....x.o.o...x..o', { startBar: A2_START, bars: A2_BARS, beatsPerBar: BPB, steps: 16, vel: 0.88 }, 'D2'),
  steps(euclid(3, 16, 6), { startBar: C_START, bars: C_BARS, beatsPerBar: BPB, steps: 16, vel: 0.9 }, 'D2'),
  steps('....x.......x...', { startBar: OUTRO_START, bars: OUTRO_BARS, beatsPerBar: BPB, steps: 16, vel: 0.55 }, 'D2'),
);

const hatNotes = merge(
  steps(euclid(8, 16, 0), { startBar: INTRO_START, bars: INTRO_BARS, beatsPerBar: BPB, steps: 16, vel: 0.35 }, 'F#3'),
  steps(euclid(12, 16, 0), { startBar: A_START, bars: A_BARS, beatsPerBar: BPB, steps: 16, vel: 0.5 }, 'F#3'),
  steps(euclid(12, 16, 0), { startBar: B_START, bars: B_BARS, beatsPerBar: BPB, steps: 16, vel: 0.52 }, 'F#3'),
  steps(euclid(14, 16, 0), { startBar: A2_START, bars: A2_BARS, beatsPerBar: BPB, steps: 16, vel: 0.55 }, 'F#3'),
  // Rotated + fewer hits than the kick's euclid pattern so the two rub
  // against each other instead of locking — that's the "lurch".
  steps(euclid(7, 16, 3), { startBar: C_START, bars: C_BARS, beatsPerBar: BPB, steps: 16, vel: 0.5 }, 'F#3'),
  steps(euclid(8, 16, 0), { startBar: OUTRO_START, bars: OUTRO_BARS, beatsPerBar: BPB, steps: 16, vel: 0.32 }, 'F#3'),
);

// ----------------------------------------------------------------- bass
// subbass: phone-safe low end, root/fifth walk under the groove sections,
// straight roots (heavier, warier) under the wacky section.
const bassNotes = merge(
  bassline(INTRO_PROG, 'x.......', { startBar: INTRO_START, bars: INTRO_BARS, beatsPerBar: BPB, steps: 8, octave: 2, vel: 0.75 }),
  bassline(A_PROG, 'x..x..x.', { startBar: A_START, bars: A_BARS, beatsPerBar: BPB, steps: 8, octave: 2, fifths: true, vel: 0.85 }),
  bassline(B_PROG, 'x.x..x.x', { startBar: B_START, bars: B_BARS, beatsPerBar: BPB, steps: 8, octave: 2, fifths: true, vel: 0.85 }),
  bassline(A2_PROG, 'x..x.x.x', { startBar: A2_START, bars: A2_BARS, beatsPerBar: BPB, steps: 8, octave: 2, fifths: true, vel: 0.88 }),
  // 10-step (quintuplet) grid over the still-4-beat bar: a real polymetric
  // hiccup without breaking the song's fixed beatsPerBar.
  bassline(C_PROG, 'x....x....', { startBar: C_START, bars: C_BARS, beatsPerBar: BPB, steps: 10, octave: 2, vel: 0.9 }),
  bassline(OUTRO_PROG, 'x.......', { startBar: OUTRO_START, bars: OUTRO_BARS, beatsPerBar: BPB, steps: 8, octave: 2, vel: 0.7 }),
);

// ----------------------------------------------------------- comp (banjo)
// The fairground-band core: clawhammer-ish broken chords. Shape changes
// per section so the "hurdy-gurdy" character keeps moving — `thumb` in A2
// alternates a low pedal against the chord the way a real clawhammer thumb
// does; `random` in the wacky section is the one place the band's timing
// genuinely comes apart.
const compNotes = merge(
  arp(INTRO_PROG, { startBar: INTRO_START, bars: INTRO_BARS, beatsPerBar: BPB, steps: 8, shape: 'up', octaves: 1, low: 'G3', vel: 0.45 }),
  arp(A_PROG, { startBar: A_START, bars: A_BARS, beatsPerBar: BPB, steps: 16, shape: 'updown', octaves: 2, low: 'G3', vel: 0.6 }),
  arp(B_PROG, { startBar: B_START, bars: B_BARS, beatsPerBar: BPB, steps: 16, shape: 'pinky', octaves: 2, low: 'D3', vel: 0.62 }),
  arp(A2_PROG, { startBar: A2_START, bars: A2_BARS, beatsPerBar: BPB, steps: 16, shape: 'thumb', octaves: 2, low: 'G3', vel: 0.65 }),
  arp(C_PROG, { startBar: C_START, bars: C_BARS, beatsPerBar: BPB, steps: 20, shape: 'random', octaves: 2, low: 'B2', seed: 41, vel: 0.6 }),
  arp(OUTRO_PROG, { startBar: OUTRO_START, bars: OUTRO_BARS, beatsPerBar: BPB, steps: 8, shape: 'down', octaves: 1, low: 'G3', vel: 0.5 }),
);

// ------------------------------------------------------------ pad (organ)
// The literal hurdy-gurdy/organ-grinder voice — sustained drawbar chords
// holding the harmony underneath everything else.
const padNotes = merge(
  pad(INTRO_PROG, { startBar: INTRO_START, bars: INTRO_BARS, beatsPerBar: BPB, low: 'G3', span: 14, hold: 1, vel: 0.35 }),
  pad(A_PROG, { startBar: A_START, bars: A_BARS, beatsPerBar: BPB, low: 'G3', span: 14, hold: 1, vel: 0.42 }),
  pad(B_PROG, { startBar: B_START, bars: B_BARS, beatsPerBar: BPB, low: 'D3', span: 14, hold: 1, vel: 0.45 }),
  pad(A2_PROG, { startBar: A2_START, bars: A2_BARS, beatsPerBar: BPB, low: 'G3', span: 16, hold: 1, vel: 0.46 }),
  pad(C_PROG, { startBar: C_START, bars: C_BARS, beatsPerBar: BPB, low: 'B2', span: 14, hold: 2, vel: 0.4 }),
  pad(OUTRO_PROG, { startBar: OUTRO_START, bars: OUTRO_BARS, beatsPerBar: BPB, low: 'G3', span: 14, hold: 1, vel: 0.36 }),
);

// ----------------------------------------------------------- lead (supersaw)
// The hook. Written once as scale degrees and reharmonised by key/scale per
// section — a real modulation, not a transposed copy: the same shape lands
// on a different chord underneath it in D major, and on a bent, slightly
// worried version of itself in B Hungarian.
const HOOK = [
  0, 2, 4, 2, 0, null, 4, 5,
  4, 2, 0, null, 2, 4, 7, null,
  0, 2, 4, 5, 7, null, 5, 4,
  2, 0, null, null, 0, null, null, null,
];
const HOOK_BRIGHT = [
  4, 5, 7, 5, 4, null, 7, 9,
  7, 5, 4, null, 5, 7, 9, null,
  4, 5, 7, 9, 11, null, 9, 7,
  5, 4, null, null, 2, null, 0, null,
];
const HOOK_BUSY = [
  0, 2, 4, 5, 4, 2, 0, 2,
  4, 5, 7, 5, 4, 2, 0, null,
  2, 4, 5, 7, 9, 7, 5, 4,
  2, 0, 2, 4, 0, null, null, null,
];
const HOOK_OUTRO = [0, null, null, null, 2, null, 4, null, 7, null, null, null, null, null, null, null];

const leadNotes = merge(
  melody(HOOK, { startBar: INTRO_START, bars: INTRO_BARS, beatsPerBar: BPB, steps: 8, key: 'G3', scale: 'major', vel: 0.6 }),
  melody(HOOK, { startBar: A_START, bars: A_BARS, beatsPerBar: BPB, steps: 8, key: 'G3', scale: 'major', vel: 0.8 }),
  melody(HOOK_BRIGHT, { startBar: B_START, bars: B_BARS, beatsPerBar: BPB, steps: 8, key: 'D3', scale: 'major', vel: 0.82 }),
  melody(HOOK_BUSY, { startBar: A2_START, bars: A2_BARS, beatsPerBar: BPB, steps: 8, key: 'G3', scale: 'major', vel: 0.85 }),
  // Same hook shape, now read against the Hungarian scale — the tune the
  // listener just learned comes back wearing a crooked grin.
  melody(HOOK, { startBar: C_START, bars: C_BARS, beatsPerBar: BPB, steps: 8, key: 'B3', scale: 'hungarian', vel: 0.78 }),
  melody(HOOK_OUTRO, { startBar: OUTRO_START, bars: OUTRO_BARS, beatsPerBar: BPB, steps: 8, key: 'G3', scale: 'major', vel: 0.55 }),
);

// -------------------------------------------------------- ornamental layers

// kalimba: a skippy high countermelody, dropped out in the wacky section so
// the squelch/vox pair can be the weird voice instead.
const counterNotes = merge(
  arp(A_PROG, { startBar: A_START, bars: A_BARS, beatsPerBar: BPB, steps: 16, shape: 'pinky', octaves: 1, low: 'G5', vel: 0.32 }),
  arp(A2_PROG, { startBar: A2_START, bars: A2_BARS, beatsPerBar: BPB, steps: 16, shape: 'thumb', octaves: 1, low: 'G5', vel: 0.34 }),
  arp(OUTRO_PROG, { startBar: OUTRO_START, bars: OUTRO_BARS, beatsPerBar: BPB, steps: 8, shape: 'up', octaves: 1, low: 'G5', vel: 0.28 }),
);

// brass: fairground-band punctuation on the turnarounds and under the wacky
// section's altered chords, where it gets to sound properly indignant.
const brassNotes = merge(
  arp(B_PROG, { startBar: B_START, bars: B_BARS, beatsPerBar: BPB, steps: 4, shape: 'up', octaves: 1, low: 'C4', vel: 0.5 }),
  arp(C_PROG, { startBar: C_START, bars: C_BARS, beatsPerBar: BPB, steps: 4, shape: 'up', octaves: 1, low: 'B3', vel: 0.55 }),
  arp(OUTRO_PROG, { startBar: OUTRO_START, bars: OUTRO_BARS, beatsPerBar: BPB, steps: 4, shape: 'down', octaves: 1, low: 'C4', vel: 0.48 }),
);

// vox: cartoon blips — bumbling insects in the background during the home
// key, and the nervous king's voice cracking during the wacky section.
const voxDegreesIntro = [null, null, 7, null, null, null, null, null];
const voxDegreesC = [7, null, 9, 6, null, 11, null, 7, null, 6, 9, null, null, 11, null, null];
const voxNotes = merge(
  melody(voxDegreesIntro, { startBar: INTRO_START, bars: INTRO_BARS, beatsPerBar: BPB, steps: 8, key: 'G3', scale: 'major', vel: 0.4, octaveOffset: 1 }),
  melody(voxDegreesC, { startBar: C_START, bars: C_BARS, beatsPerBar: BPB, steps: 16, key: 'B3', scale: 'hungarian', vel: 0.5, octaveOffset: 1 }),
);

// woodblock: dry fairground clip-clop, a rhythmic ostinato independent of
// the kit so the groove sections feel like more than one drummer.
const woodblockNotes = merge(
  steps(euclid(7, 16, 2), { startBar: A_START, bars: A_BARS, beatsPerBar: BPB, steps: 16, vel: 0.3 }, 'A4'),
  steps(euclid(7, 16, 2), { startBar: A2_START, bars: A2_BARS, beatsPerBar: BPB, steps: 16, vel: 0.32 }, 'A4'),
  steps(euclid(7, 16, 2), { startBar: OUTRO_START, bars: OUTRO_BARS, beatsPerBar: BPB, steps: 16, vel: 0.26 }, 'A4'),
);

// clap: crowd-clap layered on the backbeat for the choruses only.
const clapNotes = merge(
  steps('....x.......x...', { startBar: A_START, bars: A_BARS, beatsPerBar: BPB, steps: 16, vel: 0.5 }, 'D3'),
  steps('....x.......x...', { startBar: A2_START, bars: A2_BARS, beatsPerBar: BPB, steps: 16, vel: 0.55 }, 'D3'),
);

// squelch: the "found a synthesizer" gag — a 303 burble that shows up only
// once the band has gone properly odd, sliding around under the vox.
const squelchNotes = merge(
  bassline(C_PROG, 'x.x.x.x.x.', { startBar: C_START, bars: C_BARS, beatsPerBar: BPB, steps: 10, octave: 3, vel: 0.5 }),
);

// crash: section-boundary punctuation only.
const crashNotes = [
  { bar: A_START, beat: 0, dur: 2, pitch: 'D4', vel: 0.5 },
  { bar: B_START, beat: 0, dur: 2, pitch: 'D4', vel: 0.6 },
  { bar: A2_START, beat: 0, dur: 2, pitch: 'D4', vel: 0.5 },
  { bar: C_START, beat: 0, dur: 2, pitch: 'D4', vel: 0.7 },
  { bar: OUTRO_START, beat: 0, dur: 2, pitch: 'D4', vel: 0.55 },
];

export const meadow: SongDef = {
  id: 'meadow',
  title: 'Buttercup Bounce',
  biome: 'meadow',
  bpm: 126,
  beatsPerBar: BPB,
  // Swung off-eighths are the cartoon "skip" — straight enough to stay
  // hummable, loose enough to feel like a jaunty walk, not a metronome.
  swing: 0.16,
  sections: [
    { name: 'intro', startBar: INTRO_START, bars: INTRO_BARS, key: 'G', mode: 'major', energy: 0.32 },
    { name: 'A', startBar: A_START, bars: A_BARS, key: 'G', mode: 'major', energy: 0.65 },
    // Up a fifth into D major — the bright, expected fairground modulation.
    { name: 'B', startBar: B_START, bars: B_BARS, key: 'D', mode: 'major', energy: 0.8 },
    { name: "A'", startBar: A2_START, bars: A2_BARS, key: 'G', mode: 'major', energy: 0.78 },
    // The wacky gear-change: B Hungarian minor, quintuplet subdivisions,
    // altered/diminished harmony.
    { name: 'C', startBar: C_START, bars: C_BARS, key: 'B', mode: 'hungarian', energy: 0.92 },
    // Snaps back to G major for a clean cadence into the loop point.
    { name: 'outro', startBar: OUTRO_START, bars: OUTRO_BARS, key: 'G', mode: 'major', energy: 0.5 },
  ],
  chords,
  tracks: [
    { name: 'kick', instrument: 'kick', gain: 0.95, notes: kickNotes },
    { name: 'snare', instrument: 'snare', gain: 0.8, pan: -0.05, notes: snareNotes },
    { name: 'hat', instrument: 'hat', gain: 0.55, pan: 0.3, send: { reverb: 0.08 }, notes: hatNotes },
    { name: 'bass', instrument: 'subbass', gain: 0.85, notes: bassNotes },
    { name: 'comp', instrument: 'banjo', gain: 0.62, pan: -0.35, send: { reverb: 0.15, delay: 0.08 }, notes: compNotes },
    { name: 'pad', instrument: 'organ', gain: 0.5, pan: 0.15, send: { reverb: 0.35 }, notes: padNotes },
    { name: 'lead', instrument: 'supersaw', gain: 0.68, pan: 0.05, send: { reverb: 0.25, delay: 0.18 }, notes: leadNotes },
    { name: 'counter', instrument: 'kalimba', gain: 0.4, pan: 0.5, send: { reverb: 0.3, delay: 0.2 }, notes: counterNotes, optional: true },
    { name: 'brass', instrument: 'brass', gain: 0.55, pan: -0.2, send: { reverb: 0.2 }, notes: brassNotes, optional: true },
    { name: 'vox', instrument: 'vox', gain: 0.45, pan: 0.4, send: { reverb: 0.2, delay: 0.15 }, notes: voxNotes, optional: true },
    { name: 'woodblock', instrument: 'woodblock', gain: 0.3, pan: 0.6, notes: woodblockNotes, optional: true },
    { name: 'clap', instrument: 'clap', gain: 0.4, pan: -0.5, notes: clapNotes, optional: true },
    { name: 'squelch', instrument: 'squelch', gain: 0.42, pan: -0.15, send: { reverb: 0.15, delay: 0.25 }, notes: squelchNotes, optional: true },
    { name: 'crash', instrument: 'crash', gain: 0.4, send: { reverb: 0.4 }, notes: crashNotes, optional: true },
  ],
  mix: { reverb: 2.2, delayBeats: 0.75, delayFeedback: 0.3, masterGain: 0.85 },
  // Loop back to the A section, not the intro — the intro is a one-time
  // "curtain up" and the outro's D9 cadence resolves straight into A's Gmaj7.
  loopFromBar: A_START,
};
