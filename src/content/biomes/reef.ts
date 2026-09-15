/**
 * Bubblewrack Reef — biome 4.
 *
 * The whole biome runs on one idea: down here nothing sits still. Every body
 * is cheap and quick instead of tanky, so the tuning trades HP for speed and
 * count across the board — a player who plants a slow tank here starves it
 * on plankton it can't catch. That is also why bounties are pushed even
 * further past the meadow's baseline: with this many bodies dying per
 * second the screen needs to be drowning in coins or the kills feel free.
 *
 * The chain is two branches that cross twice, not once. A "shell" branch
 * (snail/urchin -> crab -> pufferfish -> eel) answers things that crawl the
 * reef floor; a "water column" branch (shrimp -> fish/jelly -> squid ->
 * shark) answers things that swim mid-water. Tier 2 is where they first
 * cross — the clownfish reaches down to eat the crab, the jelly reaches
 * down to eat the snail and urchin — so a player who only bred one branch
 * already has a hole by the midgame. They cross again at tier 3-4 (the eel
 * bites jellyfish, the shark bites the eel) before fully re-merging at the
 * tier-5 apex, which eats across both branches at once.
 */
import type { BiomeDef, SpeciesDef } from '../schema';
import { curve, entry, guardianFor, harder, lane, p, stats, wave } from '../helpers';

