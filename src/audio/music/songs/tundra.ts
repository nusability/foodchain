/**
 * Frostwhisker Tundra — "Glass Wind, Iron Boots"
 *
 * The tundra is the emptiest, coldest biome in the game: a white plain with
 * something huge moving under the ice. The arrangement leans on register and
 * space rather than density — glass/fmbell for the wind-chime cold, a choir
 * pad for the "vast" feeling, a subbass drone that never resolves quickly,
 * and cavernous, heavily-reverbed drums that land like footsteps in an empty
 * room. All of that is minor/modal. Then, because this is still a comic game
 * about animals eating each other, the "something huge under the snow" turns
 * out to be a marching band of woolly mammoths: eight bars of ridiculous
 * tuba-and-cowbell oom-pah in a major key before the cold reasserts itself.
 */
import type { SongDef } from '../song';
import type { ChordEvent } from '../song';
import { arp, bassline, chordTrack, euclid, melody, merge, pad, steps } from '../pattern';

// ---------------------------------------------------------------- layout
const INTRO = 0; // 4  bars — wind only, harmony barely stated
const A = 4; // 8  bars — home key, the glassy hook
const B = 12; // 8  bars — phrygian: the b2 is what makes it feel wrong/vast
const DRIFT = 20; // 4  bars — near-silence; the "something moving" bridge
const A2 = 24; // 8  bars — home key again, harmonic-minor raised 7th for ache
const MARCH = 32; // 8  bars — the joke: major key, oom-pah, comic relief
const OUTRO = 40; // 8  bars — home key, dominant-sus turnaround into the loop
// total: 48 bars

// ------------------------------------------------------------ harmony
// Home-key progression (A natural minor). i9 - VI - III - Vsus keeps the
// tonic soft (add9, not a bare triad) so it can sit under a bell arpeggio
// without ever sounding like a resolved cadence — the tundra never settles.
const homeProg = ['Am9', 'Fmaj7', 'Cmaj7', 'G7sus4'];

// B section modulates to C phrygian: same relative pitch collection as A
// aeolian's relative major area, but the phrygian b2 (Db) is the "enormous
// thing" chord — it makes the ground feel like it's not where you left it.
const driftKeyProg = ['Cm7', 'Dbmaj7', 'Abmaj7', 'Bbm7'];
// DRIFT holds two of those same-family chords for a full 2 bars each —
// harmonic rhythm slows to a crawl while the sub bass drones underneath.
const driftProg = ['Cm9', 'Bbm7'];

// A2 reharmonises the home key in harmonic minor: the raised 7th (G#) gives
// an altered dominant, E7#9 — the "Hendrix chord" — its pull is what makes
// the return to A feel earned rather than just repeated.
const a2Prog = ['Am9', 'Fmaj7', 'E7#9', 'Am7'];

// The march: a flat modulation up to D major, oom-pah I-IV-V-vi. No modal
// cleverness here on purpose — the joke lands harder in a plain, dumb,
// happy key after three sections of minor/phrygian ambiguity.
const marchProg = ['D', 'G', 'A7', 'Bm7'];

// Outro resolves back toward A minor; E7sus4 is the turnaround chord that
// wants to fall into the Am9 that opens section A, which is what
// loopFromBar exploits for a clean loop.
const outroProg = ['Am9', 'G6', 'Fmaj7', 'E7sus4'];

const chords: ChordEvent[] = [
  ...chordTrack(homeProg, INTRO, 4, 1),
  ...chordTrack(homeProg, A, 8, 1),
  ...chordTrack(driftKeyProg, B, 8, 1),
  ...chordTrack(driftProg, DRIFT, 4, 2),
  ...chordTrack(a2Prog, A2, 8, 1),
  ...chordTrack(marchProg, MARCH, 8, 1),
  ...chordTrack(outroProg, OUTRO, 8, 1),
];

