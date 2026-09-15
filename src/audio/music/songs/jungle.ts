/**
 * Steambloom Jungle — humid, overgrown, loud with things.
 *
 * The whole arrangement is built on a rhythmic trick: drums/shaker/cowbell
 * live on a 16-step (straight sixteenth) grid, the marimba ostinato lives on
 * a 12-step (triplet) grid, and the kalimba counter-riff lives on an 8-step
 * (eighth-note) grid — three subdivisions of the same 4 beats running at
 * once. That's the "polyrhythmic, keeps tripping over itself" feel without
 * ever leaving 4/4, and it's why nothing needed an odd meter to sound lopsided.
 */
import type { NoteEvent, SectionDef, SongDef } from '../song';
import { arp, bassline, chordTrack, euclid, melody, merge, pad, steps } from '../pattern';
import { toMidi, voiceChord } from '../theory';

// ---------------------------------------------------------------- sections
// D dorian is home. B up to F mixolydian for the "B" lift (a bright relative
// shift — F is D dorian's bVII, so the ear reads it as the same modal family
// tilted major). The "C" section wrenches down to B hungarian minor for the
// wacky stomp: the hungarian scale's raised 4th and augmented 2nd is the
// most cartoon-exotic color in theory.ts, perfect for a canopy full of things
// that shouldn't be that loud. Four key changes total (intro->A doesn't
// count, but A->B, B->A', A'->C and C->outro all do).
const SECTION_PLAN = [
  { name: 'intro', startBar: 0, bars: 4, key: 'D', mode: 'dorian' as const, energy: 0.35, whHits: 3, whRot: 0, wlHits: 2, wlRot: 6, cowHits: 2, cowRot: 0 },
  { name: 'A', startBar: 4, bars: 8, key: 'D', mode: 'dorian' as const, energy: 0.65, whHits: 5, whRot: 1, wlHits: 4, wlRot: 7, cowHits: 3, cowRot: 1 },
  { name: 'B', startBar: 12, bars: 8, key: 'F', mode: 'mixolydian' as const, energy: 0.85, whHits: 6, whRot: 2, wlHits: 5, wlRot: 8, cowHits: 4, cowRot: 2 },
  { name: "A'", startBar: 20, bars: 8, key: 'D', mode: 'dorian' as const, energy: 0.8, whHits: 7, whRot: 3, wlHits: 6, wlRot: 9, cowHits: 5, cowRot: 3 },
  { name: 'C', startBar: 28, bars: 6, key: 'B', mode: 'hungarian' as const, energy: 0.95, whHits: 5, whRot: 5, wlHits: 4, wlRot: 11, cowHits: 3, cowRot: 5 },
  { name: 'outro', startBar: 34, bars: 6, key: 'D', mode: 'dorian' as const, energy: 0.5, whHits: 4, whRot: 0, wlHits: 3, wlRot: 6, cowHits: 2, cowRot: 0 },
];

const sections: SectionDef[] = SECTION_PLAN.map(
  ({ whHits, whRot, wlHits, wlRot, cowHits, cowRot, ...s }) => s,
);

// ------------------------------------------------------------------ chords
// Dorian home base: i - IV - bVII - v (Dm9 - G7 - Cmaj7 - Am7) is the classic
// dorian vamp — the major IV (G7, not Gm) is what makes it dorian and not
// plain D minor. B section trades up to F mixolydian's own I7-IV9-bVII-ii.
// A' reuses the home progression but with hotter extensions (G13, Cmaj9,
// A7#9) to justify calling it "busier." C is built from B hungarian's
// characteristic tones, closing on a diminished vii for maximum wobble.
// Outro is a plain ii-V turnaround back to the Dm9 that opens the loop point.
const CHORDS_INTRO = ['Dm9', 'G7'];
const CHORDS_A = ['Dm9', 'G7', 'Cmaj7', 'Am7'];
const CHORDS_B = ['F13', 'Bb9', 'Eb7#11', 'Gm7'];
const CHORDS_A2 = ['Dm9', 'G13', 'Cmaj9', 'A7#9'];
const CHORDS_C = ['Bm', 'F#7#9', 'G7#11', 'A#dim7'];
const CHORDS_OUTRO = ['Dm9', 'Cmaj7', 'Am7', 'Dm9', 'Cmaj7', 'G7'];

