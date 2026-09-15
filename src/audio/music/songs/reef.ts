/**
 * "Bubblewrack Reef" — iridescent, hyperactive, liquid.
 *
 * Harmonic plan: everything is built on major-7th/9th chords in Lydian (the
 * raised 4th is the "shimmer" of light refracting through water) with one
 * dominant-flavoured Mixolydian stretch for contrast. The song modulates
 * *down* twice — C -> A -> C -> Ab -> C — each drop voiced as a lurch rather
 * than a smooth pivot, standing in for the reef sinking deeper before
 * bobbing back to the surface for the loop.
 *
 * Rhythm section is deliberately kick/snare-light: shakers and rimshots
 * carry the pulse (bubbles and clicking shrimp, not a drum kit), a reese
 * bass supplies the only low-end weight, and a single soft kick just pins
 * the downbeat without ever reading as a backbeat.
 */
import type { SongDef } from '../song';
import { arp, bassline, chordTrack, euclid, melody, merge, pad, steps } from '../pattern';

const BPB = 4;

// ---- sections -------------------------------------------------------
// intro(4) + A(8) + B(8, key change) + A'(8, key change home) +
// wacky(8, key change deeper) + outro(4, key change home) = 40 bars.
const INTRO = { start: 0, bars: 4 };
const A = { start: 4, bars: 8 };
const B = { start: 12, bars: 8 };
const A2 = { start: 20, bars: 8 };
const WACKY = { start: 28, bars: 8 };
const OUTRO = { start: 36, bars: 4 };

// ---- harmony ----------------------------------------------------------
// Home: C Lydian. The Dmaj9 (built on the *2nd* degree) is the payoff chord
// — a major triad a whole step above the tonic is what actually spells out
// the Lydian #11 against a C bass, so it recurs in every home progression.
const introProg = ['Cmaj9', 'Dmaj9'];
const aProg = ['Cmaj9', 'Dmaj9', 'Em7', 'Gmaj9'];
// Sink #1: down a minor 3rd to A Mixolydian — same shimmer, dominant grit.
const bProg = ['A9', 'D9', 'Bm7', 'E7sus4'];
// Home again, reharmonised (Am7 instead of Em7) so the return isn't a copy.
const a2Prog = ['Cmaj9', 'Dmaj9', 'Am7', 'Gmaj9'];
// Sink #2: down a major 3rd further to Ab Lydian — the deepest, wackiest
// water. Exact transposition of aProg's shape (-4 semitones) so the same
// harmonic *function* returns in a new, murkier key.
const wackyProg = ['Abmaj9', 'Bbmaj9', 'Cm7', 'Ebmaj9'];
// Turnaround back up to the surface, resolving onto the Cmaj9 the loop point
// (bar 4) also opens on — that's what makes loopFromBar a clean seam.
const outroProg = ['Gmaj9', 'Am7', 'Dmaj9', 'Cmaj9'];

// chordTrack() returns ChordEvent[], not NoteEvent[] — merge() is typed for
// notes only, so the chord track is just concatenated directly.
const chords = [
  ...chordTrack(introProg, INTRO.start, INTRO.bars, 2),
  ...chordTrack(aProg, A.start, A.bars, 2),
  ...chordTrack(bProg, B.start, B.bars, 2),
  ...chordTrack(a2Prog, A2.start, A2.bars, 2),
  ...chordTrack(wackyProg, WACKY.start, WACKY.bars, 1),
  ...chordTrack(outroProg, OUTRO.start, OUTRO.bars, 1),
];

// ---- pluck arpeggio: the burble ---------------------------------------
// Karplus-Strong `pluck` through a heavy delay send is the "bubbles rising"
// texture. Shape changes per section so it never just loops: 'up' (intro,
// simple), 'updown' (home, rolling), 'thumb' (B, pedal-heavy under the
// dominant chords), 'pinky' (wacky, top-note glitter).
const arpTrack = merge(
  arp(introProg, { startBar: INTRO.start, bars: INTRO.bars, beatsPerBar: BPB, steps: 16, shape: 'up', octaves: 1, low: 'C4', vel: 0.4 }),
  arp(aProg, { startBar: A.start, bars: A.bars, beatsPerBar: BPB, steps: 16, shape: 'updown', octaves: 2, low: 'C4', vel: 0.55 }),
  arp(bProg, { startBar: B.start, bars: B.bars, beatsPerBar: BPB, steps: 16, shape: 'thumb', octaves: 2, low: 'A3', vel: 0.62 }),
  arp(a2Prog, { startBar: A2.start, bars: A2.bars, beatsPerBar: BPB, steps: 16, shape: 'updown', octaves: 2, low: 'C4', vel: 0.65 }),
  arp(wackyProg, { startBar: WACKY.start, bars: WACKY.bars, beatsPerBar: BPB, steps: 16, shape: 'pinky', octaves: 2, low: 'Ab3', vel: 0.7 }),
  arp(outroProg, { startBar: OUTRO.start, bars: OUTRO.bars, beatsPerBar: BPB, steps: 16, shape: 'down', octaves: 1, low: 'C4', vel: 0.45 }),
);

