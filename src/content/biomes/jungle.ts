/**
 * Steambloom Jungle — biome 2.
 *
 * Two branches this time, not one shallow tree: a GROUND/insect branch
 * (ants, snails, beetles, frogs, big cats, crocs — things that bite from
 * below) and a CANOPY/climbing branch (moths, geckos, hummingbirds,
 * pythons, eagles — things that drop from above). They cross twice, not
 * once: lightly at tier 1 (gecko already snacks on ants; the frog already
 * snaps up moths) and hard at tier 2, where poison-frog and hummingbird
 * each eat across both branches. That means a player who has only built a
 * ground wall gets punished the moment a canopy feral turns, and vice
 * versa — exactly the decision the meadow's fox/hawk split makes, but
 * doubled, because the jungle is meant to force two simultaneous
 * investments instead of one. Everything re-merges on the Steambloom
 * Wyrm, which eats all five tier-3/4 predators from both branches at once.
 *
 * Pace is the other axis biome 2 has to move on: tighter entry spacing,
 * bigger mass waves, and — from level 2 on — a fourth lane ("vine") that
 * drops critters in from the side instead of only the three cardinal
 * approaches the meadow uses. More simultaneous fronts than the meadow,
 * on purpose.
 */
import type { BiomeDef, SpeciesDef } from '../schema';
import { curve, entry, guardianFor, harder, lane, p, stats, wave } from '../helpers';