const chords = [
  ...chordTrack(CHORDS_INTRO, 0, 4),
  ...chordTrack(CHORDS_A, 4, 8),
  ...chordTrack(CHORDS_B, 12, 8),
  ...chordTrack(CHORDS_A2, 20, 8),
  ...chordTrack(CHORDS_C, 28, 6),
  ...chordTrack(CHORDS_OUTRO, 34, 6),
];

/**
 * Cartoon big-band stabs: short close-voiced chord hits at explicit beat
 * offsets. Not in pattern.ts because a "stab" needs its own list of beat
 * positions per hit (the offbeat "and"s that make a horn section swing),
 * unlike pad()'s one-sustained-voicing-per-bar.
 */
function brassStabs(
  progression: string[],
  hitBeats: number[],
  opts: { startBar: number; bars: number; low: number | string; span?: number; vel?: number; dur?: number },
): NoteEvent[] {
  const low = toMidi(opts.low);
  const out: NoteEvent[] = [];
  for (let b = 0; b < opts.bars; b++) {
    const chord = voiceChord(progression[b % progression.length], low, opts.span ?? 14);
    for (const beat of hitBeats) {
      for (const pitch of chord) {
        out.push({ bar: opts.startBar + b, beat, dur: opts.dur ?? 0.4, pitch, vel: opts.vel ?? 0.78 });
      }
    }
  }
  return out;
}

/** Acid bass wants to glide between notes, not just retrigger. */
function withSlide(notes: readonly NoteEvent[], amount: number): NoteEvent[] {
  return notes.map((n) => ({ ...n, slide: amount }));
}

// ------------------------------------------------------------------- kick
// Hand-built syncopation per section (steps() strings, whitespace stripped)
// so the kick pushes and pulls against the straight backbeat instead of
// just walking on 1-3. C swaps to a genuine euclidean cross-rhythm — five
// hits over sixteen steps, rotated — for the one section that's allowed to
// actually stumble.
const kickIntro = steps('X... .... x... ....', { startBar: 0, bars: 4, beatsPerBar: 4, steps: 16, vel: 0.8 }, 'C2');
const kickA = steps('X..x ..x. X... x..x', { startBar: 4, bars: 8, beatsPerBar: 4, steps: 16, vel: 0.85 }, 'C2');
const kickB = steps('X.x. x..x X.x. x.x.', { startBar: 12, bars: 8, beatsPerBar: 4, steps: 16, vel: 0.88 }, 'C2');
const kickA2 = steps('X.xX ..x. X.xX ..x.', { startBar: 20, bars: 8, beatsPerBar: 4, steps: 16, vel: 0.9 }, 'C2');
const kickC = steps(euclid(5, 16, 2), { startBar: 28, bars: 6, beatsPerBar: 4, steps: 16, vel: 0.92 }, 'C2');
const kickOutro = steps('X... x... X... x...', { startBar: 34, bars: 6, beatsPerBar: 4, steps: 16, vel: 0.7 }, 'C2');

