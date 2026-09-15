# Food Chain

A 3D mobile web game. You defend your house from animals crawling towards it,
starting at the bottom of the food chain. You fight back by planting **bigger
animals** to eat them.

The twist: everything you plant is on a hunger timer. Fed by kills, it stays
loyal. Starved, it goes **feral**, switches sides, and comes for your house
harder than it was. The only answer is something further up the chain — which
will also, eventually, turn on you.

The chain is a tree, not a line, so several escalation ladders run at once and
over-investing in one branch leaves you exposed on the other.

## Playing it

```sh
npm install
npm run dev
```

Open it on a phone (or a narrow browser window). There are **no menus**: you
tap the ground, the king walks there, and the game plants the right animal for
you. Walk him onto a totem to trigger it. Upgrades buy themselves between
levels.

## The content framework

Biomes, food chains, levels, creature models and music are all authored as data
against a schema, each in its own file, each with its own validator. Five
biomes, sixty-two species, nineteen levels and five original scores were
produced in parallel by separate agents working against these contracts:

| What | Lives in | Self-check |
|---|---|---|
| Biome, food chain, levels | `src/content/biomes/<id>.ts` | `npx tsx tools/validate-biome.ts <file>` |
| Creature & prop models | `src/render/models/kits.<group>.ts` | `npx tsx tools/check-kits.ts` |
| Biome themes | `src/audio/music/songs/<biome>.ts` | `npx tsx tools/validate-song.ts <file>` |

See [docs/AGENTS.md](docs/AGENTS.md), and the three authoring guides it links.

The validators encode the design brief rather than just the types: a guardian
with no predator is an error (its feral turn would be unwinnable), a lane that
stops short of the house is an error, and a biome theme under 36 bars or
without a key change fails the test suite.

## How it is built

Nothing is downloaded at runtime. Every animal is assembled from cached
primitives by a procedural "kit", and every note of music is synthesised in the
browser from oscillators, filtered noise and Karplus-Strong strings. The whole
game is ~200 kB gzipped.

```
src/core/       pure logic — no three.js, no DOM, unit-tested
  foodchain/    the chain as a queryable DAG
  sim/          fixed-timestep battle sim, wave director, auto-placement
  economy/      wallet, automatic upgrades, IAP framework
  meta/         versioned save data, progression
src/content/    schema, validators, authoring helpers, biome packs
src/render/     three.js scenes, procedural models, particles
src/audio/      music engine, synth voices, procedural SFX
src/app/        game shell and loop
```

The simulation is deliberately free of rendering concerns: it steps at a fixed
60 Hz and emits an event queue that the renderer and the audio engine both
consume. That is what makes the interesting parts — hunger, feral turncoats,
wave pacing, the economy — testable without standing up a browser.

## Commands

```sh
npm run dev               # dev server
npm run build             # typecheck + production build
npm test                  # 494 unit tests
npm run validate:content  # check every biome
```

## In-app purchases

`src/core/economy/iap.ts` is a complete framework — product catalogue,
consumables vs. entitlements, receipts, restore — behind an `IapProvider`
interface, with a local stub standing in for a real store. Entitlements are
derived from purchase history rather than stored, so a restore on a new device
replays correctly. No content is gated behind a purchase; products are hard
currency, cosmetics, or convenience multipliers.