const species: SpeciesDef[] = [
  // ---- tier 0: roots. No guardian block — nothing this small can be planted. ----
  {
    id: 'jungle.leafcutter-ant',
    name: 'Leafcutter Ant',
    tier: 0,
    roles: ['critter'],
    eats: [],
    stats: stats({ hp: 12, speed: 1.8, damage: 2, attackRate: 1.3, range: 0.4, radius: 0.26, bounty: 4, mass: 0.35 }),
    model: { kit: 'ant', palette: ['#c23b1f', '#7a1f10', '#2a1006'], scale: 0.75, props: { pincers: true } },
    flavor: 'Carries eleven times its body weight and all of your patience.',
    voice: { pitch: 950, timbre: 'squeak' },
  },
  {
    id: 'jungle.glass-moth',
    name: 'Glass-Wing Moth',
    tier: 0,
    roles: ['critter'],
    eats: [],
    stats: stats({ hp: 9, speed: 3.6, damage: 2, attackRate: 1, range: 0.4, radius: 0.22, bounty: 4, mass: 0.22 }),
    model: { kit: 'moth', palette: ['#dff3ff', '#9fd8e8', '#5a8fa8'], scale: 0.8, props: { wingSpan: 1.4, hover: 1.3 } },
    flavor: 'You can see its lunch through its wings. It regrets nothing.',
    voice: { pitch: 1200, timbre: 'chirp' },
  },
  {
    id: 'jungle.mud-snail',
    name: 'Mud Snail',
    tier: 0,
    roles: ['critter'],
    eats: [],
    stats: stats({ hp: 22, speed: 0.7, damage: 2, attackRate: 0.8, range: 0.4, radius: 0.32, bounty: 6, mass: 0.6 }),
    model: { kit: 'snail', palette: ['#6b5a3a', '#4a3c22', '#8a7550'], scale: 0.9, props: { shellTurns: 6 } },
    flavor: 'Slow enough to watch its own funeral, tough enough to skip it.',
    voice: { pitch: 300, timbre: 'honk' },
  },

  // ---- tier 1: first guardians. Ground (stag-beetle) and canopy (gecko), ----
  // ---- each already nibbling one step into the other's territory. ----
  {
    id: 'jungle.stag-beetle',
    name: 'Stag Beetle',
    tier: 1,
    roles: ['critter', 'guardian'],
    eats: ['jungle.leafcutter-ant', 'jungle.mud-snail'],
    stats: stats({ hp: 42, speed: 1.3, damage: 9, attackRate: 1.1, range: 0.6, radius: 0.44, bounty: 11, mass: 1.5 }),
    guardian: guardianFor(1),
    model: { kit: 'beetle', palette: ['#2b1f45', '#120a24', '#8a6bd6'], props: { horn: 1.6, shellSplit: true } },
    flavor: 'Antlers it did not earn and will not stop flexing.',
    voice: { pitch: 210, timbre: 'growl' },
  },
  {
    id: 'jungle.gecko',
    name: 'Steambloom Gecko',
    tier: 1,
    roles: ['critter', 'guardian'],
    eats: ['jungle.glass-moth', 'jungle.leafcutter-ant'],
    stats: stats({ hp: 32, speed: 3.8, damage: 8, attackRate: 1.7, range: 0.5, radius: 0.34, bounty: 10, mass: 0.7 }),
    guardian: guardianFor(1, { cost: 70, placeCooldown: 0.5 }),
    model: { kit: 'lizard', palette: ['#3ddc84', '#1f8a4c', '#eaffb0'], props: { tailWhip: 1.3 } },
    flavor: 'Detaches its tail as a parting gift. Keeps the receipt.',
    voice: { pitch: 900, timbre: 'chirp' },
  },

  // ---- tier 2: the hard cross-over. Each eats deep into BOTH branches, ----
  // ---- which is what forces a mixed board instead of a single wall. ----
  {
    id: 'jungle.poison-frog',
    name: 'Poison Frog',
    tier: 2,
    roles: ['critter', 'guardian'],
    eats: ['jungle.leafcutter-ant', 'jungle.mud-snail', 'jungle.stag-beetle', 'jungle.glass-moth'],
    stats: stats({ hp: 72, speed: 2, damage: 16, attackRate: 1, range: 1, radius: 0.5, bounty: 19, mass: 1.8 }),
    guardian: guardianFor(2),
    model: { kit: 'frog', palette: ['#ffe814', '#0b0b0b', '#2fb8f0'], props: { tongue: 1.6 } },
    flavor: 'Bright colours are a warning label it forgot to finish reading.',
    voice: { pitch: 160, timbre: 'honk' },
  },
  {
    id: 'jungle.hummingbird',
    name: 'Razor Hummingbird',
    tier: 2,
    roles: ['critter', 'guardian'],
    eats: ['jungle.glass-moth', 'jungle.leafcutter-ant', 'jungle.gecko'],
    stats: stats({ hp: 58, speed: 5.4, damage: 13, attackRate: 2.2, range: 0.6, radius: 0.36, bounty: 18, mass: 0.9 }),
    guardian: guardianFor(2, { cost: 150, placeCooldown: 0.8 }),
    model: { kit: 'bird', palette: ['#0fd9c4', '#ff3d8b', '#0a3b38'], props: { wingSpan: 0.6 } },
    flavor: 'Heart rate of a caffeine overdose, temper to match.',
    voice: { pitch: 1800, timbre: 'chirp' },
  },

  // ---- tier 3: three predators, each eating both tier-2 crossers plus a ----
  // ---- tier-1 of its own branch. Three, not two, because the jungle's ----
  // ---- swarms need a third answer once the first two are fed thin. ----
  {
    id: 'jungle.tree-python',
    name: 'Tree Python',
    tier: 3,
    roles: ['critter', 'guardian'],
    eats: ['jungle.gecko', 'jungle.hummingbird', 'jungle.poison-frog'],
    stats: stats({ hp: 155, speed: 2.6, damage: 31, attackRate: 1.1, range: 1.8, radius: 0.56, bounty: 40, mass: 2.8 }),
    guardian: guardianFor(3),
    model: { kit: 'serpent', palette: ['#0f6b3a', '#0a3320', '#d8c96a'], props: { segments: 10 } },
    flavor: 'Hugs first, asks questions rarely, never.',
    voice: { pitch: 260, timbre: 'growl' },
  },
  {
    id: 'jungle.jaguar',
    name: 'Rosette Jaguar',
    tier: 3,
    roles: ['critter', 'guardian'],
    eats: ['jungle.stag-beetle', 'jungle.poison-frog', 'jungle.hummingbird', 'jungle.gecko'],
    stats: stats({ hp: 175, speed: 4.2, damage: 35, attackRate: 1.3, range: 0.9, radius: 0.68, bounty: 44, mass: 3.2 }),
    guardian: guardianFor(3, { cost: 300 }),
    model: { kit: 'bigcat', palette: ['#e0a83a', '#2b1a0a', '#3a2410'], props: { rosettes: 1, bulk: 1.1 } },
    flavor: 'Applies for the job of apex predator. Rejected by tier five.',
    voice: { pitch: 340, timbre: 'growl' },
  },
  {
    id: 'jungle.howler-monkey',
    name: 'Howler Monkey',
    tier: 3,
    roles: ['critter', 'guardian'],
    eats: ['jungle.leafcutter-ant', 'jungle.gecko', 'jungle.hummingbird'],
    stats: stats({ hp: 132, speed: 3.4, damage: 23, attackRate: 1.6, range: 0.8, radius: 0.6, bounty: 36, mass: 2.4 }),
    guardian: guardianFor(3, { cost: 260, satietyPerMeal: 0.3 }),
    model: { kit: 'quadruped', palette: ['#1a1410', '#3a2a1c', '#8a6a4a'], props: { tail: 2.2, earSize: 0.8 } },
    flavor: 'Loud enough to be heard from orbit, wrong about everything it says.',
    voice: { pitch: 380, timbre: 'growl' },
  },

  // ---- tier 4: one ground ambusher, one canopy diver. Both eat all three ----
  // ---- tier-3s, so the branches are functionally merged by this point — ----
  // ---- only which lane they arrive on still differs. ----
  {
    id: 'jungle.river-croc',
    name: 'River Croc',
    tier: 4,
    roles: ['critter', 'guardian'],
    eats: ['jungle.tree-python', 'jungle.jaguar', 'jungle.howler-monkey', 'jungle.poison-frog'],
    stats: stats({ hp: 370, speed: 1.8, damage: 68, attackRate: 0.9, range: 1, radius: 0.85, bounty: 98, mass: 6 }),
    guardian: guardianFor(4),
    model: { kit: 'croc', palette: ['#4a5c2a', '#2a3616', '#c9d9a0'], scale: 1.15, props: { jaw: 1.4, bulk: 1.3 } },
    flavor: 'Has been doing the ambush bit since before trees were cool.',
    voice: { pitch: 130, timbre: 'rumble' },
  },
  {
    id: 'jungle.harpy-eagle',
    name: 'Harpy Eagle',
    tier: 4,
    roles: ['critter', 'guardian'],
    eats: ['jungle.tree-python', 'jungle.jaguar', 'jungle.howler-monkey', 'jungle.hummingbird'],
    stats: stats({ hp: 310, speed: 5.6, damage: 74, attackRate: 1.5, range: 1.3, radius: 0.75, bounty: 104, mass: 4 }),
    guardian: guardianFor(4, { cost: 700, placeCooldown: 1.5 }),
    model: { kit: 'raptor', palette: ['#5a5a62', '#e8e4d8', '#2b2340'], scale: 1.2, props: { wingSpan: 1.8 } },
    flavor: 'Drops out of the canopy like a bad decision with talons.',
    voice: { pitch: 1400, timbre: 'chirp' },
  },

  // ---- tier 5: apex. Eats every tier-3 and tier-4 from both branches, ----
  // ---- so nothing you built survives contact once it turns feral. ----
  {
    id: 'jungle.steambloom-wyrm',
    name: 'Steambloom Wyrm',
    tier: 5,
    roles: ['critter', 'guardian'],
    eats: ['jungle.river-croc', 'jungle.harpy-eagle', 'jungle.tree-python', 'jungle.jaguar', 'jungle.howler-monkey'],
    stats: stats({ hp: 1150, speed: 2.4, damage: 155, attackRate: 1, range: 1.8, radius: 1.25, bounty: 280, mass: 11 }),
    guardian: guardianFor(5, { cost: 1700, satietyPerMeal: 0.28 }),
    model: { kit: 'dragon', palette: ['#0fb894', '#7a1fb8', '#ffb23d', '#0a2b28'], scale: 1.6, props: { wingSpan: 2.5, bulk: 1.4 } },
    flavor: "The jungle's actual opinion on the food chain, expressed loudly.",
    voice: { pitch: 80, timbre: 'rumble' },
  },
];