// A single hit every 4 bars, for the gong: too grand an instrument to use
// more than once per phrase or it stops sounding enormous.
const oneHitPer4Bars = `X${'.'.repeat(63)}`;

// -------------------------------------------------------------- melody
// The whistle is the biome's "voice" — one lonely traveller against a huge
// white nothing. Written as scale degrees so it re-tunes itself through
// every key change without being rewritten by hand.
const windPhrase: Array<number | null> = [
  4, null, null, 3, null, 2, null, null,
  7, null, null, 5, null, 4, null, null,
];
const achePhrase: Array<number | null> = [
  0, null, 2, null, 4, null, 6, null,
  7, null, 5, null, 4, null, 0, null,
];
// The march steals the whistle's own motif and turns it jaunty — same
// instrument, same register, but staccato eighths instead of long lonely
// tones, so the joke reads as "the wind picked up a marching band".
const marchPhrase: Array<number | null> = [
  0, 2, 4, 2, 0, null, 4, null,
  5, 4, 2, 0, null, null, 7, null,
];
const farewellPhrase: Array<number | null> = [
  4, null, null, null, 3, null, 2, null,
  0, null, null, null, null, null, null, null,
];

const whistleTrack = {
  name: 'whistle',
  instrument: 'whistle' as const,
  gain: 0.62,
  pan: 0.1,
  send: { reverb: 0.5, delay: 0.18 },
  notes: merge(
    melody(windPhrase, { key: 'A3', scale: 'minor', startBar: A, bars: 8, beatsPerBar: 4, steps: 8, octaveOffset: 1, vel: 0.7 }),
    melody(achePhrase, { key: 'A3', scale: 'harmonicMinor', startBar: A2, bars: 8, beatsPerBar: 4, steps: 8, octaveOffset: 1, vel: 0.85 }),
    melody(marchPhrase, { key: 'D4', scale: 'major', startBar: MARCH, bars: 8, beatsPerBar: 4, steps: 8, octaveOffset: 0, vel: 0.85 }),
    melody(farewellPhrase, { key: 'A3', scale: 'minor', startBar: OUTRO, bars: 8, beatsPerBar: 4, steps: 8, octaveOffset: 1, vel: 0.55 }),
  ),
};

// ------------------------------------------------------------ bell/glass
// Two distinct bell timbres: `glass` is the ambient shimmer that's almost
// always present (icicles, wind chimes), `fmbell` (below, as "chimes") is
// colder and more digital — reserved for the "something is watching"
// sections so it reads as a separate, unsettling sound rather than more
// of the same texture.
const glassTrack = {
  name: 'glass',
  instrument: 'glass' as const,
  gain: 0.5,
  pan: -0.15,
  send: { reverb: 0.4, delay: 0.25 },
  notes: merge(
    arp(homeProg, { startBar: INTRO, bars: 4, beatsPerBar: 4, steps: 8, shape: 'up', octaves: 1, low: 'A4', vel: 0.35 }),
    arp(homeProg, { startBar: A, bars: 8, beatsPerBar: 4, steps: 16, shape: 'updown', octaves: 2, low: 'A4' }),
    arp(driftKeyProg, { startBar: B, bars: 8, beatsPerBar: 4, steps: 16, shape: 'down', octaves: 2, low: 'C4', seed: 3 }),
    arp(driftProg, { startBar: DRIFT, bars: 4, beatsPerBar: 4, steps: 8, shape: 'random', octaves: 1, low: 'C5', vel: 0.3, seed: 11 }),
    arp(a2Prog, { startBar: A2, bars: 8, beatsPerBar: 4, steps: 16, shape: 'updown', octaves: 3, low: 'A4' }),
    // silent through MARCH — the brass band gets the spotlight
    arp(outroProg, { startBar: OUTRO, bars: 8, beatsPerBar: 4, steps: 8, shape: 'down', octaves: 1, low: 'A4', vel: 0.3 }),
  ),
};

