/**
 * Frostwhisker Tundra — biome 3.
 *
 * Design twist: this biome is slow and heavy where the Meadow is frantic and
 * light. Speeds are down, HP is way up, and waves run longer between rests.
 * That single change reshapes the hunger problem: a guardian out here goes a
 * long time between kills simply because the enemy is sparse and tanky, not
 * swarming. So several guardians (the ones from tier 3 up) get a deliberately
 * *lower* `hungerRate` than `guardianFor` would give them — they can outlast
 * a dry spell — paired with a much bigger `feralScale`. The bargain is: you
 * rarely see them turn, but when a muskox or a polar bear finally does, it is
 * not a nuisance, it is a catastrophe that erases the lane it was guarding.
 *
 * The chain is two branches — a burrow line (fur, ground-hugging) and a sky
 * line (feather, wind) — that start crossing at tier 2 and are fully tangled
 * by tier 4, merging under the yeti at the top. A player who only builds the
 * burrow line gets caught by the sky line's ferals, and vice versa.
 */
import type { BiomeDef, SpeciesDef } from '../schema';
import { curve, entry, guardianFor, harder, lane, p, stats, wave } from '../helpers';

const species: SpeciesDef[] = [
  // --- tier 0: roots. No guardian block — nothing this small can be planted. ---
  {
    id: 'tundra.snow-grub',
    name: 'Snow Grub',
    tier: 0,
    roles: ['critter'],
    eats: [],
    stats: stats({ hp: 16, speed: 1.0, damage: 2, attackRate: 1.0, radius: 0.3, bounty: 5, mass: 0.5 }),
    model: { kit: 'grub', palette: ['#eaf5ff', '#c9e3f5', '#8fbfe0'], scale: 0.65, props: { segments: 3 } },
    flavor: 'Lives under the crust. Never seen the sky, does not care.',
    voice: { pitch: 850, timbre: 'squeak' },
  },
  {
    id: 'tundra.snow-moth',
    name: 'Snow Moth',
    tier: 0,
    roles: ['critter'],
    eats: [],
    stats: stats({ hp: 13, speed: 1.8, damage: 2, attackRate: 1.1, radius: 0.28, bounty: 5, mass: 0.35 }),
    model: { kit: 'moth', palette: ['#f5f8ff', '#d8e6f5', '#b0cbe6'], scale: 0.7, props: { wingSpan: 1.1, hover: 0.8 } },
    flavor: 'Wings like frost on a window. Flies slow — the cold makes everything slow.',
    voice: { pitch: 1200, timbre: 'chirp' },
  },

  // --- tier 1: the first two answers. Plain guardianFor defaults except a
  // slightly trimmed hungerRate — the "things spend longer without kills"
  // idea starts here, gently, before it gets extreme higher up. ---
  {
    id: 'tundra.lemming',
    name: 'Lemming',
    tier: 1,
    roles: ['critter', 'guardian'],
    eats: ['tundra.snow-grub'],
    stats: stats({ hp: 42, speed: 1.6, damage: 8, attackRate: 1.0, range: 0.6, radius: 0.4, bounty: 12, mass: 1.1 }),
    guardian: guardianFor(1, { hungerRate: 0.016 }),
    model: { kit: 'rodent', palette: ['#c9a875', '#8a6a45', '#f2e3c8'], props: { earSize: 1.0, tail: 0.8 } },
    flavor: 'Everyone assumes lemmings are reckless. This one is just cold and hungry.',
    voice: { pitch: 1050, timbre: 'squeak' },
  },
  {
    id: 'tundra.ptarmigan',
    name: 'Ptarmigan',
    tier: 1,
    roles: ['critter', 'guardian'],
    eats: ['tundra.snow-grub', 'tundra.snow-moth'],
    stats: stats({ hp: 38, speed: 2.3, damage: 7, attackRate: 1.3, range: 0.7, radius: 0.35, bounty: 11, mass: 0.9 }),
    guardian: guardianFor(1, { hungerRate: 0.018, cost: 65 }),
    model: { kit: 'bird', palette: ['#f4f2ec', '#d9d4c4', '#5a5850'], props: { wingSpan: 1.0 } },
    flavor: 'Turns white for winter. Turns feral for nothing at all.',
    voice: { pitch: 900, timbre: 'chirp' },
  },

  // --- tier 2: the crossing begins. Snowy Owl reaches down for a lemming —
  // a sky-line predator eating off the ground line — which is what makes the
  // two branches read as one tree instead of two separate ladders. ---
  {
    id: 'tundra.arctic-hare',
    name: 'Arctic Hare',
    tier: 2,
    roles: ['critter', 'guardian'],
    eats: ['tundra.snow-grub', 'tundra.snow-moth', 'tundra.lemming'],
    stats: stats({ hp: 95, speed: 2.4, damage: 16, attackRate: 0.9, range: 0.9, radius: 0.5, bounty: 26, mass: 1.8 }),
    guardian: guardianFor(2, { hungerRate: 0.022 }),
    model: { kit: 'bunny', palette: ['#f6faff', '#d9e6f0', '#9fb8cc'], scale: 1.05, props: { earLength: 1.6, fluff: 0.6 } },
    flavor: 'Outruns wolves in a straight line. The lane is rarely straight.',
    voice: { pitch: 620, timbre: 'honk' },
  },
  {
    id: 'tundra.snowy-owl',
    name: 'Snowy Owl',
    tier: 2,
    roles: ['critter', 'guardian'],
    eats: ['tundra.snow-moth', 'tundra.lemming', 'tundra.ptarmigan'],
    stats: stats({ hp: 82, speed: 3.4, damage: 15, attackRate: 1.2, range: 1.4, radius: 0.45, bounty: 24, mass: 1.4 }),
    guardian: guardianFor(2, { hungerRate: 0.024, cost: 150, placeCooldown: 1.0 }),
    model: { kit: 'raptor', palette: ['#f8f9fb', '#e2e6ee', '#c7ccd6', '#2b2340'], props: { wingSpan: 1.4 } },
    flavor: 'Silent flight. The lemmings never got a vote.',
    voice: { pitch: 280, timbre: 'growl' },
  },

  // --- tier 3: full cross-over. Arctic Fox reaches up into the sky line for
  // the owl; Wolf reaches down into the ground line for the hare. From here
  // on, "the burrow branch" and "the sky branch" are a naming convenience,
  // not a real separation — every predator eats across both. Hunger timers
  // get their first real trim here: these two can sit fed-up for a while. ---
  {
    id: 'tundra.arctic-fox',
    name: 'Arctic Fox',
    tier: 3,
    roles: ['critter', 'guardian'],
    eats: ['tundra.lemming', 'tundra.arctic-hare', 'tundra.snowy-owl'],
    stats: stats({ hp: 205, speed: 2.0, damage: 32, attackRate: 1.1, range: 1.0, radius: 0.58, bounty: 52, mass: 2.8 }),
    guardian: guardianFor(3, { hungerRate: 0.02, feralScale: 2.3 }),
    model: { kit: 'quadruped', palette: ['#f2f5f8', '#c7d3de', '#eef3f7', '#2b2340'], props: { snout: 1.2, tail: 1.6, earPoint: 1 } },
    flavor: 'Pounces through the crust on sound alone. Patient enough to starve slowly.',
    voice: { pitch: 380, timbre: 'growl' },
  },
  {
    id: 'tundra.wolf',
    name: 'Tundra Wolf',
    tier: 3,
    roles: ['critter', 'guardian'],
    eats: ['tundra.ptarmigan', 'tundra.snowy-owl', 'tundra.arctic-hare'],
    stats: stats({ hp: 225, speed: 2.6, damage: 36, attackRate: 1.2, range: 1.0, radius: 0.6, bounty: 58, mass: 3.0 }),
    guardian: guardianFor(3, { hungerRate: 0.022, feralScale: 2.4, cost: 300 }),
    model: { kit: 'quadruped', palette: ['#8a8f96', '#54585e', '#e8ecef', '#2b2340'], scale: 1.1, props: { snout: 1.3, tail: 1.2, earPoint: 1.2, bulk: 1.1 } },
    flavor: 'Runs in a pack of one and has never noticed.',
    voice: { pitch: 260, timbre: 'growl' },
  },

  // --- tier 4: the heavies. Both eat from both branches' tier-3 predators,
  // so either one alone can plug a lane the fox/wolf pair failed on. This is
  // where the design twist is loudest: hungerRate is cut hard and feralScale
  // pushed near triple — a feral muskox or polar bear is meant to feel like
  // losing the lane outright, not a bigger version of the same problem. ---
  {
    id: 'tundra.muskox',
    name: 'Muskox',
    tier: 4,
    roles: ['critter', 'guardian'],
    eats: ['tundra.arctic-hare', 'tundra.arctic-fox', 'tundra.wolf'],
    stats: stats({ hp: 480, speed: 1.3, damage: 64, attackRate: 0.8, range: 1.0, radius: 0.9, bounty: 120, mass: 6.5 }),
    guardian: guardianFor(4, { hungerRate: 0.018, feralScale: 2.8 }),
    model: { kit: 'stag', palette: ['#4a3b30', '#2b2016', '#8a725a'], scale: 1.3, props: { horn: 1.4, bulk: 1.5 } },
    flavor: 'Forms a ring against wolves. Forms a wall against everything else.',
    voice: { pitch: 150, timbre: 'rumble' },
  },
  {
    id: 'tundra.polar-bear',
    name: 'Polar Bear',
    tier: 4,
    roles: ['critter', 'guardian'],
    eats: ['tundra.wolf', 'tundra.arctic-fox', 'tundra.snowy-owl'],
    stats: stats({ hp: 520, speed: 1.7, damage: 72, attackRate: 0.9, range: 1.2, radius: 0.95, bounty: 130, mass: 7 }),
    guardian: guardianFor(4, { hungerRate: 0.02, feralScale: 2.9, cost: 700 }),
    model: { kit: 'bear', palette: ['#f5f7fa', '#dde3ea', '#c2cad4', '#2b2340'], scale: 1.4, props: { bulk: 1.3 } },
    flavor: 'Swims for fun. Walks for hunger. Rarely does either quickly.',
    voice: { pitch: 100, timbre: 'rumble' },
  },

  // --- tier 5: apex. Eats all four tier-3/4 predators, so both branches
  // finally merge under one animal. It carries the same low-hunger,
  // high-feral tuning as the tier-4 pair, turned up further — nothing eats
  // it back, so its feral form has to be beatable by raw damage alone, the
  // way the Meadow Bear is. ---
  {
    id: 'tundra.yeti',
    name: 'Yeti',
    tier: 5,
    roles: ['critter', 'guardian'],
    eats: ['tundra.muskox', 'tundra.polar-bear', 'tundra.arctic-fox', 'tundra.wolf'],
    stats: stats({ hp: 1500, speed: 1.5, damage: 170, attackRate: 0.85, range: 1.5, radius: 1.2, bounty: 300, mass: 11 }),
    guardian: guardianFor(5, { hungerRate: 0.016, feralScale: 3.2, satietyPerMeal: 0.32, cost: 1600 }),
    model: { kit: 'yeti', palette: ['#eef2f7', '#c9d3dd', '#8fa0b3', '#2b2340'], scale: 1.6, props: { bulk: 1.4 } },
    flavor: 'The tundra does not end. It just gets a face.',
    voice: { pitch: 60, timbre: 'rumble' },
  },
];