const species: SpeciesDef[] = [
  // --- tier 0: roots. Water-column plankton and floor-hugging shrimp — no
  // guardian answers them because nothing needs to; they exist purely as the
  // coin firehose that opens every wave and feeds everything else.
  {
    id: 'reef.plankton',
    name: 'Krill Cloud',
    tier: 0,
    roles: ['critter'],
    eats: [],
    stats: stats({ hp: 8, speed: 3.2, damage: 2, attackRate: 1.4, range: 0.3, radius: 0.22, bounty: 4, mass: 0.3 }),
    model: { kit: 'grub', palette: ['#7cf0e0', '#3fcbb0', '#eafffa'], scale: 0.45, props: { segments: 2, antennae: false } },
    flavor: 'A single krill is not a threat. Forty thousand of them is a weather system.',
    voice: { pitch: 1600, timbre: 'squeak' },
  },
  {
    id: 'reef.glass-shrimp',
    name: 'Glass Shrimp',
    tier: 0,
    roles: ['critter'],
    eats: [],
    stats: stats({ hp: 11, speed: 5.2, damage: 2, attackRate: 1.6, range: 0.35, radius: 0.26, bounty: 5, mass: 0.35 }),
    model: { kit: 'hopper', palette: ['#bdf5ff', '#6fd8e8', '#ffe38a'], scale: 0.6, props: { wings: false } },
    flavor: 'Practically invisible. Practically a snack. Practically everywhere.',
    voice: { pitch: 1400, timbre: 'chirp' },
  },

  // --- tier 1: the two branches get their first counters. The urchin is the
  // deliberate slow-tanky exception the balance guide asks for — a stationary
  // wall of spikes in a biome that's otherwise all sprint.
  {
    id: 'reef.reef-snail',
    name: 'Cone Snail',
    tier: 1,
    roles: ['critter', 'guardian'],
    eats: ['reef.plankton'],
    stats: stats({ hp: 46, speed: 1.0, damage: 9, attackRate: 0.8, range: 0.5, radius: 0.42, bounty: 13, mass: 1.3 }),
    guardian: guardianFor(1, { cost: 40, hungerRate: 0.016, placeCooldown: 0.5 }),
    model: { kit: 'snail', palette: ['#ff9ecf', '#c2477a', '#fff1b8'], props: { shellTurns: 4 } },
    flavor: 'Slow shell, fast venom. Reads its victims the last rites first.',
    voice: { pitch: 220, timbre: 'honk' },
  },
  {
    id: 'reef.spine-urchin',
    name: 'Spine Urchin',
    tier: 1,
    roles: ['critter', 'guardian'],
    eats: ['reef.plankton'],
    stats: stats({ hp: 58, speed: 0.5, damage: 15, attackRate: 0.6, range: 0.4, radius: 0.46, bounty: 15, mass: 1.7 }),
    guardian: guardianFor(1, { cost: 58, hungerRate: 0.015, placeCooldown: 1.1 }),
    model: { kit: 'blob', palette: ['#2b1f45', '#6a3fa0', '#ff5da2'], props: { bulk: 0.8, spikes: 1 } },
    flavor: "Doesn't hunt. Doesn't need to. Everyone else moves.",
    voice: { pitch: 180, timbre: 'rumble' },
  },
  {
    id: 'reef.cleaner-crab',
    name: 'Cleaner Crab',
    tier: 1,
    roles: ['critter', 'guardian'],
    eats: ['reef.glass-shrimp', 'reef.plankton'],
    stats: stats({ hp: 33, speed: 3.6, damage: 7, attackRate: 1.3, range: 0.5, radius: 0.38, bounty: 11, mass: 1.0 }),
    guardian: guardianFor(1, { cost: 52 }),
    model: { kit: 'crab', palette: ['#ff6f61', '#c93f2e', '#ffe4b5'], props: { pincers: true } },
    flavor: 'Sidesteps into your ankle at exactly the wrong moment.',
    voice: { pitch: 500, timbre: 'chirp' },
  },

  // --- tier 2: the first crossing. Both of these reach across branches —
  // that's deliberate, so a player who only raised shell-branch guardians
  // gets bitten by the jelly, and a water-column-only player gets bitten by
  // the fish going after their crab.
  {
    id: 'reef.clownfish',
    name: 'Clownfish Squad',
    tier: 2,
    roles: ['critter', 'guardian'],
    eats: ['reef.glass-shrimp', 'reef.cleaner-crab'],
    stats: stats({ hp: 60, speed: 6.2, damage: 13, attackRate: 1.6, range: 0.6, radius: 0.4, bounty: 22, mass: 0.9 }),
    guardian: guardianFor(2, { cost: 95, placeCooldown: 0.5 }),
    model: { kit: 'fish', palette: ['#ff8c3d', '#ffffff', '#1a1a1a'], props: { finSize: 1.2 } },
    flavor: 'Territorial past all reason. Will die on this anemone.',
    voice: { pitch: 1200, timbre: 'chirp' },
  },
  {
    id: 'reef.moon-jelly',
    name: 'Moon Jelly',
    tier: 2,
    roles: ['critter', 'guardian'],
    eats: ['reef.reef-snail', 'reef.spine-urchin', 'reef.glass-shrimp'],
    stats: stats({ hp: 92, speed: 2.2, damage: 18, attackRate: 1.0, range: 0.9, radius: 0.55, bounty: 28, mass: 1.6 }),
    guardian: guardianFor(2, { cost: 145, placeCooldown: 1.1 }),
    model: { kit: 'jelly', palette: ['#c9f7ff', '#6fd0e0', '#ff9ecf'], props: { tendrils: 6, hover: 1.1 } },
    flavor: 'Ninety percent water, one hundred percent grudge.',
    voice: { pitch: 90, timbre: 'rumble' },
  },

  // --- tier 3: the shell branch answers with armour, the water branch with
  // a fast striker that reaches back down into the shell branch's prey.
  {
    id: 'reef.pufferfish',
    name: 'Pufferfish',
    tier: 3,
    roles: ['critter', 'guardian'],
    eats: ['reef.cleaner-crab', 'reef.clownfish', 'reef.spine-urchin'],
    stats: stats({ hp: 172, speed: 2.6, damage: 31, attackRate: 0.9, range: 0.5, radius: 0.62, bounty: 56, mass: 2.6 }),
    guardian: guardianFor(3, { cost: 265 }),
    model: { kit: 'blob', palette: ['#ffd23f', '#c98f1a', '#2b2340'], scale: 1.1, props: { bulk: 1.5, spikes: 1 } },
    flavor: 'Goes from lunch to landmine in half a second.',
    voice: { pitch: 240, timbre: 'honk' },
  },
  {
    id: 'reef.reef-eel',
    name: 'Reef Eel',
    tier: 3,
    roles: ['critter', 'guardian'],
    eats: ['reef.reef-snail', 'reef.cleaner-crab', 'reef.moon-jelly'],
    stats: stats({ hp: 142, speed: 7.2, damage: 37, attackRate: 1.3, range: 1.3, radius: 0.5, bounty: 58, mass: 2.0 }),
    guardian: guardianFor(3, { cost: 300, placeCooldown: 0.7 }),
    model: { kit: 'serpent', palette: ['#3fd6c0', '#1f6f63', '#ffe38a'], props: { segments: 10 } },
    flavor: 'Lives in a crack in the rock. The crack is a lie; the eel is enormous.',
    voice: { pitch: 260, timbre: 'growl' },
  },

  // --- tier 4: the second crossing. The squid ambushes the jelly and puffer
  // it should logically avoid; the shark hunts the eel it should fear.
  {
    id: 'reef.vampire-squid',
    name: 'Vampire Squid',
    tier: 4,
    roles: ['critter', 'guardian'],
    eats: ['reef.moon-jelly', 'reef.pufferfish', 'reef.clownfish'],
    stats: stats({ hp: 335, speed: 4.6, damage: 63, attackRate: 1.0, range: 1.0, radius: 0.7, bounty: 132, mass: 3.2 }),
    guardian: guardianFor(4, { cost: 520 }),
    model: { kit: 'squid', palette: ['#4b2e83', '#1f123f', '#ff5da2'], props: { tentacles: 8, hover: 1.3 } },
    flavor: 'Turns itself inside out rather than be seen. Rude, but effective.',
    voice: { pitch: 130, timbre: 'growl' },
  },
  {
    id: 'reef.blacktip-reef-shark',
    name: 'Blacktip Reef Shark',
    tier: 4,
    roles: ['critter', 'guardian'],
    eats: ['reef.reef-eel', 'reef.pufferfish', 'reef.moon-jelly'],
    stats: stats({ hp: 305, speed: 8.6, damage: 71, attackRate: 1.2, range: 0.9, radius: 0.75, bounty: 148, mass: 4.0 }),
    guardian: guardianFor(4, { cost: 640, placeCooldown: 0.9 }),
    model: { kit: 'shark', palette: ['#7d8b99', '#3a4552', '#e8e8e8'], props: { finHeight: 1.3, hover: 0.8 } },
    flavor: "Doesn't circle. Doesn't wait. Just arrives.",
    voice: { pitch: 200, timbre: 'growl' },
  },

  // --- tier 5: apex, fully re-merged — both eat across both branches.
  // Giant squid is the biome's boss species; great white is the pricier,
  // faster second option, a guardian-only investment that never shows up
  // wild (this reef hasn't seen one — yet).
  {
    id: 'reef.giant-squid',
    name: 'Giant Squid',
    tier: 5,
    roles: ['critter', 'guardian'],
    eats: ['reef.vampire-squid', 'reef.blacktip-reef-shark', 'reef.reef-eel', 'reef.pufferfish'],
    stats: stats({ hp: 960, speed: 3.6, damage: 152, attackRate: 0.9, range: 1.6, radius: 1.1, bounty: 285, mass: 8.5 }),
    guardian: guardianFor(5, { cost: 1300, satietyPerMeal: 0.28 }),
    model: { kit: 'squid', palette: ['#8a2be2', '#3a0d66', '#ff2fa0'], scale: 1.7, props: { tentacles: 10, hover: 1.5 } },
    flavor: 'The deep sent up its final answer, and it has eight opinions.',
    voice: { pitch: 60, timbre: 'rumble' },
  },
  {
    id: 'reef.great-white',
    name: 'Great White',
    tier: 5,
    roles: ['critter', 'guardian'],
    eats: ['reef.blacktip-reef-shark', 'reef.vampire-squid', 'reef.pufferfish', 'reef.reef-eel'],
    stats: stats({ hp: 860, speed: 9.6, damage: 168, attackRate: 1.1, range: 1.0, radius: 1.0, bounty: 305, mass: 7.2 }),
    guardian: guardianFor(5, { cost: 1550, placeCooldown: 1.6 }),
    model: { kit: 'shark', palette: ['#5c6b78', '#2a333c', '#f5f5f5'], scale: 1.5, props: { finHeight: 1.6, hover: 0.6 } },
    flavor: 'Every other guardian here is a compromise. This one is not.',
    voice: { pitch: 110, timbre: 'growl' },
  },
];