const HOUSE = p(0, 12);

// Three cardinal lanes like the meadow, plus a fourth ("vine") that drops in
// from the side from level 2 on — the extra simultaneous front that makes
// the jungle read as harder even before any stat gets bigger.
const laneWest = lane('west', curve(p(-9, -15), HOUSE, 3.4, 10), 1);
const laneEast = lane('east', curve(p(9, -15), HOUSE, -3.4, 10), 1);
const laneNorth = lane('north', curve(p(0, -16), HOUSE, 1.8, 8), 1.3);
const laneVine = lane('vine', curve(p(-13, -5), HOUSE, -3, 9), 0.9);

// ---------------------------------------------------------------------------
// Level 1 — Steambloom Threshold: tier 0-1 only, but spacing is tighter and
// swarms are bigger than anything in the meadow's opener, so the biome
// announces its pace immediately.
// ---------------------------------------------------------------------------
const l1w1 = wave([entry('jungle.leafcutter-ant', 14, { spacing: 0.35 })], {
  reward: 35,
  rest: 5,
  title: 'The canopy drips ants',
});
const l1w2 = wave(
  [entry('jungle.leafcutter-ant', 10, { spacing: 0.3 }), entry('jungle.glass-moth', 8, { spacing: 0.5, delay: 2 })],
  { reward: 50, rest: 5 },
);
const l1w3 = wave(
  [entry('jungle.glass-moth', 16, { spacing: 0.25 }), entry('jungle.mud-snail', 6, { spacing: 0.9, delay: 3 })],
  { reward: 65, rest: 5, title: 'Wings and shells' },
);
const l1w4 = wave(
  [entry('jungle.mud-snail', 10, { spacing: 0.5 }), entry('jungle.stag-beetle', 5, { spacing: 1.1, delay: 3 })],
  { reward: 80, rest: 5 },
);
const l1w5 = wave(
  [entry('jungle.leafcutter-ant', 24, { spacing: 0.15 }), entry('jungle.gecko', 4, { spacing: 1.3, delay: 5 })],
  { reward: 100, rest: 6, title: 'Swarm tide' },
);
const l1w6 = wave(
  [entry('jungle.stag-beetle', 8, { spacing: 0.6 }), entry('jungle.gecko', 6, { spacing: 0.7, delay: 2 })],
  { reward: 120, rest: 6, title: 'The branches answer' },
);
const l1w7 = wave(
  [
    entry('jungle.leafcutter-ant', 14, { spacing: 0.2 }),
    entry('jungle.glass-moth', 10, { spacing: 0.3, delay: 1 }),
    entry('jungle.poison-frog', 2, { spacing: 2, delay: 6, lane: 'west' }),
    entry('jungle.hummingbird', 2, { spacing: 1.8, delay: 8, lane: 'east' }),
  ],
  { reward: 160, rest: 7, title: 'Something bigger stirs' },
);