const HOUSE = p(0, 12);

// Curve endpoints land exactly on HOUSE (sway is 0 at t=1), so every lane
// clears the "ends within 3 units of the house" rule with room to spare.
const laneWest = lane('west', curve(p(-11, -15), HOUSE, 3.5, 10), 1);
const laneEast = lane('east', curve(p(11, -15), HOUSE, -3.5, 10), 1);
const laneNorth = lane('north', curve(p(0, -16), HOUSE, 1.8, 8), 1.3);

// Base wave shapes, reused and escalated with harder() across the four
// levels — the same "introduce one species, then a mass wave" pacing as the
// Meadow, but stretched out: longer rests, because heavier things take
// longer to chew through and the player needs the room to think.
const w1 = wave([entry('tundra.snow-grub', 8, { spacing: 0.6 })], { reward: 30, rest: 8, title: 'Something moves under the crust' });
const w2 = wave(
  [entry('tundra.snow-grub', 10, { spacing: 0.45 }), entry('tundra.snow-moth', 5, { spacing: 0.75, delay: 3 })],
  { reward: 45, rest: 7 },
);
const w3 = wave(
  [entry('tundra.snow-moth', 12, { spacing: 0.4 }), entry('tundra.lemming', 4, { spacing: 1.2, delay: 4 })],
  { reward: 65, rest: 8, title: 'Burrows open' },
);
const w4 = wave(
  [entry('tundra.snow-grub', 22, { spacing: 0.16 }), entry('tundra.ptarmigan', 6, { spacing: 0.9, delay: 3 })],
  { reward: 90, rest: 8 },
);
const w5 = wave(
  [
    entry('tundra.lemming', 10, { spacing: 0.55 }),
    entry('tundra.arctic-hare', 3, { spacing: 1.8, delay: 5, lane: 'west' }),
    entry('tundra.snowy-owl', 4, { spacing: 1.1, delay: 7, lane: 'east' }),
  ],
  { reward: 130, rest: 9, title: 'The middle of the chain wakes up' },
);