const HOUSE = p(0, 11);

const laneWest = lane('west', curve(p(-9, -14), HOUSE, 4, 10), 1);
const laneEast = lane('east', curve(p(9, -14), HOUSE, -4, 10), 1);
const laneNorth = lane('north', curve(p(0, -15), HOUSE, 2, 8), 1.3);

// Wave building blocks, reused and escalated with harder() across all four
// levels — the swarms open every level and the branch-crossers close it.
const w1 = wave([entry('reef.plankton', 30, { spacing: 0.15 })], { reward: 35, rest: 5, title: 'The tide brings snacks' });
const w2 = wave(
  [entry('reef.plankton', 25, { spacing: 0.15 }), entry('reef.glass-shrimp', 18, { spacing: 0.2, delay: 2 })],
  { reward: 55, rest: 5 },
);
const w3 = wave(
  [entry('reef.glass-shrimp', 22, { spacing: 0.15 }), entry('reef.cleaner-crab', 6, { spacing: 0.8, delay: 3 })],
  { reward: 75, rest: 6, title: 'Claws in the current' },
);
const w4 = wave(
  [entry('reef.plankton', 40, { spacing: 0.12 }), entry('reef.spine-urchin', 4, { spacing: 1.4, delay: 3 })],
  { reward: 95, rest: 6 },
);
const w5 = wave(
  [
    entry('reef.cleaner-crab', 8, { spacing: 0.5 }),
    entry('reef.clownfish', 5, { spacing: 1.0, delay: 3, lane: 'west' }),
    entry('reef.moon-jelly', 3, { spacing: 1.6, delay: 6, lane: 'east' }),
  ],
  { reward: 130, rest: 7, title: 'The current shifts' },
);
const w6 = wave(
  [entry('reef.glass-shrimp', 30, { spacing: 0.12 }), entry('reef.reef-snail', 5, { spacing: 1.2, delay: 3 })],
  { reward: 100, rest: 6, title: 'Slow and armoured' },
);
const w7 = wave(
  [entry('reef.clownfish', 12, { spacing: 0.3 }), entry('reef.pufferfish', 3, { spacing: 2, delay: 5, lane: 'north' })],
  { reward: 170, rest: 7, title: 'Puff up' },
);
const w8 = wave(
  [entry('reef.moon-jelly', 8, { spacing: 0.6 }), entry('reef.reef-eel', 3, { spacing: 2.2, delay: 5 })],
  { reward: 190, rest: 7, title: 'Something long and quick' },
);
const w9 = wave(
  [entry('reef.pufferfish', 6, { spacing: 1.2 }), entry('reef.vampire-squid', 2, { spacing: 3, delay: 8, lane: 'north' })],
  { reward: 260, rest: 8, title: 'Ink in the water' },
);
const w10 = wave(
  [entry('reef.reef-eel', 8, { spacing: 0.8 }), entry('reef.blacktip-reef-shark', 3, { spacing: 2.5, delay: 6 })],
  { reward: 300, rest: 8, title: 'Fin on the surface' },
);