const chimesTrack = {
  name: 'chimes',
  instrument: 'fmbell' as const,
  gain: 0.32,
  pan: 0.35,
  send: { reverb: 0.45 },
  optional: true,
  notes: merge(
    arp(driftKeyProg, { startBar: B, bars: 8, beatsPerBar: 4, steps: 4, shape: 'random', octaves: 1, low: 'C6', vel: 0.3, seed: 5 }),
    arp(driftProg, { startBar: DRIFT, bars: 4, beatsPerBar: 4, steps: 4, shape: 'random', octaves: 1, low: 'C6', vel: 0.28, seed: 9 }),
    arp(a2Prog, { startBar: A2, bars: 8, beatsPerBar: 4, steps: 4, shape: 'random', octaves: 1, low: 'C6', vel: 0.32, seed: 13 }),
  ),
};

// -------------------------------------------------------------- pad/choir
const padTrack = {
  name: 'choir',
  instrument: 'choirpad' as const,
  gain: 0.55,
  pan: 0,
  send: { reverb: 0.55, chorus: 0.2 },
  notes: merge(
    pad(homeProg, { startBar: INTRO, bars: 4, beatsPerBar: 4, low: 'A3', span: 14, vel: 0.35, hold: 1 }),
    pad(homeProg, { startBar: A, bars: 8, beatsPerBar: 4, low: 'A3', span: 16, vel: 0.45, hold: 1 }),
    pad(driftKeyProg, { startBar: B, bars: 8, beatsPerBar: 4, low: 'C3', span: 16, vel: 0.5, hold: 1 }),
    // Held for a full 2 bars per chord, with a doubled bass note — the
    // slowest harmonic rhythm in the song, for the emptiest moment in it.
    pad(driftProg, { startBar: DRIFT, bars: 4, beatsPerBar: 4, low: 'C3', span: 14, vel: 0.4, hold: 2, doubleBass: true }),
    pad(a2Prog, { startBar: A2, bars: 8, beatsPerBar: 4, low: 'A3', span: 18, vel: 0.55, hold: 1 }),
    // silent through MARCH — brass carries the harmony there instead
    pad(outroProg, { startBar: OUTRO, bars: 8, beatsPerBar: 4, low: 'A3', span: 14, vel: 0.35, hold: 1 }),
  ),
};

// ---------------------------------------------------------------- bass
// One subbass track for the whole song, including under the march — the
// glacier never actually leaves, it's just wearing a tuba for eight bars.
// Long `dur` values in the ambient sections let notes ring into a drone;
// the march shortens them to a punchy quarter-note stomp.
const bassTrack = {
  name: 'sub',
  instrument: 'subbass' as const,
  gain: 0.85,
  pan: 0,
  notes: merge(
    bassline(homeProg, 'X...............', { startBar: INTRO, bars: 4, beatsPerBar: 4, steps: 16, octave: 1, vel: 0.6, dur: 3.6 }),
    bassline(homeProg, 'X.......x.......', { startBar: A, bars: 8, beatsPerBar: 4, steps: 16, octave: 1, fifths: true, vel: 0.75, dur: 1.8 }),
    bassline(driftKeyProg, 'X.......X.......', { startBar: B, bars: 8, beatsPerBar: 4, steps: 16, octave: 1, vel: 0.82, dur: 1.8 }),
    bassline(driftProg, 'X...............', { startBar: DRIFT, bars: 4, beatsPerBar: 4, steps: 16, octave: 1, vel: 0.6, dur: 3.6 }),
    bassline(a2Prog, 'X.......x.....x.', { startBar: A2, bars: 8, beatsPerBar: 4, steps: 16, octave: 1, fifths: true, vel: 0.85, dur: 1.6 }),
    bassline(marchProg, 'X...X...X...X...', { startBar: MARCH, bars: 8, beatsPerBar: 4, steps: 16, octave: 1, vel: 0.8, dur: 0.9 }),
    bassline(outroProg, 'X...............', { startBar: OUTRO, bars: 8, beatsPerBar: 4, steps: 16, octave: 1, vel: 0.55, dur: 3.6 }),
  ),
};