// ---- reese bass: rubbery low end ---------------------------------------
// Patterns built from 4-char groups so the 16-step length is exact by
// construction. Syncopation increases with section energy; fifths kick in
// once the groove is established for extra bounce.
const bassIntroPat = 'x...' + '....' + 'x...' + '....';
const bassAPat = 'x.x.' + 'x...' + 'x.x.' + '..x.';
const bassBPat = 'x.x.' + 'x.xx' + 'x.x.' + 'x.x.';
const bassA2Pat = 'xx.x' + 'x.x.' + 'xx.x' + 'x.x.';
const bassWackyPat = 'x.xx' + '.x.x' + 'x.xx' + '.x.x';
const bassOutroPat = 'x...' + 'x.x.' + '....' + 'x...';

const bass = merge(
  bassline(introProg, bassIntroPat, { startBar: INTRO.start, bars: INTRO.bars, beatsPerBar: BPB, steps: 16, octave: 2, vel: 0.55 }),
  bassline(aProg, bassAPat, { startBar: A.start, bars: A.bars, beatsPerBar: BPB, steps: 16, octave: 2, fifths: true, vel: 0.72 }),
  bassline(bProg, bassBPat, { startBar: B.start, bars: B.bars, beatsPerBar: BPB, steps: 16, octave: 2, fifths: true, vel: 0.8 }),
  bassline(a2Prog, bassA2Pat, { startBar: A2.start, bars: A2.bars, beatsPerBar: BPB, steps: 16, octave: 2, fifths: true, vel: 0.78 }),
  bassline(wackyProg, bassWackyPat, { startBar: WACKY.start, bars: WACKY.bars, beatsPerBar: BPB, steps: 16, octave: 2, fifths: true, vel: 0.85 }),
  bassline(outroProg, bassOutroPat, { startBar: OUTRO.start, bars: OUTRO.bars, beatsPerBar: BPB, steps: 16, octave: 2, vel: 0.6 }),
);

// ---- glass bells: the hook ----------------------------------------------
// Degree-based so it retunes automatically at every key change — the same
// hook shape survives both sinks, which is what makes the modulations read
// as the *same idea* lurching downward rather than a new song each time.
// Degree 3 (the raised 4th) is placed on a strong 8th so the Lydian colour
// is unmistakeable, not just implied by the chords underneath.
const homeMotif = [0, null, 4, 2, null, 7, 4, null, 3, null, 4, 0, null, 6, 4, null];
const introMotif = [0, null, null, 4, null, null, null, null, 0, null, null, null, 7, null, null, null];
const wackyMotif = [0, 2, 4, 7, 4, 2, 3, 4, 9, 7, 4, 2, 0, 3, 4, 7];
const outroMotif = [0, null, 4, null, 7, null, 4, null, 0, null, null, null, null, null, null, null];

const bells = merge(
  melody(introMotif, { startBar: INTRO.start, bars: INTRO.bars, beatsPerBar: BPB, steps: 8, key: 'C5', scale: 'lydian', vel: 0.45 }),
  melody(homeMotif, { startBar: A.start, bars: A.bars, beatsPerBar: BPB, steps: 8, key: 'C5', scale: 'lydian', vel: 0.7 }),
  melody(homeMotif, { startBar: B.start, bars: B.bars, beatsPerBar: BPB, steps: 8, key: 'A4', scale: 'mixolydian', vel: 0.75 }),
  melody(homeMotif, { startBar: A2.start, bars: A2.bars, beatsPerBar: BPB, steps: 8, key: 'C5', scale: 'lydian', vel: 0.78 }),
  melody(wackyMotif, { startBar: WACKY.start, bars: WACKY.bars, beatsPerBar: BPB, steps: 8, key: 'Ab4', scale: 'lydian', vel: 0.85 }),
  melody(outroMotif, { startBar: OUTRO.start, bars: OUTRO.bars, beatsPerBar: BPB, steps: 8, key: 'C5', scale: 'lydian', vel: 0.5 }),
);

// ---- vox blips: comic accents --------------------------------------------
// `vox`'s formant-swept pulse is the game's dedicated silly voice; used here
// as punctuation, not melody, so it stays funny instead of grating. Optional
// — the arrangement holds up on low-end devices without it.
const blipMotif = [null, null, 7, null, null, null, null, 4, null, null, null, 9, null, null, null, null];
const blipWackyMotif = [null, 7, null, 4, null, 9, null, 7, null, 4, null, 2, null, 7, null, 9];