export const reef: BiomeDef = {
  id: 'reef',
  name: 'Bubblewrack Reef',
  order: 3,
  blurb: 'Iridescent, hyperactive, and absolutely not going to sit still for you.',
  mapPosition: p(9, -3),
  unlock: { stars: 26 },
  palette: {
    sky: '#5fd8f0',
    ground: '#2fbfa8',
    groundAccent: '#1f8f7f',
    path: '#ff8fa3',
    fog: '#0d3d4a',
    sun: '#eafff5',
    rim: '#ffd23f',
  },
  music: 'reef',
  ambience: { bed: 'reef', density: 0.7 },
  species,
  levels: [
    {
      id: 'reef-1',
      name: 'The Shallows',
      arena: { width: 26, depth: 32 },
      house: { position: HOUSE, hp: 260 },
      lanes: [laneWest, laneEast],
      startingCoins: 90,
      starGoals: { houseHp: 0.9, coins: 220, noFeral: true },
      waves: [w1, w2, w3, w4, w5],
      props: [
        { kit: 'prop.rock', position: p(-10, 4), scale: 1.2 },
        { kit: 'prop.rock', position: p(11, 1), scale: 0.9, rotation: 1.1 },
        { kit: 'prop.bush', position: p(-5, 7) }, // coral clump
        { kit: 'prop.bush', position: p(6, 8), scale: 1.3 }, // anemone bed
        { kit: 'prop.tree', position: p(3, -3), scale: 0.7, rotation: 0.4 }, // kelp frond stand-in
      ],
      totems: [{ id: 'coinfall', kind: 'coinfall', position: p(-7, 9) }],
    },
    {
      id: 'reef-2',
      name: 'The Cross Current',
      arena: { width: 29, depth: 34 },
      house: { position: HOUSE, hp: 320 },
      lanes: [laneWest, laneEast, laneNorth],
      startingCoins: 150,
      starGoals: { houseHp: 0.85, coins: 520, noFeral: true },
      waves: [w5, w6, w7, harder(w4, 1.3, 15), w8, harder(w5, 1.5, 4)],
      props: [
        { kit: 'prop.rock', position: p(-12, 0), scale: 1.4 },
        { kit: 'prop.rock', position: p(9, 5) },
        { kit: 'prop.bush', position: p(-3, 9), scale: 1.2 },
        { kit: 'prop.bush', position: p(4, -4), scale: 0.9 },
      ],
      totems: [
        { id: 'coinfall', kind: 'coinfall', position: p(-8, 9) },
        { id: 'roar', kind: 'roar', position: p(8, 9) },
      ],
    },
    {
      id: 'reef-3',
      name: 'The Drop-Off',
      arena: { width: 32, depth: 36 },
      house: { position: HOUSE, hp: 420 },
      lanes: [laneWest, laneEast, laneNorth],
      startingCoins: 220,
      starGoals: { houseHp: 0.8, coins: 900 },
      // Every third wave is a mass swarm, per the biome's whole design twist.
      waves: [w6, w7, harder(w4, 1.4, 10), w8, w9, w10, harder(w9, 1.4, 2)],
      props: [
        { kit: 'prop.rock', position: p(-13, 2), scale: 1.6 },
        { kit: 'prop.rock', position: p(13, -2), scale: 1.3 },
        { kit: 'prop.bush', position: p(0, 2), scale: 1.4 },
        { kit: 'prop.bush', position: p(-6, 8) },
        { kit: 'prop.tree', position: p(7, 7), scale: 0.8 },
      ],
      totems: [
        { id: 'coinfall', kind: 'coinfall', position: p(-9, 9) },
        { id: 'roar', kind: 'roar', position: p(9, 9) },
      ],
    },
    {
      id: 'reef-4',
      name: 'Bubblewrack Trench',
      arena: { width: 34, depth: 38 },
      house: { position: HOUSE, hp: 480 },
      lanes: [laneWest, laneEast, laneNorth],
      startingCoins: 260,
      starGoals: { houseHp: 0.8, coins: 1400 },
      waves: [
        w9,
        w10,
        harder(w4, 1.6, 10),
        harder(w8, 1.5, 3),
        wave(
          [
            entry('reef.glass-shrimp', 40, { spacing: 0.1 }),
            entry('reef.blacktip-reef-shark', 4, { spacing: 1.5, delay: 6 }),
          ],
          { reward: 340, rest: 8, title: 'The trench exhales' },
        ),
        harder(w9, 1.6, 3),
        wave(
          [
            entry('reef.plankton', 45, { spacing: 0.1 }),
            entry('reef.blacktip-reef-shark', 5, { spacing: 1.5, delay: 5 }),
            entry('reef.vampire-squid', 4, { spacing: 1.8, delay: 8 }),
            entry('reef.giant-squid', 1, { spacing: 1, delay: 18, lane: 'north', boss: true }),
          ],
          { reward: 700, rest: 10, title: 'THE GIANT SQUID SURFACES' },
        ),
      ],
      props: [
        { kit: 'prop.rock', position: p(-14, 3), scale: 1.8 },
        { kit: 'prop.rock', position: p(14, -3), scale: 1.5 },
        { kit: 'prop.rock', position: p(0, 3), scale: 1.7 },
        { kit: 'prop.bush', position: p(-7, 9) },
        { kit: 'prop.bush', position: p(8, 8), scale: 1.2 },
      ],
      totems: [
        { id: 'coinfall', kind: 'coinfall', position: p(-10, 10) },
        { id: 'roar', kind: 'roar', position: p(10, 10) },
      ],
    },
  ],
};
