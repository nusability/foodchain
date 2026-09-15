/**
 * Cinder Caldera — the final biome. Molten, apocalyptic, and extremely
 * silly about it: a wall of distorted supersaws, a reese-vs-squelch bass
 * duel, four-on-the-floor kicks with gongs, and a cartoon brass fanfare
 * that thinks it's scoring the end of the world (it is, a little).
 *
 * Harmonic-minor colour throughout (the raised leading tone gives the
 * augmented-triad and diminished-7th "evil" chords their bite), with an
 * octatonic detour for the boss-phase breakdown and a dead-straight
 * cheap-triumphant modulation for the finale.
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
  withVelocity,
} from '../pattern';

const BPB = 4;
const STEPS = 16;

// ---------------------------------------------------------------- form
// intro 4 | A 8 | B 8 (up a m3, F harmonic minor) | A2 8 (home) |
// C 6 (octatonic breakdown, still "home" root) | Final 10 (up a m3 again,
// F harmonic minor, Picardy-third payoff) = 44 bars.
const INTRO = { start: 0, bars: 4 };
const A = { start: 4, bars: 8 };
const B = { start: 12, bars: 8 };
const A2 = { start: 20, bars: 8 };
const C = { start: 28, bars: 6 };
const FIN = { start: 34, bars: 10 };

// ------------------------------------------------------------- harmony
// D harmonic minor: D E F G A Bb C#. Dmmaj7 (minor tonic w/ the raised
// 7th) and Faug (the bIII+ that only harmonic minor gives you for free)
// are the signature "evil" chords; A7b9/A7#9 lean on that same raised
// leading tone as the dominant.
const introProg = ['Dmmaj7', 'Gm7', 'A7b9', 'Dmmaj7'];
const aProg = ['Dmmaj7', 'Bbmaj7', 'Gm7', 'A7b9', 'Dmmaj7', 'Faug', 'C#dim7', 'A7#9'];

// Key change #1: up a minor third to F harmonic minor for section B — the
// bass duel gets meaner and the brass shows up for the first time.
const bProg = ['Fmmaj7', 'Dbmaj7', 'Bbm7', 'C7b9', 'Fmmaj7', 'Abaug', 'Edim7', 'C7#9'];

// Key change #2: back home to D, but richer voicings (9ths/11ths/13ths)
// now that the whole band is in.
const a2Prog = ['Dm9', 'Bbmaj9', 'Gm11', 'A13', 'Dmmaj7', 'Faug', 'C#dim7', 'A7#9'];

// Key change #3: same D root, octatonic mode — root motion in minor
// thirds (D-F-Ab-B) is the classic symmetric-diminished move and it
// makes the whole breakdown feel like it's lurching sideways.
const cProg = ['D7#9', 'F7#9', 'Ab7#9', 'B7#9', 'D7#9', 'F7#9'];

// Key change #4: the big one. Up a minor third to F harmonic minor again
// for the finale — same key as section B, but this time it lands on a
// bald Fmaj7 Picardy third at the very end. Nothing subtle about it; a
// molten-apocalypse victory lap earns a cheap key change played straight.
const finProg = [
  'Fmmaj7', 'Dbmaj7', 'Bbm7', 'C7b9', 'Fmmaj7', 'Abaug', 'Edim7', 'C7#9', 'Bbmaj9', 'Fmaj7',
];

const chords = [
  ...chordTrack(introProg, INTRO.start, INTRO.bars),
  ...chordTrack(aProg, A.start, A.bars),
  ...chordTrack(bProg, B.start, B.bars),
  ...chordTrack(a2Prog, A2.start, A2.bars),
  ...chordTrack(cProg, C.start, C.bars),
  ...chordTrack(finProg, FIN.start, FIN.bars),
];

// ------------------------------------------------------------- drums
// One-bar "X..." accent stabs for crash/gong hits, reused at structural
// downbeats — every section entrance gets one so the modulations land.
const hit = (bar: number, pitch: string, instrumentVel = 0.9) =>
  steps('X...............', { startBar: bar, bars: 1, beatsPerBar: BPB, steps: STEPS, vel: instrumentVel }, pitch);

// Descending four-hit tom fill, one octave spread, for transition bars.
const tomFill = (bar: number) =>
  merge(
    steps('x...............', { startBar: bar, bars: 1, beatsPerBar: BPB, steps: STEPS }, 'A3'),
    steps('....x...........', { startBar: bar, bars: 1, beatsPerBar: BPB, steps: STEPS }, 'F3'),
    steps('........x.......', { startBar: bar, bars: 1, beatsPerBar: BPB, steps: STEPS }, 'D3'),
    steps('............X...', { startBar: bar, bars: 1, beatsPerBar: BPB, steps: STEPS, vel: 1 }, 'A2'),
  );

// Sparse cold-open pulse: beat 1 strong, beat 3 a whisper.
const kickIntro = steps('X.......x.......', { startBar: INTRO.start, bars: INTRO.bars, beatsPerBar: BPB, steps: STEPS }, 'C2');
// The main stomp: four-on-the-floor with a pickup 16th before the next
// bar — that pickup is what makes it feel like it's lunging forward.
const FOUR_FLOOR = 'X...x...x...x.x.';
const kickA = steps(FOUR_FLOOR, { startBar: A.start, bars: A.bars, beatsPerBar: BPB, steps: STEPS }, 'C2');
const kickB = steps(FOUR_FLOOR, { startBar: B.start, bars: B.bars, beatsPerBar: BPB, steps: STEPS }, 'C2');
// A2 adds an extra 16th right after beat 1 — the groove tightens as the
// arrangement fills in.
const kickA2 = steps('X.x.x...x.x.x.x.', { startBar: A2.start, bars: A2.bars, beatsPerBar: BPB, steps: STEPS }, 'C2');
// The octatonic breakdown lurches instead of stomping — an off-kilter
// Euclidean 7-over-16 rather than a clean four-on-the-floor.
const kickC = steps(euclid(7, STEPS, 1), { startBar: C.start, bars: C.bars, beatsPerBar: BPB, steps: STEPS }, 'C2');
// Finale: maximal stomp, kicking every 8th note straight through.
const kickFinal = steps('X.x.x.x.x.x.x.x.', { startBar: FIN.start, bars: FIN.bars, beatsPerBar: BPB, steps: STEPS }, 'C2');

const kick = { name: 'kick', instrument: 'kick' as const, gain: 1.0, pan: 0,
  notes: merge(kickIntro, kickA, kickB, kickA2, kickC, kickFinal) };

const BACKBEAT = '....X.......X...';
const BUSY_BACKBEAT = '..o.X...o...X..o';
const snare = { name: 'snare', instrument: 'snare' as const, gain: 0.85, pan: 0, send: { reverb: 0.15 },
  notes: merge(
    steps(BACKBEAT, { startBar: A.start, bars: A.bars, beatsPerBar: BPB, steps: STEPS }, 'D3'),
    steps(BACKBEAT, { startBar: B.start, bars: B.bars, beatsPerBar: BPB, steps: STEPS }, 'D3'),
    steps(BUSY_BACKBEAT, { startBar: A2.start, bars: A2.bars, beatsPerBar: BPB, steps: STEPS }, 'D3'),
    steps(euclid(5, STEPS, 6), { startBar: C.start, bars: C.bars, beatsPerBar: BPB, steps: STEPS }, 'D3'),
    steps(BUSY_BACKBEAT, { startBar: FIN.start, bars: FIN.bars, beatsPerBar: BPB, steps: STEPS }, 'D3'),
  ) };

const hats = { name: 'hats', instrument: 'hat' as const, gain: 0.4, pan: -0.15, send: { reverb: 0 },
  notes: merge(
    steps('x...x...x...x...', { startBar: INTRO.start, bars: INTRO.bars, beatsPerBar: BPB, steps: STEPS }, 'F#4'),
    steps('x.x.x.x.x.x.x.x.', { startBar: A.start, bars: A.bars, beatsPerBar: BPB, steps: STEPS }, 'F#4'),
    steps('x.x.x.x.x.x.x.x.', { startBar: B.start, bars: B.bars, beatsPerBar: BPB, steps: STEPS }, 'F#4'),
    steps('x.x.x.x.x.x.x.x.', { startBar: A2.start, bars: A2.bars, beatsPerBar: BPB, steps: STEPS }, 'F#4'),
    steps(euclid(9, STEPS, 2), { startBar: C.start, bars: C.bars, beatsPerBar: BPB, steps: STEPS }, 'F#4'),
    steps('x.x.x.x.x.x.x.x.', { startBar: FIN.start, bars: FIN.bars, beatsPerBar: BPB, steps: STEPS }, 'F#4'),
  ) };

const openhats = { name: 'openhats', instrument: 'openhat' as const, gain: 0.32, pan: 0.2, optional: true,
  send: { reverb: 0.1 },
  notes: merge(
    steps('......o.......o.', { startBar: A.start, bars: A.bars, beatsPerBar: BPB, steps: STEPS }, 'F#4'),
    steps('......o.......o.', { startBar: B.start, bars: B.bars, beatsPerBar: BPB, steps: STEPS }, 'F#4'),
    steps('......o.......o.', { startBar: A2.start, bars: A2.bars, beatsPerBar: BPB, steps: STEPS }, 'F#4'),
    steps('......o.......o.', { startBar: FIN.start, bars: FIN.bars, beatsPerBar: BPB, steps: STEPS }, 'F#4'),
  ) };

const toms = { name: 'toms', instrument: 'tom' as const, gain: 0.75, pan: 0.1, send: { reverb: 0.2 },
  notes: merge(
    tomFill(INTRO.start + 3),
    tomFill(A.start + A.bars - 1),
    tomFill(B.start + B.bars - 1),
    tomFill(A2.start + A2.bars - 1),
    // Toms drive the whole octatonic breakdown, not just its edges —
    // "pounding kicks with tom fills" means toms get to be a lead voice.
    steps(euclid(6, STEPS, 3), { startBar: C.start, bars: C.bars, beatsPerBar: BPB, steps: STEPS }, 'G3'),
    steps(euclid(5, STEPS, 0), { startBar: C.start, bars: C.bars, beatsPerBar: BPB, steps: STEPS }, 'D3'),
    tomFill(FIN.start + FIN.bars - 1),
  ) };

const crash = { name: 'crash', instrument: 'crash' as const, gain: 0.55, pan: -0.3, send: { reverb: 0.4 },
  notes: merge(
    hit(INTRO.start, 'A3'),
    hit(A.start, 'A3'),
    hit(B.start, 'A3'),
    hit(A2.start, 'A3'),
    hit(C.start, 'A3'),
    hit(FIN.start, 'A3'),
    hit(FIN.start + FIN.bars - 1, 'A3'),
  ) };

// Gongs mark the key changes specifically — every modulation gets a
// gong, nothing else does. That's the whole apocalyptic-fanfare joke.
const gong = { name: 'gongs', instrument: 'gong' as const, gain: 0.6, pan: 0.25, send: { reverb: 0.5 },
  notes: merge(
    hit(INTRO.start, 'D2'),
    hit(B.start, 'F2'),
    hit(C.start, 'D2'),
    hit(FIN.start, 'F2'),
  ) };

// "More cowbell" is not a request, it's a requirement for a comic
// tower-defense apocalypse. Reserved for the wacky section and the finale.
const cowbell = { name: 'cowbell', instrument: 'cowbell' as const, gain: 0.4, pan: -0.1, optional: true,
  notes: merge(
    steps(euclid(5, STEPS, 3), { startBar: C.start, bars: C.bars, beatsPerBar: BPB, steps: STEPS }, 'A4'),
    steps(euclid(5, STEPS, 3), { startBar: FIN.start, bars: FIN.bars, beatsPerBar: BPB, steps: STEPS }, 'A4'),
  ) };

// ------------------------------------------------------------- bass duel
// Reese locks to the kick's rhythm (same pattern as FOUR_FLOOR) so the
// low end reads as one huge instrument; squelch answers in the gaps the
// kick leaves open, one octave up, so the two basses trade blows instead
// of colliding.
const REESE_RHYTHM = FOUR_FLOOR;
const SQUELCH_RHYTHM = '..x...x...x....x';

const reeseBass = { name: 'reeseBass', instrument: 'reese' as const, gain: 0.85, pan: -0.12,
  notes: merge(
    bassline(introProg, 'X...............', { startBar: INTRO.start, bars: INTRO.bars, beatsPerBar: BPB, steps: STEPS, octave: 2 }),
    bassline(aProg, REESE_RHYTHM, { startBar: A.start, bars: A.bars, beatsPerBar: BPB, steps: STEPS, octave: 2, fifths: true }),
    bassline(bProg, REESE_RHYTHM, { startBar: B.start, bars: B.bars, beatsPerBar: BPB, steps: STEPS, octave: 2, fifths: true }),
    bassline(a2Prog, REESE_RHYTHM, { startBar: A2.start, bars: A2.bars, beatsPerBar: BPB, steps: STEPS, octave: 2, fifths: true }),
    bassline(cProg, euclid(7, STEPS, 1), { startBar: C.start, bars: C.bars, beatsPerBar: BPB, steps: STEPS, octave: 2 }),
    bassline(finProg, REESE_RHYTHM, { startBar: FIN.start, bars: FIN.bars, beatsPerBar: BPB, steps: STEPS, octave: 2, fifths: true }),
  ) };

const squelchBass = { name: 'squelchBass', instrument: 'squelch' as const, gain: 0.6, pan: 0.18, send: { delay: 0.12 },
  notes: merge(
    // Silent through the intro — the duel kicks off with the full groove.
    bassline(aProg, SQUELCH_RHYTHM, { startBar: A.start, bars: A.bars, beatsPerBar: BPB, steps: STEPS, octave: 3 }),
    bassline(bProg, SQUELCH_RHYTHM, { startBar: B.start, bars: B.bars, beatsPerBar: BPB, steps: STEPS, octave: 3 }),
    bassline(a2Prog, SQUELCH_RHYTHM, { startBar: A2.start, bars: A2.bars, beatsPerBar: BPB, steps: STEPS, octave: 3 }),
    bassline(cProg, euclid(6, STEPS, 9), { startBar: C.start, bars: C.bars, beatsPerBar: BPB, steps: STEPS, octave: 3 }),
    bassline(finProg, SQUELCH_RHYTHM, { startBar: FIN.start, bars: FIN.bars, beatsPerBar: BPB, steps: STEPS, octave: 3 }),
  ) };

// ------------------------------------------------------------- lead riff
// Written as scale degrees so the identical hook re-harmonises correctly
// at every modulation (melody() retunes it to whatever key/scale it's
// given) — the "same riff, new key" trick is what sells the key changes
// as the *same song getting bigger*, not a different song.
const riffDrive: Array<number | null> = [0, 2, 4, 6, 7, 6, 4, 2, 0, null, 4, 6, 9, 7, 4, null];
const riffLeap: Array<number | null> = [0, null, 4, 7, 9, 7, 4, null, 2, 4, 6, 9, 11, 9, 6, null];
// Octatonic variant for the breakdown — same rhythmic shape, angrier
// intervals, because the scale itself is the wacky choice here.
const riffOctatonic: Array<number | null> = [0, 3, 5, 7, 8, 7, 5, 3, 0, null, 7, 8, 10, 8, 5, null];

function riffFor(key: string, scale: 'harmonicMinor' | 'octatonic', start: number, bars: number, degrees: Array<number | null>, octaveOffset = 0) {
  const halves: ReturnType<typeof melody>[] = [];
  let bar = start;
  let remaining = bars;
  let useLeap = false;
  while (remaining > 0) {
    const chunk = Math.min(4, remaining);
    halves.push(
      melody(useLeap ? riffLeap : degrees, { startBar: bar, bars: chunk, beatsPerBar: BPB, steps: STEPS, key, scale, octaveOffset }),
    );
    bar += chunk;
    remaining -= chunk;
    useLeap = !useLeap;
  }
  return merge(...halves);
}

const leadRiff = { name: 'leadRiff', instrument: 'supersaw' as const, gain: 0.7, pan: 0, send: { reverb: 0.25, delay: 0.2 },
  notes: merge(
    riffFor('D', 'harmonicMinor', A.start, A.bars, riffDrive),
    riffFor('F', 'harmonicMinor', B.start, B.bars, riffDrive),
    riffFor('D', 'harmonicMinor', A2.start, A2.bars, riffDrive),
    riffFor('D', 'octatonic', C.start, C.bars, riffOctatonic),
    // The finale rides an octave higher — the cheapest, most effective
    // way to make a straight key-change modulation sound "bigger".
    riffFor('F', 'harmonicMinor', FIN.start, FIN.bars, riffDrive, 1),
  ) };

// ------------------------------------------------------------- organ
// Drawbar stabs on every chord change — this organ is not playing a
// tower-defense game, it believes it is playing the last chord of a
// cathedral requiem, and that mismatch is the joke.
const organStabs = { name: 'organStabs', instrument: 'organ' as const, gain: 0.55, pan: 0.15, send: { reverb: 0.3 },
  notes: merge(
    pad(introProg, { startBar: INTRO.start, bars: INTRO.bars, beatsPerBar: BPB, low: 'C3', span: 14, hold: 2, vel: 0.42 }),
    pad(aProg, { startBar: A.start, bars: A.bars, beatsPerBar: BPB, low: 'C3', span: 14, hold: 1, vel: 0.5 }),
    pad(bProg, { startBar: B.start, bars: B.bars, beatsPerBar: BPB, low: 'D3', span: 14, hold: 1, vel: 0.52 }),
    pad(a2Prog, { startBar: A2.start, bars: A2.bars, beatsPerBar: BPB, low: 'C3', span: 16, hold: 1, vel: 0.55 }),
    pad(cProg, { startBar: C.start, bars: C.bars, beatsPerBar: BPB, low: 'D3', span: 16, hold: 1, vel: 0.5 }),
    pad(finProg, { startBar: FIN.start, bars: FIN.bars, beatsPerBar: BPB, low: 'D3', span: 16, hold: 1, vel: 0.58 }),
  ) };

// ------------------------------------------------------------- brass
// Quarter-note chord-tone arpeggios read as fanfare stabs rather than a
// smooth arp. Brass sits out the intro and A — it "arrives" at the B
// section to announce the first key change, same as the gong does.
const brassFanfare = { name: 'brassFanfare', instrument: 'brass' as const, gain: 0.65, pan: -0.2, send: { reverb: 0.2, delay: 0.15 },
  notes: merge(
    arp(bProg, { startBar: B.start, bars: B.bars, beatsPerBar: BPB, steps: 4, shape: 'up', octaves: 1, low: 'C4', vel: 0.85 }),
    arp(a2Prog, { startBar: A2.start, bars: A2.bars, beatsPerBar: BPB, steps: 4, shape: 'up', octaves: 1, low: 'C4', vel: 0.88 }),
    withVelocity(
      arp(finProg, { startBar: FIN.start, bars: FIN.bars, beatsPerBar: BPB, steps: 4, shape: 'up', octaves: 1, low: 'C4', vel: 0.95 }),
      1.05,
    ),
  ) };

// ------------------------------------------------------------- atmosphere
const atmosPad = { name: 'atmosPad', instrument: 'choirpad' as const, gain: 0.32, pan: 0, optional: true,
  send: { reverb: 0.55 },
  notes: merge(
    pad(introProg, { startBar: INTRO.start, bars: INTRO.bars, beatsPerBar: BPB, low: 'A2', span: 20, hold: 4, vel: 0.35, doubleBass: true }),
    pad(cProg, { startBar: C.start, bars: C.bars, beatsPerBar: BPB, low: 'D3', span: 18, hold: 3, vel: 0.3 }),
    pad(finProg, { startBar: FIN.start, bars: FIN.bars, beatsPerBar: BPB, low: 'A2', span: 22, hold: 5, vel: 0.38, doubleBass: true }),
  ) };

export const volcano: SongDef = {
  id: 'volcano',
  title: 'Magma Opus',
  biome: 'volcano',
  bpm: 172,
  beatsPerBar: BPB,
  swing: 0.06,
  sections: [
    { name: 'intro', startBar: INTRO.start, bars: INTRO.bars, key: 'D', mode: 'harmonicMinor', energy: 0.25 },
    { name: 'A', startBar: A.start, bars: A.bars, key: 'D', mode: 'harmonicMinor', energy: 0.62 },
    { name: 'B', startBar: B.start, bars: B.bars, key: 'F', mode: 'harmonicMinor', energy: 0.8 },
    { name: 'A2', startBar: A2.start, bars: A2.bars, key: 'D', mode: 'harmonicMinor', energy: 0.9 },
    { name: 'C', startBar: C.start, bars: C.bars, key: 'D', mode: 'octatonic', energy: 0.78 },
    { name: 'final', startBar: FIN.start, bars: FIN.bars, key: 'F', mode: 'harmonicMinor', energy: 1.0 },
  ],
  chords,
  tracks: [
    kick, snare, hats, openhats, toms, crash, gong, cowbell,
    reeseBass, squelchBass, leadRiff, organStabs, brassFanfare, atmosPad,
  ],
  mix: { reverb: 3.0, delayBeats: 0.375, delayFeedback: 0.3, masterGain: 0.9 },
  // Loop back into the groove (A), not the hushed cold open — the finale's
  // last gong/crash rings out and drops straight back into the stomp,
  // which is exactly how these tracks loop in the actual game.
  loopFromBar: A.start,
};
