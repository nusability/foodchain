# Authoring a biome theme

One file per biome: `src/audio/music/songs/<biomeId>.ts`, exporting a `SongDef`.

There are no samples and no MIDI. Songs are data, played by a Web Audio synth
engine that builds every sound from oscillators, filtered noise and
Karplus-Strong strings at runtime.

## The brief

Every biome theme must:

- be **at least 36 bars** long (the validator fails below that),
- **change key at least once** — a real modulation between sections, not a
  transposed loop,
- have **real harmony**: 4+ distinct chords, extensions (7ths, 9ths, sus,
  altered dominants) rather than bare triads,
- use **5+ tracks** so the mix has depth,
- sound **wacky but competent** — this is a comic game about animals eating each
  other. Odd meters, cartoon brass, silly vocal blips, sudden gear changes:
  yes. Aimless noise: no.
- loop cleanly. Whatever `loopFromBar` points at must follow the last bar
  musically.

## The format

```ts
import type { SongDef } from '../song';
import { arp, bassline, chordTrack, euclid, melody, merge, pad, repeat, steps } from '../pattern';

export const jungle: SongDef = {
  id: 'jungle',
  title: 'Canopy Stomp',
  biome: 'jungle',
  bpm: 138,
  beatsPerBar: 4,
  swing: 0.14,
  sections: [
    { name: 'intro', startBar: 0,  bars: 4,  key: 'E', mode: 'dorian',     energy: 0.3 },
    { name: 'A',     startBar: 4,  bars: 8,  key: 'E', mode: 'dorian',     energy: 0.6 },
    { name: 'B',     startBar: 12, bars: 8,  key: 'G', mode: 'mixolydian', energy: 0.8 },  // key change
    ...
  ],
  chords: [...],   // build with chordTrack()
  tracks: [...],
  mix: { reverb: 2.4, delayBeats: 0.75, delayFeedback: 0.32, masterGain: 0.85 },
  loopFromBar: 4,
};
```

Sections **must tile the song with no gaps or overlaps**, starting at bar 0. A
key change is any section whose `key` or `mode` differs from the previous one.

## Writing notes

Do not hand-write note literals. Compose with the helpers in
`src/audio/music/pattern.ts` — a 36-bar arrangement should be ~150 lines:

- `steps('x..x..x.x...x...', { startBar, bars, beatsPerBar, steps: 16 }, 'C2')`
  — step-sequencer strings. `x` hit, `X` accent, `o` ghost, `.` rest.
- `euclid(hits, steps, rotate)` — evenly spread rhythms; great for percussion
  and for anything that should feel a bit off-kilter.
- `arp(progression, { shape: 'updown', octaves: 2, ... })` — arpeggios.
  Shapes: `up`, `down`, `updown`, `downup`, `pinky`, `thumb`, `random`
  (deterministic).
- `pad(progression, { low: 'C3', span: 16, hold: 2 })` — sustained voicings.
- `bassline(progression, 'x.x.x.xx', { octave: 2, fifths: true })`.
- `melody([0, 2, 4, null, 7, 6], { key: 'E', scale: 'dorian' })` — scale
  degrees, so a melody re-harmonises correctly when the section modulates.
  `key` takes a bare tonic (`'E'`, centred on octave 3) or a full note name
  (`'E4'`) when you want to pin the register; `octaveOffset` shifts it.
- `repeat(block, times, everyBars)`, `shiftBars`, `transposeNotes`,
  `withVelocity`, `merge(...)`.

Chord symbols parse like `Dm9`, `F#maj7`, `Bb7#11`, `Amaj7/C#`. Scales include
the modes plus `blues`, `octatonic`, `hungarian`, `wholeTone` — the last three
are the wacky ones.

## Instruments

Pitched: `supersaw`, `pluck`, `kalimba`, `banjo`, `fmbell`, `marimba`,
`subbass`, `reese`, `choirpad`, `organ`, `brass`, `squelch`, `glass`, `vox`,
`tuba`, `whistle`.

Percussion (pitch tunes the drum): `kick`, `snare`, `clap`, `hat`, `openhat`,
`tom`, `rim`, `shaker`, `crash`, `woodblock`, `cowbell`, `gong`.

Read `src/audio/music/instruments.ts` before choosing — each voice has a
character. `pluck`/`kalimba`/`banjo` are physically modelled and sound organic;
`supersaw`/`reese` are big and synthetic; `vox`/`tuba`/`whistle` are the comedy
voices.

## Mixing

- Give every track a `gain` (0.4–0.9 typical) and a `pan`.
- Use sends, not more notes, for space: `send: { reverb: 0.3, delay: 0.2 }`.
  Keep bass and kick dry (`reverb: 0` or omitted).
- Mark ornamental layers `optional: true` — they are dropped on weak devices.
- Leads sit around MIDI 67–84, pads 52–72, bass 28–45.

## A shape that works

```
intro    4 bars   sparse, establishes the hook
A        8 bars   full groove, home key
B        8 bars   key change, new colour
A'       8 bars   home key, busier
C        8 bars   the wacky one — odd meter, weird scale, or a gear change
outro    4 bars   turnaround back into A
                  = 40 bars
```

## Check it

```sh
npx tsx tools/validate-song.ts src/audio/music/songs/<biomeId>.ts
npx tsc --noEmit
```

It prints bar count, key changes, note count, duration and pitch range. Zero
errors required; read the warnings (silent bars, thin harmony) and fix them.

Do **not** edit `src/audio/music/songs/index.ts`; the integrator wires songs in.