// ------------------------------------------------------------------ snare
// Backbeat stays anchored on 2 and 4 even through the wacky section — that's
// the "competent" half of "wacky but competent." Ghost notes thicken it as
// energy rises.
const snareBase = '.... X... .... X...';
const snareGhost = 'o... X... o.o. X...';
const snareIntro = steps(snareBase, { startBar: 0, bars: 4, beatsPerBar: 4, steps: 16, vel: 0.75 }, 'D3');
const snareA = steps(snareBase, { startBar: 4, bars: 8, beatsPerBar: 4, steps: 16, vel: 0.8 }, 'D3');
const snareB = steps(snareGhost, { startBar: 12, bars: 8, beatsPerBar: 4, steps: 16, vel: 0.85 }, 'D3');
const snareA2 = steps(snareGhost, { startBar: 20, bars: 8, beatsPerBar: 4, steps: 16, vel: 0.88 }, 'D3');
const snareC = steps(snareGhost, { startBar: 28, bars: 6, beatsPerBar: 4, steps: 16, vel: 0.9 }, 'D3');
const snareOutro = steps('.... X... .... ....', { startBar: 34, bars: 6, beatsPerBar: 4, steps: 16, vel: 0.7 }, 'D3');

// -------------------------------------------------------------------- toms
// A light continuous undercurrent (a euclidean 3-over-16) plus one-bar
// alternating hi/lo rolls dropped right on the seam between sections — the
// "loud with things crashing through the canopy" cue that a new part is
// about to land.
const tomFloor = steps(euclid(3, 16, 5), { startBar: 0, bars: 40, beatsPerBar: 4, steps: 16, vel: 0.45 }, 'F3');
function tomFill(bar: number): NoteEvent[] {
  return merge(
    steps('x.x. x.x. x.x. x.x.', { startBar: bar, bars: 1, beatsPerBar: 4, steps: 16, vel: 0.85 }, 'A3'),
    steps('.x.x .x.x .x.x .x.x', { startBar: bar, bars: 1, beatsPerBar: 4, steps: 16, vel: 0.8 }, 'D3'),
  );
}
const tomFills = merge(tomFill(11), tomFill(19), tomFill(27), tomFill(33));

// ----------------------------------------------------------------- shaker
// Constant swampy shimmer, thickening from quarter notes to a full sixteenth
// wash as the section energy climbs, then dropping back for the outro.
const shakerIntro = steps('x... x... x... x...', { startBar: 0, bars: 4, beatsPerBar: 4, steps: 16, vel: 0.45 }, 'A4');
const shakerA = steps('x.x. x.x. x.x. x.x.', { startBar: 4, bars: 8, beatsPerBar: 4, steps: 16, vel: 0.5 }, 'A4');
const shakerB = steps('xxxxxxxxxxxxxxxx', { startBar: 12, bars: 8, beatsPerBar: 4, steps: 16, vel: 0.42 }, 'A4');
const shakerA2 = steps('Xxxx Xxxx Xxxx Xxxx', { startBar: 20, bars: 8, beatsPerBar: 4, steps: 16, vel: 0.48 }, 'A4');
const shakerC = steps(euclid(11, 16, 3), { startBar: 28, bars: 6, beatsPerBar: 4, steps: 16, vel: 0.5 }, 'A4');
const shakerOutro = steps('x... x... x... x...', { startBar: 34, bars: 6, beatsPerBar: 4, steps: 16, vel: 0.4 }, 'A4');

// --------------------------------------------------------- woodblock + cowbell
// Two euclidean layers per section (a high and a low woodblock, hit counts
// climbing 3->7 across the build) so "layered woodblocks" is literal. Cowbell
// rides underneath on an 8-step grid — the classic big-band pulse — and gets
// dropped from the low-end mix as `optional`.
const woodblockNotes = merge(
  ...SECTION_PLAN.flatMap((s) => [
    steps(euclid(s.whHits, 16, s.whRot), { startBar: s.startBar, bars: s.bars, beatsPerBar: 4, steps: 16, vel: 0.55 }, 'C5'),
    steps(euclid(s.wlHits, 16, s.wlRot), { startBar: s.startBar, bars: s.bars, beatsPerBar: 4, steps: 16, vel: 0.48 }, 'G4'),
  ]),
);
const cowbellNotes = merge(
  ...SECTION_PLAN.map((s) =>
    steps(euclid(s.cowHits, 8, s.cowRot), { startBar: s.startBar, bars: s.bars, beatsPerBar: 4, steps: 8, vel: 0.4 }, 'G5'),
  ),
);