// ---------------------------------------------------------------------------
// Level 2 — Vine Bridge Ambush: opens the vine lane and both tier-2 crossers,
// then blindsides with tier-3 arrivals from a branch the player likely
// under-built.
// ---------------------------------------------------------------------------
const l2w1 = wave(
  [entry('jungle.stag-beetle', 10, { spacing: 0.4 }), entry('jungle.gecko', 6, { spacing: 0.6, delay: 2 })],
  { reward: 90, rest: 5, title: 'Shells and scales' },
);
const l2w2 = wave(
  [entry('jungle.poison-frog', 6, { spacing: 0.9 }), entry('jungle.hummingbird', 6, { spacing: 0.7, delay: 3 })],
  { reward: 130, rest: 6, title: 'The cross-branch predators' },
);
const l2w3 = wave([entry('jungle.leafcutter-ant', 30, { spacing: 0.12 })], {
  reward: 120,
  rest: 6,
  title: 'Ant flood',
});
const l2w4 = wave(
  [entry('jungle.gecko', 10, { spacing: 0.35 }), entry('jungle.tree-python', 3, { spacing: 2, delay: 5, lane: 'vine' })],
  { reward: 170, rest: 7, title: 'Something coils in the vines' },
);
const l2w5 = wave(
  [entry('jungle.stag-beetle', 12, { spacing: 0.3 }), entry('jungle.jaguar', 3, { spacing: 2.2, delay: 5 })],
  { reward: 180, rest: 7, title: 'Spotted death' },
);
const l2w6 = harder(l2w2, 1.4, 4);
const l2w7 = wave(
  [
    entry('jungle.poison-frog', 10, { spacing: 0.5 }),
    entry('jungle.hummingbird', 8, { spacing: 0.45, delay: 2 }),
    entry('jungle.howler-monkey', 3, { spacing: 2, delay: 8, lane: 'vine' }),
  ],
  { reward: 220, rest: 8, title: 'Troop raid' },
);

