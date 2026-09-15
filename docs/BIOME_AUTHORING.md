# Authoring a biome

A biome is one file: `src/content/biomes/<id>.ts`, default-exporting nothing and
named-exporting a `BiomeDef`. Read `src/content/biomes/meadow.ts` first — it is
the reference implementation and everything below describes how it works.

Schema: `src/content/schema.ts`. Helpers: `src/content/helpers.ts`.

## 1. Design the chain

The food chain is a **directed acyclic graph**, drawn by each species' `eats`
list. The validator enforces `tier(predator) > tier(prey)`, which is what keeps
it acyclic.

Aim for **6 tiers (0–5)** and **10–13 species**. Do not build a straight line —
build a tree that branches and re-merges:

```
tier 0   aphid      grasshopper          <- roots: critters only, no guardian
tier 1   beetle     fieldmouse
tier 2   frog       sparrow              <- the branches cross here
tier 3   snake      fox
tier 4   badger     hawk
tier 5   bear                            <- apex: eats from both branches
```

Two branches that each counter *different* things is what makes the game a
decision instead of a ladder. A player who only invests in the ground branch
should struggle when the air branch's feral turncoats arrive.

Rules the validator enforces:

- Every species id is namespaced: `"<biomeId>.<name>"`.
- Every id in `eats` exists in this biome and sits on a strictly lower tier.
- Every **guardian below the apex tier has at least one predator**. If nothing
  can eat it, its feral form makes the level unwinnable — this is an error.
- Tier 0 exists, and tiers have no gaps.

## 2. Write the species

```ts
{
  id: 'jungle.pygmy-sloth',
  name: 'Pygmy Sloth',
  tier: 2,
  roles: ['critter', 'guardian'],   // spawns in waves AND can be planted
  eats: ['jungle.leafcutter', 'jungle.beetle'],
  stats: stats({ hp: 62, speed: 1.8, damage: 13, attackRate: 0.9, range: 2.2, radius: 0.55, bounty: 16, mass: 2 }),
  guardian: guardianFor(2),          // tier-scaled cost/hunger defaults
  model: { kit: 'quadruped', palette: ['#8a7a5a', '#5c4a32', '#f0d9b5'], props: { bulk: 1.3 } },
  flavor: 'Moves at the speed of a decision.',
  voice: { pitch: 140, timbre: 'growl' },
}
```

- `stats()` fills in sensible defaults; you give hp/speed/damage at minimum.
- `guardianFor(tier)` gives a balanced cost curve, hunger rate and feral
  multiplier for that tier. Override individual fields when a species should
  feel different (a fast cheap one, a slow expensive one).
- **Bounty is generous on purpose.** This game rains coins.
- `model.kit` must be one of `KIT_VOCABULARY` in
  `src/render/models/registry.ts`. Palette slots are kit-specific; index 0 is
  always the main body colour. `props` are kit-specific knobs — read the kit's
  `props` documentation in its source file, and it is fine to pass nothing.

### Balance shape

Per tier step, roughly: hp ×2.2, damage ×2.2, bounty ×2.2, cost ×2.05. Speed
should *not* climb monotonically — mix fast-fragile and slow-tanky within a
tier, so the player reads silhouettes rather than numbers.

## 3. Design the levels

3–4 levels per biome, each escalating. Each level needs:

- `arena`: 26×32 to 34×38 world units. Bigger than that will not read on a
  phone.
- `house.position`: near the far edge, e.g. `p(0, 11)`.
- `lanes`: 2–3 polylines from the spawn edge to the house. Use `curve()` — a
  straight line is boring and gives no reaction time. **Every lane must end
  within 3 units of the house** or critters stall.
- `waves`: 5–9 waves. `entry()` and `wave()` build them; `harder(wave, factor,
  extraCount)` re-uses a wave shape at higher difficulty, which is most of what
  level design here is.
- `startingCoins`: must at least afford your cheapest guardian.
- `starGoals`: `{ houseHp: 0.85, coins: <about 60% of what a good run collects>,
  noFeral: true }`. `noFeral` adds a 4th star; use it only on early levels.
- `props` / `totems`: scenery and king-activated actions (`coinfall`, `roar`).

Wave pacing that works: open with a single low-tier swarm, introduce exactly one
new species per wave, and every third wave throw a *mass* wave (20–30 cheap
critters at 0.15 s spacing) so the screen fills with coins. End the last level
of a biome with a `boss: true` apex.

## 4. Check it

```sh
npx tsx tools/validate-biome.ts src/content/biomes/<id>.ts
npx tsc --noEmit
```

Zero errors is required. Warnings are advisory but read them — "no guardian in
this biome eats it" on a non-apex species is usually a real design bug.

Do **not** edit `src/content/registry.ts`; the integrator wires biomes in.