export const tundra: BiomeDef = {
  id: 'tundra',
  name: 'Frostwhisker Tundra',
  order: 2,
  blurb: 'Vast. White. Silent. Everything out here is bigger than it looks under the snow.',
  mapPosition: p(9, -6),
  unlock: { stars: 15 },
  palette: {
    sky: '#a9a3e6',
    ground: '#eef6fb',
    groundAccent: '#cfe3f0',
    path: '#9fd0e8',
    fog: '#f4f8ff',
    sun: '#eaf0ff',
    rim: '#7f6fd1',
  },
  music: 'tundra',
  ambience: { bed: 'ice', density: 0.3 },
  species,
  levels: [
    {
      id: 'tundra-1',
      name: 'Under the Snow',
      arena: { width: 28, depth: 34 },
      house: { position: HOUSE, hp: 300 },
      lanes: [laneWest, laneEast],
      startingCoins: 110,
      starGoals: { houseHp: 0.9, coins: 300, noFeral: true },
      waves: [w1, w2, w3, w4, w5],
      props: [
        { kit: 'prop.rock', position: p(-10, 3), scale: 1.4 },
        { kit: 'prop.rock', position: p(11, 0), scale: 1.1, rotation: 0.8 },
        { kit: 'prop.tree', position: p(-4, 7), scale: 0.7 },
        { kit: 'prop.tree', position: p(6, 8), scale: 0.6 },
      ],
      totems: [{ id: 'coinfall', kind: 'coinfall', position: p(-7, 9) }],
    },
    {
      id: 'tundra-2',
      name: 'Where Two Trails Meet',
      arena: { width: 30, depth: 36 },
      house: { position: HOUSE, hp: 380 },
      lanes: [laneWest, laneEast, laneNorth],
      startingCoins: 150,
      starGoals: { houseHp: 0.85, coins: 640, noFeral: true },
      waves: [
        w2,
        w3,
        w4,
        w5,
        harder(w4, 1.4, 4),
        wave(
          [
            entry('tundra.arctic-hare', 12, { spacing: 0.35 }),
            entry('tundra.arctic-fox', 2, { spacing: 2.4, delay: 6, lane: 'north' }),
          ],
          { reward: 170, rest: 9, title: 'Fox tracks cross the trail' },
        ),
        harder(w5, 1.6, 3),
      ],
      props: [
        { kit: 'prop.rock', position: p(-12, 1), scale: 1.6 },
        { kit: 'prop.rock', position: p(9, 5), scale: 1.2 },
        { kit: 'prop.tree', position: p(-3, 9), scale: 0.7 },
      ],
      totems: [
        { id: 'coinfall', kind: 'coinfall', position: p(-8, 9) },
        { id: 'roar', kind: 'roar', position: p(8, 9) },
      ],
    },
    {
      id: 'tundra-3',
      name: 'The Long Hunt',
      arena: { width: 32, depth: 37 },
      house: { position: HOUSE, hp: 460 },
      lanes: [laneWest, laneEast, laneNorth],
      startingCoins: 200,
      starGoals: { houseHp: 0.8, coins: 1100 },
      waves: [
        w3,
        w4,
        w5,
        harder(w5, 1.5, 2),
        wave(
          [entry('tundra.snowy-owl', 16, { spacing: 0.28 }), entry('tundra.wolf', 3, { spacing: 2.2, delay: 5 })],
          { reward: 220, rest: 9, title: 'A pack on the ridgeline' },
        ),
        wave(
          [
            entry('tundra.arctic-fox', 6, { spacing: 1.6 }),
            entry('tundra.muskox', 2, { spacing: 3.4, delay: 8, lane: 'north' }),
          ],
          { reward: 280, rest: 10, title: 'Something huge is trampling in' },
        ),
        wave(
          [entry('tundra.lemming', 30, { spacing: 0.13 }), entry('tundra.polar-bear', 2, { spacing: 2.6, delay: 7 })],
          { reward: 340, rest: 10, title: 'White fur on white snow' },
        ),
      ],
      props: [
        { kit: 'prop.rock', position: p(-13, 2), scale: 1.7 },
        { kit: 'prop.rock', position: p(13, -2), scale: 1.4 },
        { kit: 'prop.tree', position: p(0, 3), scale: 0.6 },
      ],
      totems: [
        { id: 'coinfall', kind: 'coinfall', position: p(-9, 9) },
        { id: 'roar', kind: 'roar', position: p(9, 9) },
      ],
    },
    {
      id: 'tundra-4',
      name: 'Where the Yeti Walks',
      arena: { width: 34, depth: 38 },
      house: { position: HOUSE, hp: 560 },
      lanes: [laneWest, laneEast, laneNorth],
      startingCoins: 260,
      starGoals: { houseHp: 0.8, coins: 1600 },
      waves: [
        w4,
        w5,
        harder(w5, 1.6, 3),
        wave(
          [entry('tundra.arctic-fox', 10, { spacing: 0.9 }), entry('tundra.wolf', 6, { spacing: 1.3, delay: 4 })],
          { reward: 260, rest: 9, title: 'Both trails at once' },
        ),
        wave(
          [entry('tundra.snow-moth', 30, { spacing: 0.13 }), entry('tundra.muskox', 3, { spacing: 2.4, delay: 8 })],
          { reward: 320, rest: 10, title: 'The herd stampedes' },
        ),
        wave(
          [entry('tundra.wolf', 8, { spacing: 1.0 }), entry('tundra.polar-bear', 3, { spacing: 2.6, delay: 6, lane: 'north' })],
          { reward: 400, rest: 11, title: 'Ice and claws' },
        ),
        wave(
          [
            entry('tundra.muskox', 6, { spacing: 1.6 }),
            entry('tundra.polar-bear', 4, { spacing: 2.0, delay: 5 }),
            entry('tundra.yeti', 1, { spacing: 1, delay: 16, lane: 'north', boss: true }),
          ],
          { reward: 900, rest: 12, title: 'THE YETI DESCENDS' },
        ),
      ],
      props: [
        { kit: 'prop.rock', position: p(-14, 3), scale: 1.8 },
        { kit: 'prop.rock', position: p(14, -3), scale: 1.5 },
        { kit: 'prop.rock', position: p(0, 4), scale: 2.0 },
      ],
      totems: [
        { id: 'coinfall', kind: 'coinfall', position: p(-9, 10) },
        { id: 'roar', kind: 'roar', position: p(9, 10) },
      ],
    },
  ],
};