// ---------------------------------------------------------------- marimba
// The main hook. Lives on a 12-step (triplet) grid the whole song — that's
// the polyrhythm against everything else's straight sixteenths. Shape
// changes per section rather than the notes themselves, so the same chords
// read as a different gesture each time: up (intro, simplest statement),
// updown (A, the groove settles), pinky (B, bright top-note emphasis suits
// the mixolydian lift), thumb (A', a busier low-anchor version), random-seeded
// (C, deliberately unpredictable for the wacky section), down (outro, unwinds
// the intro's up-shape for a clean bookend).
const marimbaIntro = arp(CHORDS_INTRO, { startBar: 0, bars: 4, beatsPerBar: 4, steps: 12, shape: 'up', octaves: 1, low: 'C4', vel: 0.55, seed: 1 });
const marimbaA = arp(CHORDS_A, { startBar: 4, bars: 8, beatsPerBar: 4, steps: 12, shape: 'updown', octaves: 2, low: 'C4', vel: 0.7, seed: 2 });
const marimbaB = arp(CHORDS_B, { startBar: 12, bars: 8, beatsPerBar: 4, steps: 12, shape: 'pinky', octaves: 2, low: 'C4', vel: 0.72, seed: 3 });
const marimbaA2 = arp(CHORDS_A2, { startBar: 20, bars: 8, beatsPerBar: 4, steps: 12, shape: 'thumb', octaves: 2, low: 'C4', vel: 0.76, seed: 4 });
const marimbaC = arp(CHORDS_C, { startBar: 28, bars: 6, beatsPerBar: 4, steps: 12, shape: 'random', octaves: 2, low: 'C4', vel: 0.78, seed: 9 });
const marimbaOutro = arp(CHORDS_OUTRO, { startBar: 34, bars: 6, beatsPerBar: 4, steps: 12, shape: 'down', octaves: 1, low: 'C4', vel: 0.5, seed: 5 });

// ----------------------------------------------------------------- kalimba
// The call-and-response partner: written as scale degrees (melody()) rather
// than chord arps, on an 8-step grid, an octave above the marimba and panned
// to the opposite side, so the two mallets interlock instead of doubling.
// Degree patterns re-tune themselves through every key change for free.
const kalimbaIntro = melody([0, null, 4, null, 7, null, 4, null], { startBar: 0, bars: 4, beatsPerBar: 4, steps: 8, key: 'D', scale: 'dorian', octaveOffset: 1, vel: 0.5 });
const kalimbaA = melody([0, 2, 4, 7, 9, 7, 4, 2], { startBar: 4, bars: 8, beatsPerBar: 4, steps: 8, key: 'D', scale: 'dorian', octaveOffset: 1, vel: 0.65 });
const kalimbaB = melody([0, 4, 7, 9, 7, 4, 2, 0], { startBar: 12, bars: 8, beatsPerBar: 4, steps: 8, key: 'F', scale: 'mixolydian', octaveOffset: 1, vel: 0.68 });
const kalimbaA2 = melody([0, 4, 7, 9, 11, 9, 7, 4], { startBar: 20, bars: 8, beatsPerBar: 4, steps: 8, key: 'D', scale: 'dorian', octaveOffset: 1, vel: 0.72 });
// Hungarian's raised 4th (degree 3 -> the augmented step) is the whole joke here.
const kalimbaC = melody([0, 3, 2, 6, 7, 3, 11, null], { startBar: 28, bars: 6, beatsPerBar: 4, steps: 8, key: 'B', scale: 'hungarian', octaveOffset: 1, vel: 0.74 });
const kalimbaOutro = melody([0, null, 4, null, 2, null, 0, null], { startBar: 34, bars: 6, beatsPerBar: 4, steps: 8, key: 'D', scale: 'dorian', octaveOffset: 1, vel: 0.5 });

