# Content framework

Food Chain is built so that content — biomes, food chains, levels, creature
models, music — can be authored **in parallel, by separate agents**, without
any of them touching the engine or each other's files.

Three rules make that work:

1. **Content is data, in TypeScript.** Every pack is a plain exported object
   typed by a schema. TypeScript catches shape errors; a runtime validator
   catches the semantic ones (dangling references, broken chains, silent bars).
2. **One author, one file.** Nobody edits a shared registry. Registries are
   wired up by the integrator after the fact.
3. **Everything self-checks.** Each authoring track has a CLI that validates a
   single file in isolation. An author is not finished until it is clean.

## The tracks

| Track | Writes | Checks with | Guide |
|---|---|---|---|
| Biome / food chain / level design | `src/content/biomes/<id>.ts` | `npx tsx tools/validate-biome.ts <file>` | [BIOME_AUTHORING.md](./BIOME_AUTHORING.md) |
| Creature & prop models | `src/render/models/kits.<group>.ts` | `npx tsx tools/check-kits.ts` | [MODEL_AUTHORING.md](./MODEL_AUTHORING.md) |
| Music | `src/audio/music/songs/<biome>.ts` | `npx tsx tools/validate-song.ts <file>` | [MUSIC_AUTHORING.md](./MUSIC_AUTHORING.md) |

## The contract between tracks

A biome author names a model kit (`kit: 'quadruped'`) and a song id
(`music: 'jungle'`). Neither has to exist yet. The vocabulary of legal kit ids
lives in `src/render/models/registry.ts` (`KIT_VOCABULARY`) and the song id is
the biome id. That shared vocabulary is the entire interface — which is why the
three tracks can run at the same time.

## The game, in one paragraph

The player defends a house. Animals crawl towards it along lanes, starting at
the bottom of the food chain. The player plants *bigger animals* to eat them.
Every planted animal is on a hunger timer: fed by kills, and when the timer runs
out it goes **feral**, switches sides and marches on the house harder than it
was. The only answer is something further up the chain — which will also
eventually turn. The chain is a tree, not a line, so there are several ladders
running at once. The player never opens a menu: they walk a king around and the
game plants the right thing where he stops.

## Engine layout

```
src/core/          pure logic — no three.js, no DOM, fully unit-tested
  foodchain/       the chain as a queryable DAG
  sim/             battle simulation, wave director, auto-placement brain
  economy/         wallet, auto-upgrades, IAP framework
  meta/            save data + migrations, progression
src/content/       schema, validator, authoring helpers, biome packs
src/render/        three.js: scenes, procedural models, VFX
src/audio/         procedural music + SFX synthesis
src/app/           scene routing, game loop
```

## Ground rules for every track

- **No new dependencies.** Everything is built from what is already installed
  (three, vite, vitest). No asset downloads: models and audio are procedural.
- **Mobile first.** Assume a mid-range phone at 60 fps with 200+ animals on
  screen. Cache geometry, avoid per-frame allocation, keep polycounts tiny.
- **Wacky, but not random.** Comic proportions, squishy motion, silly flavour
  text — held together by consistent palettes and real music theory.
- **Comment the *why*.** Explain a balance decision or a synthesis trick; do
  not narrate what the code plainly does.
- **Make it testable.** Pure functions where possible. Do not write end-to-end
  tests; do write unit tests for logic you introduce.