const blips = merge(
  melody(blipMotif, { startBar: A.start, bars: A.bars, beatsPerBar: BPB, steps: 16, key: 'C5', scale: 'lydian', vel: 0.55, dur: 0.3 }),
  melody(blipMotif, { startBar: B.start, bars: B.bars, beatsPerBar: BPB, steps: 16, key: 'A5', scale: 'mixolydian', vel: 0.6, dur: 0.3 }),
  melody(blipMotif, { startBar: A2.start, bars: A2.bars, beatsPerBar: BPB, steps: 16, key: 'C5', scale: 'lydian', vel: 0.65, dur: 0.3 }),
  melody(blipWackyMotif, { startBar: WACKY.start, bars: WACKY.bars, beatsPerBar: BPB, steps: 16, key: 'Ab5', scale: 'lydian', vel: 0.72, dur: 0.28 }),
);

// ---- kalimba countermelody: extra burble ---------------------------------
// A second, physically-modelled pluck voice (organic, contrasts with the
// synthetic `pluck` arp) that only shows up once the groove is established,
// random-shaped so it never mirrors the main arp exactly.
const counter = merge(
  arp(a2Prog, { startBar: A2.start, bars: A2.bars, beatsPerBar: BPB, steps: 8, shape: 'random', seed: 3, octaves: 1, low: 'C5', vel: 0.4 }),
  arp(wackyProg, { startBar: WACKY.start, bars: WACKY.bars, beatsPerBar: BPB, steps: 8, shape: 'random', seed: 5, octaves: 1, low: 'Ab4', vel: 0.45 }),
);

// ---- pad: sustained wash --------------------------------------------------
// `choirpad`'s breathy formant filters are the "underwater ambience" —
// register kept in the 52-72 zone the docs recommend so it sits under the
// bells without fighting them.
const padTrack = merge(
  pad(introProg, { startBar: INTRO.start, bars: INTRO.bars, beatsPerBar: BPB, low: 'C4', span: 14, hold: 2, vel: 0.32 }),
  pad(aProg, { startBar: A.start, bars: A.bars, beatsPerBar: BPB, low: 'C4', span: 14, hold: 2, vel: 0.4 }),
  pad(bProg, { startBar: B.start, bars: B.bars, beatsPerBar: BPB, low: 'A3', span: 14, hold: 2, vel: 0.46 }),
  pad(a2Prog, { startBar: A2.start, bars: A2.bars, beatsPerBar: BPB, low: 'C4', span: 14, hold: 2, vel: 0.44 }),
  pad(wackyProg, { startBar: WACKY.start, bars: WACKY.bars, beatsPerBar: BPB, low: 'Ab3', span: 14, hold: 1, vel: 0.48 }),
  pad(outroProg, { startBar: OUTRO.start, bars: OUTRO.bars, beatsPerBar: BPB, low: 'C4', span: 14, hold: 1, vel: 0.38 }),
);

// ---- percussion: shaker + rim carry the pulse, kick just pins it --------
// Euclidean rhythms (exact length by construction) instead of a backbeat —
// the brief calls for shakers and rimshots in place of kick/snare, so there
// is no snare/clap track at all; the kick is a single soft downbeat ping.
const shaker = merge(
  steps(euclid(9, 16, 0), { startBar: INTRO.start, bars: INTRO.bars, beatsPerBar: BPB, steps: 16, vel: 0.35 }, 60),
  steps(euclid(11, 16, 2), { startBar: A.start, bars: A.bars, beatsPerBar: BPB, steps: 16, vel: 0.45 }, 60),
  steps(euclid(13, 16, 3), { startBar: B.start, bars: B.bars, beatsPerBar: BPB, steps: 16, vel: 0.5 }, 60),
  steps(euclid(11, 16, 2), { startBar: A2.start, bars: A2.bars, beatsPerBar: BPB, steps: 16, vel: 0.5 }, 60),
  steps(euclid(13, 16, 5), { startBar: WACKY.start, bars: WACKY.bars, beatsPerBar: BPB, steps: 16, vel: 0.58 }, 60),
  steps(euclid(9, 16, 0), { startBar: OUTRO.start, bars: OUTRO.bars, beatsPerBar: BPB, steps: 16, vel: 0.4 }, 60),
);