// -------------------------------------------------------------------- bass
// A sliding acid line (squelch, with per-note glide) under everything. The
// fifths option kicks the second half of each 8-step group up to the fifth,
// which is what keeps a one-note-per-chord bassline from feeling static.
const bassIntro = bassline(CHORDS_INTRO, 'X....... x.......', { startBar: 0, bars: 4, beatsPerBar: 4, steps: 16, octave: 2 });
const bassA = withSlide(
  bassline(CHORDS_A, 'X..x .X.. x..X .x..', { startBar: 4, bars: 8, beatsPerBar: 4, steps: 16, octave: 2, fifths: true }),
  0.05,
);
const bassB = withSlide(
  bassline(CHORDS_B, 'X.x. x.X. x.x. X.x.', { startBar: 12, bars: 8, beatsPerBar: 4, steps: 16, octave: 2, fifths: true }),
  0.06,
);
const bassA2 = withSlide(
  bassline(CHORDS_A2, 'X.xx .X.x x..X .xx.', { startBar: 20, bars: 8, beatsPerBar: 4, steps: 16, octave: 2, fifths: true }),
  0.06,
);
const bassC = withSlide(
  bassline(CHORDS_C, euclid(7, 16, 5), { startBar: 28, bars: 6, beatsPerBar: 4, steps: 16, octave: 2, fifths: true }),
  0.07,
);
const bassOutro = bassline(CHORDS_OUTRO, 'X....... x.......', { startBar: 34, bars: 6, beatsPerBar: 4, steps: 16, octave: 2 });

// ------------------------------------------------------------------- brass
// Cartoon big-band stabs on the offbeats — silent through the intro so the
// entrance at "A" reads as an arrival, then progressively more syncopated
// (more hit points, tighter offsets) as the piece gets denser. C's hits land
// on the "e" and "a" of the beat instead of the "and" — the stumble that
// makes the section feel drunk rather than just busy.
const brassA = brassStabs(CHORDS_A, [1.5, 3.5], { startBar: 4, bars: 8, low: 'F4', vel: 0.78 });
const brassB = brassStabs(CHORDS_B, [0.5, 2, 3.5], { startBar: 12, bars: 8, low: 'F4', vel: 0.82 });
const brassA2 = brassStabs(CHORDS_A2, [1, 1.5, 3, 3.5], { startBar: 20, bars: 8, low: 'F4', vel: 0.85 });
const brassC = brassStabs(CHORDS_C, [0.75, 1.5, 2.75, 3.5], { startBar: 28, bars: 6, low: 'G4', vel: 0.88 });
const brassOutro = brassStabs(CHORDS_OUTRO, [0, 2], { startBar: 34, bars: 6, low: 'F4', vel: 0.6 });

// -------------------------------------------------------- choirpad (optional)
// A slow atmospheric wash underneath the frantic percussion — humid canopy
// haze. Chords held two bars at a time (half the rate of the lead chord
// track) so it breathes instead of chattering along with everything else.
const choirpadNotes = merge(
  pad(CHORDS_INTRO, { startBar: 0, bars: 4, beatsPerBar: 4, low: 'C3', span: 16, vel: 0.22, hold: 2 }),
  pad(CHORDS_A, { startBar: 4, bars: 8, beatsPerBar: 4, low: 'C3', span: 16, vel: 0.26, hold: 2 }),
  pad(CHORDS_B, { startBar: 12, bars: 8, beatsPerBar: 4, low: 'C3', span: 16, vel: 0.28, hold: 2 }),
  pad(CHORDS_A2, { startBar: 20, bars: 8, beatsPerBar: 4, low: 'C3', span: 16, vel: 0.28, hold: 2 }),
  pad(CHORDS_C, { startBar: 28, bars: 6, beatsPerBar: 4, low: 'C3', span: 16, vel: 0.3, hold: 2 }),
  pad(CHORDS_OUTRO, { startBar: 34, bars: 6, beatsPerBar: 4, low: 'C3', span: 16, vel: 0.24, hold: 2 }),
);