// ---------------------------------------------------------------------------
// Level 3 — The Wallow and the Canopy: all three tier-3s converge, then both
// tier-4s debut on opposite lanes in the same level so no single guardian
// tier is ever enough on its own.
// ---------------------------------------------------------------------------
const l3w1 = wave(
  [
    entry('jungle.tree-python', 6, { spacing: 0.8 }),
    entry('jungle.jaguar', 5, { spacing: 0.9, delay: 2 }),
    entry('jungle.howler-monkey', 5, { spacing: 0.85, delay: 4 }),
  ],
  { reward: 240, rest: 7, title: 'Tier three convenes' },
);
const l3w2 = wave([entry('jungle.glass-moth', 30, { spacing: 0.12 })], { reward: 150, rest: 6, title: 'Moth storm' });
const l3w3 = wave(
  [entry('jungle.poison-frog', 14, { spacing: 0.3 }), entry('jungle.river-croc', 2, { spacing: 3, delay: 6, lane: 'west' })],
  { reward: 280, rest: 8, title: 'The wallow stirs' },
);
const l3w4 = wave(
  [entry('jungle.hummingbird', 16, { spacing: 0.25 }), entry('jungle.harpy-eagle', 2, { spacing: 3, delay: 6, lane: 'vine' })],
  { reward: 300, rest: 8, title: 'Talons from the canopy' },
);
const l3w5 = harder(l3w1, 1.5, 3);
const l3w6 = wave(
  [entry('jungle.leafcutter-ant', 20, { spacing: 0.12 }), entry('jungle.mud-snail', 10, { spacing: 0.4, delay: 3 })],
  { reward: 200, rest: 7, title: 'Ground swarm' },
);
const l3w7 = wave(
  [
    entry('jungle.jaguar', 6, { spacing: 1 }),
    entry('jungle.tree-python', 5, { spacing: 1.1, delay: 2 }),
    entry('jungle.river-croc', 3, { spacing: 2.4, delay: 8, lane: 'west' }),
    entry('jungle.harpy-eagle', 3, { spacing: 2.2, delay: 10, lane: 'vine' }),
  ],
  { reward: 380, rest: 9, title: 'Ambush from both canopy and mud' },
);

// ---------------------------------------------------------------------------
// Level 4 — Heart of Steambloom: both tier-4s in force, then the Wyrm, which
// eats everything the player has been relying on from either branch.
// ---------------------------------------------------------------------------
const l4w1 = wave(
  [
    entry('jungle.howler-monkey', 8, { spacing: 0.6 }),
    entry('jungle.jaguar', 6, { spacing: 0.7, delay: 2 }),
    entry('jungle.tree-python', 6, { spacing: 0.75, delay: 4 }),
  ],
  { reward: 320, rest: 7, title: 'The mid-chain surges' },
);
const l4w2 = wave(
  [entry('jungle.glass-moth', 24, { spacing: 0.12 }), entry('jungle.leafcutter-ant', 20, { spacing: 0.12, delay: 2 })],
  { reward: 260, rest: 7, title: 'Total swarm' },
);
const l4w3 = wave(
  [entry('jungle.river-croc', 5, { spacing: 1.6 }), entry('jungle.harpy-eagle', 5, { spacing: 1.6, delay: 3 })],
  { reward: 420, rest: 8, title: 'Tier four, both branches' },
);
const l4w4 = harder(l4w1, 1.5, 3);
const l4w5 = wave(
  [entry('jungle.poison-frog', 14, { spacing: 0.25 }), entry('jungle.hummingbird', 14, { spacing: 0.22, delay: 2 })],
  { reward: 350, rest: 8, title: 'Cross-branch flood' },
);
const l4w6 = harder(l4w3, 1.4, 2);
const l4w7 = wave(
  [
    entry('jungle.jaguar', 6, { spacing: 0.9 }),
    entry('jungle.harpy-eagle', 4, { spacing: 1.4, delay: 4, lane: 'vine' }),
    entry('jungle.river-croc', 4, { spacing: 1.5, delay: 6, lane: 'west' }),
    entry('jungle.steambloom-wyrm', 1, { spacing: 1, delay: 16, lane: 'north', boss: true }),
  ],
  { reward: 900, rest: 10, title: 'THE STEAMBLOOM WYRM' },
);