const rim = merge(
  steps(euclid(3, 16, 2), { startBar: INTRO.start, bars: INTRO.bars, beatsPerBar: BPB, steps: 16, vel: 0.5 }, 72),
  steps(euclid(5, 16, 3), { startBar: A.start, bars: A.bars, beatsPerBar: BPB, steps: 16, vel: 0.65 }, 74),
  steps(euclid(7, 16, 5), { startBar: B.start, bars: B.bars, beatsPerBar: BPB, steps: 16, vel: 0.7 }, 74),
  steps(euclid(5, 16, 3), { startBar: A2.start, bars: A2.bars, beatsPerBar: BPB, steps: 16, vel: 0.7 }, 74),
  steps(euclid(7, 16, 6), { startBar: WACKY.start, bars: WACKY.bars, beatsPerBar: BPB, steps: 16, vel: 0.78 }, 76),
  steps(euclid(3, 16, 2), { startBar: OUTRO.start, bars: OUTRO.bars, beatsPerBar: BPB, steps: 16, vel: 0.55 }, 72),
);

const kickIntroPat = 'x...' + '....' + '....' + '....';
const kickGroovePat = 'x...' + '....' + 'x...' + '....';
const kickWackyPat = 'x...' + '..x.' + 'x...' + '..x.';

const kick = merge(
  steps(kickIntroPat, { startBar: INTRO.start, bars: INTRO.bars, beatsPerBar: BPB, steps: 16, vel: 0.5 }, 36),
  steps(kickGroovePat, { startBar: A.start, bars: A.bars, beatsPerBar: BPB, steps: 16, vel: 0.6 }, 36),
  steps(kickGroovePat, { startBar: B.start, bars: B.bars, beatsPerBar: BPB, steps: 16, vel: 0.65 }, 36),
  steps(kickGroovePat, { startBar: A2.start, bars: A2.bars, beatsPerBar: BPB, steps: 16, vel: 0.65 }, 36),
  steps(kickWackyPat, { startBar: WACKY.start, bars: WACKY.bars, beatsPerBar: BPB, steps: 16, vel: 0.7 }, 36),
  steps(kickIntroPat, { startBar: OUTRO.start, bars: OUTRO.bars, beatsPerBar: BPB, steps: 16, vel: 0.5 }, 36),
);

export const reef: SongDef = {
  id: 'reef',
  title: 'Bubblewrack Reef',
  biome: 'reef',
  bpm: 138,
  beatsPerBar: BPB,
  swing: 0.16,
  sections: [
    { name: 'intro', startBar: INTRO.start, bars: INTRO.bars, key: 'C', mode: 'lydian', energy: 0.28 },
    { name: 'A', startBar: A.start, bars: A.bars, key: 'C', mode: 'lydian', energy: 0.62 },
    { name: 'B', startBar: B.start, bars: B.bars, key: 'A', mode: 'mixolydian', energy: 0.85 }, // sink #1
    { name: "A'", startBar: A2.start, bars: A2.bars, key: 'C', mode: 'lydian', energy: 0.78 }, // back to the surface
    { name: 'wacky', startBar: WACKY.start, bars: WACKY.bars, key: 'Ab', mode: 'lydian', energy: 0.95 }, // sink #2
    { name: 'outro', startBar: OUTRO.start, bars: OUTRO.bars, key: 'C', mode: 'lydian', energy: 0.4 }, // resolves home
  ],
  chords,
  tracks: [
    { name: 'bells', instrument: 'glass', gain: 0.6, pan: 0.2, send: { reverb: 0.4, delay: 0.3 }, notes: bells },
    { name: 'arp', instrument: 'pluck', gain: 0.5, pan: -0.15, send: { reverb: 0.35, delay: 0.45 }, notes: arpTrack },
    { name: 'bass', instrument: 'reese', gain: 0.75, pan: 0, send: { reverb: 0, delay: 0.05 }, notes: bass },
    { name: 'pad', instrument: 'choirpad', gain: 0.5, pan: 0, send: { reverb: 0.55, delay: 0.15 }, notes: padTrack },
    { name: 'blips', instrument: 'vox', gain: 0.4, pan: -0.3, send: { reverb: 0.3, delay: 0.25 }, notes: blips, optional: true },
    { name: 'counter', instrument: 'kalimba', gain: 0.35, pan: 0.5, send: { reverb: 0.4, delay: 0.35 }, notes: counter, optional: true },
    { name: 'shaker', instrument: 'shaker', gain: 0.4, pan: 0.4, send: { reverb: 0.2 }, notes: shaker },
    { name: 'rim', instrument: 'rim', gain: 0.55, pan: -0.2, send: { reverb: 0.25 }, notes: rim },
    { name: 'kick', instrument: 'kick', gain: 0.5, pan: 0, send: { reverb: 0 }, notes: kick, optional: true },
  ],
  mix: { reverb: 3.2, delayBeats: 0.375, delayFeedback: 0.4, masterGain: 0.85 },
  // Loops from the top of A, not bar 0 — skips the sparse intro on repeat
  // and lands on the same Cmaj9 the outro turnaround resolves into.
  loopFromBar: A.start,
};