// ------------------------------------------------------------- percussion
// Kick is deliberately wet (reverb send), against the mixing guide's usual
// "keep drums dry" advice — the brief calls for cavernous, footsteps-in-an-
// empty-hall drums, and that reverb tail *is* the sound of the biome.
const kickTrack = {
  name: 'kick',
  instrument: 'kick' as const,
  gain: 0.8,
  pan: 0,
  send: { reverb: 0.6 },
  notes: merge(
    steps(euclid(3, 16, 1), { startBar: INTRO, bars: 4, beatsPerBar: 4, steps: 16, vel: 0.5 }, 'A1'),
    steps(euclid(4, 16, 2), { startBar: A, bars: 8, beatsPerBar: 4, steps: 16, vel: 0.65 }, 'A1'),
    steps(euclid(5, 16, 3), { startBar: B, bars: 8, beatsPerBar: 4, steps: 16, vel: 0.7 }, 'C1'),
    steps(euclid(1, 16, 0), { startBar: DRIFT, bars: 4, beatsPerBar: 4, steps: 16, vel: 0.5 }, 'A1'),
    steps(euclid(5, 16, 1), { startBar: A2, bars: 8, beatsPerBar: 4, steps: 16, vel: 0.72 }, 'A1'),
    // The march is the one place the kick goes four-on-the-floor and dry-
    // sounding-heavy — stomping feet, not distant thunder.
    steps('X...X...X...X...', { startBar: MARCH, bars: 8, beatsPerBar: 4, steps: 16, vel: 0.85 }, 'D1'),
    steps(euclid(2, 16, 0), { startBar: OUTRO, bars: 8, beatsPerBar: 4, steps: 16, vel: 0.45 }, 'A1'),
  ),
};

const tomTrack = {
  name: 'toms',
  instrument: 'tom' as const,
  gain: 0.55,
  pan: -0.2,
  send: { reverb: 0.65 },
  optional: true,
  notes: merge(
    steps(euclid(3, 16, 2), { startBar: B, bars: 8, beatsPerBar: 4, steps: 16, vel: 0.55 }, 'D2'),
    steps(euclid(2, 16, 4), { startBar: DRIFT, bars: 4, beatsPerBar: 4, steps: 16, vel: 0.6 }, 'C2'),
    steps(euclid(4, 16, 6), { startBar: A2, bars: 8, beatsPerBar: 4, steps: 16, vel: 0.6 }, 'D2'),
  ),
};

const shakerTrack = {
  name: 'shaker',
  instrument: 'shaker' as const,
  gain: 0.3,
  pan: 0.4,
  send: { reverb: 0.2 },
  optional: true,
  notes: merge(
    steps('..x...x...x...x.', { startBar: A, bars: 8, beatsPerBar: 4, steps: 16, vel: 0.35 }, 'C3'),
    steps('.x..x..x.x..x..x', { startBar: A2, bars: 8, beatsPerBar: 4, steps: 16, vel: 0.4 }, 'C3'),
  ),
};

const gongTrack = {
  name: 'gong',
  instrument: 'gong' as const,
  gain: 0.6,
  pan: 0,
  send: { reverb: 0.85 },
  optional: true,
  // Marks the "something enormous" moments — the modulation into B, the
  // dead centre of the drift bridge, the harmonic-minor swell in A2, and
  // the cold reasserting itself at the top of the outro.
  notes: merge(
    steps(oneHitPer4Bars, { startBar: B, bars: 8, beatsPerBar: 4, steps: 16, vel: 0.85 }, 'C2'),
    steps(oneHitPer4Bars, { startBar: DRIFT, bars: 4, beatsPerBar: 4, steps: 16, vel: 0.9 }, 'A1'),
    steps(oneHitPer4Bars, { startBar: A2, bars: 8, beatsPerBar: 4, steps: 16, vel: 0.85 }, 'C2'),
    steps(oneHitPer4Bars, { startBar: OUTRO, bars: 8, beatsPerBar: 4, steps: 16, vel: 0.8 }, 'A1'),
  ),
};