// -------------------------------------------------------------- vox (optional)
// The "silly vocal blip" the brief asks for — saved entirely for the wacky
// section (plus a two-note wink right before the loop) so it reads as a
// deliberate gag, not a texture that's just always there.
const voxNotes = merge(
  melody([0, null, 6, null, 3, null, 11, null], { startBar: 28, bars: 6, beatsPerBar: 4, steps: 4, key: 'B', scale: 'hungarian', octaveOffset: 1, vel: 0.55 }),
  melody([0, null, null, null], { startBar: 38, bars: 2, beatsPerBar: 4, steps: 4, key: 'D', scale: 'dorian', octaveOffset: 1, vel: 0.45 }),
);

export const jungle: SongDef = {
  id: 'jungle',
  title: 'Steambloom Stomp',
  biome: 'jungle',
  bpm: 132,
  beatsPerBar: 4,
  // A hard-ish swing on the off-sixteenths — the "swampy" push-pull that
  // keeps a percussion-forward arrangement from feeling like a drum machine.
  swing: 0.18,
  sections,
  chords,
  tracks: [
    { name: 'kick', instrument: 'kick', gain: 0.95, notes: merge(kickIntro, kickA, kickB, kickA2, kickC, kickOutro) },
    { name: 'snare', instrument: 'snare', gain: 0.8, pan: -0.05, notes: merge(snareIntro, snareA, snareB, snareA2, snareC, snareOutro) },
    { name: 'toms', instrument: 'tom', gain: 0.6, pan: 0.35, send: { reverb: 0.15 }, notes: merge(tomFloor, tomFills) },
    { name: 'shaker', instrument: 'shaker', gain: 0.45, pan: -0.4, send: { reverb: 0.1 }, notes: merge(shakerIntro, shakerA, shakerB, shakerA2, shakerC, shakerOutro) },
    { name: 'woodblock', instrument: 'woodblock', gain: 0.55, pan: -0.6, send: { reverb: 0.2 }, notes: woodblockNotes },
    { name: 'cowbell', instrument: 'cowbell', gain: 0.35, pan: 0.55, send: { reverb: 0.15 }, optional: true, notes: cowbellNotes },
    { name: 'marimba', instrument: 'marimba', gain: 0.68, pan: -0.25, send: { reverb: 0.25 }, notes: merge(marimbaIntro, marimbaA, marimbaB, marimbaA2, marimbaC, marimbaOutro) },
    { name: 'kalimba', instrument: 'kalimba', gain: 0.6, pan: 0.3, send: { reverb: 0.22, delay: 0.15 }, notes: merge(kalimbaIntro, kalimbaA, kalimbaB, kalimbaA2, kalimbaC, kalimbaOutro) },
    { name: 'bass', instrument: 'squelch', gain: 0.85, notes: merge(bassIntro, bassA, bassB, bassA2, bassC, bassOutro) },
    { name: 'brass', instrument: 'brass', gain: 0.72, pan: 0.1, send: { reverb: 0.3 }, notes: merge(brassA, brassB, brassA2, brassC, brassOutro) },
    { name: 'canopy-pad', instrument: 'choirpad', gain: 0.3, send: { reverb: 0.5 }, optional: true, notes: choirpadNotes },
    { name: 'vox-blip', instrument: 'vox', gain: 0.4, pan: -0.15, send: { reverb: 0.2, delay: 0.2 }, optional: true, notes: voxNotes },
  ],
  mix: { reverb: 1.6, delayBeats: 0.375, delayFeedback: 0.3, masterGain: 0.88 },
  // Skips the sparse intro on repeat — A's Dm9 is the same chord the outro's
  // closing G7 resolves into, so the seam lands as a clean V-i cadence.
  loopFromBar: 4,
};