export const jungle: BiomeDef = {
  id: 'jungle',
  name: 'Steambloom Jungle',
  order: 1,
  blurb: 'Humid, loud, and every leaf is hiding something with more teeth than you would like.',
  mapPosition: p(8, -3),
  unlock: { stars: 6 },
  palette: {
    sky: '#123c36',
    ground: '#1f6b3a',
    groundAccent: '#0f4d28',
    path: '#8a5a2a',
    fog: '#2fb8a6',
    sun: '#ffdf8c',
    rim: '#ff7a3d',
  },
  music: 'jungle',
  ambience: { bed: 'jungle', density: 0.7 },
  species,
  levels: [
    {
      id: 'jungle-1',
      name: 'Steambloom Threshold',
      arena: { width: 28, depth: 34 },
      house: { position: HOUSE, hp: 280 },
      lanes: [laneWest, laneEast, laneNorth],
      startingCoins: 100,
      starGoals: { houseHp: 0.9, coins: 300, noFeral: true },
      waves: [l1w1, l1w2, l1w3, l1w4, l1w5, l1w6, l1w7],
      props: [
        { kit: 'prop.tree', position: p(-11, 5), scale: 1.3 },
        { kit: 'prop.tree', position: p(12, 2), scale: 1.1, rotation: 1.4 },
        { kit: 'prop.bush', position: p(-5, 8), scale: 1.2 },
        { kit: 'prop.bush', position: p(6, 9), scale: 1.4 },
        { kit: 'prop.rock', position: p(2, -2), scale: 1.2 },
      ],
      totems: [{ id: 'coinfall', kind: 'coinfall', position: p(-8, 9) }],
    },
    {
      id: 'jungle-2',
      name: 'Vine Bridge Ambush',
      arena: { width: 30, depth: 35 },
      house: { position: HOUSE, hp: 360 },
      lanes: [laneWest, laneEast, laneNorth, laneVine],
      startingCoins: 160,
      starGoals: { houseHp: 0.85, coins: 620, noFeral: true },
      waves: [l2w1, l2w2, l2w3, l2w4, l2w5, l2w6, l2w7],
      props: [
        { kit: 'prop.tree', position: p(-13, -1), scale: 1.5 },
        { kit: 'prop.tree', position: p(10, 6), scale: 1.2 },
        { kit: 'prop.rock', position: p(8, -4), scale: 1.1 },
        { kit: 'prop.bush', position: p(-4, 9), scale: 1.3 },
      ],
      totems: [
        { id: 'coinfall', kind: 'coinfall', position: p(-9, 9) },
        { id: 'roar', kind: 'roar', position: p(9, 9) },
      ],
    },
    {
      id: 'jungle-3',
      name: 'The Wallow and the Canopy',
      arena: { width: 32, depth: 37 },
      house: { position: HOUSE, hp: 440 },
      lanes: [laneWest, laneEast, laneNorth, laneVine],
      startingCoins: 230,
      starGoals: { houseHp: 0.82, coins: 980 },
      waves: [l3w1, l3w2, l3w3, l3w4, l3w5, l3w6, l3w7],
      props: [
        { kit: 'prop.tree', position: p(-14, 3), scale: 1.6 },
        { kit: 'prop.tree', position: p(13, -3), scale: 1.4 },
        { kit: 'prop.rock', position: p(0, 3), scale: 1.7 },
        { kit: 'prop.bush', position: p(-6, 9) },
        { kit: 'prop.bush', position: p(7, 8), scale: 1.2 },
      ],
      totems: [
        { id: 'coinfall', kind: 'coinfall', position: p(-10, 9) },
        { id: 'roar', kind: 'roar', position: p(10, 9) },
      ],
    },
    {
      id: 'jungle-4',
      name: 'Heart of Steambloom',
      arena: { width: 34, depth: 38 },
      house: { position: HOUSE, hp: 560 },
      lanes: [laneWest, laneEast, laneNorth, laneVine],
      startingCoins: 320,
      starGoals: { houseHp: 0.8, coins: 1500 },
      waves: [l4w1, l4w2, l4w3, l4w4, l4w5, l4w6, l4w7],
      props: [
        { kit: 'prop.tree', position: p(-15, 4), scale: 1.7 },
        { kit: 'prop.tree', position: p(14, -4), scale: 1.5 },
        { kit: 'prop.rock', position: p(-2, -2), scale: 1.8 },
        { kit: 'prop.rock', position: p(6, 4), scale: 1.3 },
        { kit: 'prop.bush', position: p(-7, 9), scale: 1.2 },
        { kit: 'prop.bush', position: p(8, 7), scale: 1.3 },
      ],
      totems: [
        { id: 'coinfall', kind: 'coinfall', position: p(-11, 9) },
        { id: 'roar', kind: 'roar', position: p(11, 9) },
      ],
    },
  ],
};