// ------------------------------------------------------------- the march
// Comic relief section: a flat cut to D major and a full oom-pah band.
// Tuba carries root/fifth like a sousaphone line, cowbell is pure slapstick,
// brass punches quarter-note stabs, and the snare gives it a parade backbeat.
const tubaTrack = {
  name: 'tuba',
  instrument: 'tuba' as const,
  gain: 0.72,
  pan: -0.1,
  send: { reverb: 0.15 },
  notes: bassline(marchProg, 'X...x...X...x...', { startBar: MARCH, bars: 8, beatsPerBar: 4, steps: 16, octave: 2, fifths: true, vel: 0.85, dur: 0.8 }),
};

const cowbellTrack = {
  name: 'cowbell',
  instrument: 'cowbell' as const,
  gain: 0.55,
  pan: 0.3,
  send: { reverb: 0.1 },
  notes: steps(euclid(8, 16, 1), { startBar: MARCH, bars: 8, beatsPerBar: 4, steps: 16, vel: 0.7 }, 'G3'),
};

const brassTrack = {
  name: 'brassStabs',
  instrument: 'brass' as const,
  gain: 0.5,
  pan: 0.2,
  send: { reverb: 0.25 },
  optional: true,
  notes: arp(marchProg, { startBar: MARCH, bars: 8, beatsPerBar: 4, steps: 4, shape: 'up', octaves: 1, low: 'D4', vel: 0.8 }),
};

const snareTrack = {
  name: 'snare',
  instrument: 'snare' as const,
  gain: 0.65,
  pan: 0,
  send: { reverb: 0.3 },
  optional: true,
  notes: steps('....X.......X...', { startBar: MARCH, bars: 8, beatsPerBar: 4, steps: 16, vel: 0.9 }, 'D2'),
};

export const tundra: SongDef = {
  id: 'tundra',
  title: 'Glass Wind, Iron Boots',
  biome: 'tundra',
  bpm: 92,
  beatsPerBar: 4,
  swing: 0.08,
  sections: [
    { name: 'intro', startBar: INTRO, bars: 4, key: 'A', mode: 'minor', energy: 0.18 },
    { name: 'A', startBar: A, bars: 8, key: 'A', mode: 'minor', energy: 0.5 },
    { name: 'B', startBar: B, bars: 8, key: 'C', mode: 'phrygian', energy: 0.7 },
    { name: 'drift', startBar: DRIFT, bars: 4, key: 'C', mode: 'phrygian', energy: 0.32 },
    { name: 'A2', startBar: A2, bars: 8, key: 'A', mode: 'harmonicMinor', energy: 0.82 },
    { name: 'march', startBar: MARCH, bars: 8, key: 'D', mode: 'major', energy: 1.0 },
    { name: 'outro', startBar: OUTRO, bars: 8, key: 'A', mode: 'minor', energy: 0.25 },
  ],
  chords,
  tracks: [
    bassTrack,
    padTrack,
    glassTrack,
    chimesTrack,
    whistleTrack,
    kickTrack,
    tomTrack,
    shakerTrack,
    gongTrack,
    tubaTrack,
    cowbellTrack,
    brassTrack,
    snareTrack,
  ],
  mix: { reverb: 3.4, delayBeats: 0.75, delayFeedback: 0.28, masterGain: 0.82 },
  // Loop back into section A, not the intro: outro's E7sus4 wants to fall
  // into A's opening Am9, so the seam is a real cadence, not a hard cut.
  loopFromBar: A,
};
