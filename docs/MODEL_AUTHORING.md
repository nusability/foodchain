# Authoring model kits

A **kit** is a procedural, parameterised animal (or prop) builder. There are no
downloaded assets: every creature in the game is assembled from primitives at
runtime, which is why a new species costs one line of content data.

Read `src/render/models/kit.ts` (the contract and the primitives) and
`src/render/models/kits.bugs.ts` (the reference implementations) before
starting.

## The contract

```ts
const quadruped: Kit = {
  id: 'quadruped',
  description: 'Generic four-legged mammal: fox, wolf, badger, dog.',
  props: {
    snout: 'snout length multiplier (default 1)',
    tail: 'tail length multiplier (default 1)',
    bulk: 'body thickness multiplier (default 1)',
  },
  build(ctx): KitParts {
    // ...
    return { body: root, head, jaw, legs, tail, eyes, accents };
  },
};
```

`KitParts` is the rig the shared animator drives. Only `body` is required;
anything else you return gets animated automatically:

| part | animated as |
|---|---|
| `body` | squash & stretch on hit, bob while walking |
| `head` | bobs, turns toward the target |
| `jaw` | opens on each attack |
| `legs[]` | alternating swing while walking |
| `tail` | wags, faster when attacking |
| `eyes` | blinks; goes angry-red when the creature is about to turn feral |
| `accents[]` | free lag/swing (ears, antennae, fins, wings) |

Return the **pivot** for anything that rotates (see `pivotLeg`) — rotating a
limb mesh directly detaches it from the body.

## The context

```ts
ctx.radius          // body radius from the species stats — SIZE YOURSELF TO THIS
ctx.tier            // food-chain tier, if you want higher tiers to look meaner
ctx.rng             // seeded; use it for per-instance variation
ctx.color(0, '#fff')// palette slot with a fallback — slot 0 is the main colour
ctx.num('bulk', 1)  // numeric prop with a default
ctx.bool('wings', true)
ctx.str('pattern', 'spots')
```

**Everything must scale from `ctx.radius`.** A kit that hard-codes sizes will
be the wrong size for half the species that use it.

## Primitives

From `./kit`: `blob` (squashed low-poly sphere — the workhorse), `chunk`
(rounded box), `cone`, `stick`, `fin` (double-sided card), `pivotLeg`,
`googlyEyes`, `outlineAll`, `toon`, `flat`.

Geometry is cached by shape signature, so reuse the primitives rather than
constructing `THREE.*Geometry` directly. Materials are cached per colour.

## Style rules

- **Comic proportions.** Big head, small body, oversized feet, tiny eyes on a
  huge face or huge eyes on a tiny face. Exaggerate one feature per creature.
- **Googly eyes on everything.** Use `googlyEyes()`.
- **Read at 2 cm.** These are 40 px tall on a phone. Silhouette and two strong
  colours beat detail every time.
- **Budget: 10–25 primitives per creature.** Hundreds render at once.
- Face **+Z**. Feet at **y = 0**. Origin at the centre of the footprint.
- No per-frame allocation inside `build` beyond what you return.
- Do not add outlines yourself — the renderer calls `outlineAll` once.

## Check it

```sh
npx tsx tools/check-kits.ts
npx tsc --noEmit
```

It builds every registered kit at several radii and reports primitive counts,
bounding boxes, missing rig parts and anything not sized to `ctx.radius`. Fix
everything it flags.

Do **not** edit `src/render/models/registry.ts` (beyond nothing at all) — the
integrator wires kit groups in. Your file must export its array under the exact
name it already has in the stub.
