/**
 * The Meadow — biome 1, and the reference content pack.
 *
 * Every other biome follows this file's shape. The chain here is a shallow
 * tree: two roots at the bottom that fan up into a single bear at the top,
 * with a bird branch and a ground branch that cross over in the middle. That
 * shape matters — a player who over-invests in one branch gets punished when
 * the other branch's feral turncoats arrive.
 */
import type { BiomeDef, SpeciesDef } from '../schema';
import { curve, entry, guardianFor, harder, lane, p, stats, wave } from '../helpers';

const species: SpeciesDef[] = [
  {
    id: 'meadow.aphid',
    name: 'Aphid',
    tier: 0,
    roles: ['critter'],
    eats: [],
    stats: stats({ hp: 10, speed: 1.5, damage: 2, attackRate: 1.2, radius: 0.28, bounty: 3, mass: 0.4 }),
    model: { kit: 'grub', palette: ['#b9e86a', '#98cf4e', '#6d9c2c'], scale: 0.7, props: { segments: 3 } },
    flavor: 'It is mostly juice and ambition.',
    voice: { pitch: 900, timbre: 'squeak' },
  },
  {
    id: 'meadow.grasshopper',
    name: 'Grasshopper',
    tier: 0,
    roles: ['critter'],
    eats: [],
    stats: stats({ hp: 14, speed: 2.6, damage: 3, attackRate: 1, radius: 0.32, bounty: 4, mass: 0.5 }),
    model: { kit: 'hopper', palette: ['#8ede54', '#4f9b2a', '#d8f79a'], scale: 0.85 },
    flavor: 'Legs first, questions never.',
    voice: { pitch: 740, timbre: 'chirp' },
  },
  {
    id: 'meadow.beetle',
    name: 'Rhino Beetle',
    tier: 1,
    roles: ['critter', 'guardian'],
    eats: ['meadow.aphid'],
    stats: stats({ hp: 34, speed: 1.2, damage: 7, attackRate: 1.1, range: 0.6, radius: 0.42, bounty: 8, mass: 1.4 }),
    guardian: guardianFor(1),
    model: { kit: 'beetle', palette: ['#5a4bd6', '#2b2340', '#f0c24b'], props: { horn: 1.2 } },
    flavor: 'Armoured, grumpy, unreasonably strong for its size.',
    voice: { pitch: 220, timbre: 'growl' },
  },
  {
    id: 'meadow.fieldmouse',
    name: 'Field Mouse',
    tier: 1,
    roles: ['critter', 'guardian'],
    eats: ['meadow.aphid', 'meadow.grasshopper'],
    stats: stats({ hp: 26, speed: 3.1, damage: 6, attackRate: 1.6, radius: 0.36, bounty: 7, mass: 0.8 }),
    guardian: guardianFor(1, { cost: 45, hungerRate: 0.03 }),
    model: { kit: 'rodent', palette: ['#c9a882', '#8d6a4a', '#f2d3c1'], props: { earSize: 1.3, tail: 1.4 } },
    flavor: 'Eats its own body weight hourly. Do the maths.',
    voice: { pitch: 1100, timbre: 'squeak' },
  },
  {
    id: 'meadow.frog',
    name: 'Bullfrog',
    tier: 2,
    roles: ['critter', 'guardian'],
    eats: ['meadow.grasshopper', 'meadow.beetle', 'meadow.aphid'],
    stats: stats({ hp: 62, speed: 1.8, damage: 13, attackRate: 0.9, range: 2.2, radius: 0.55, bounty: 16, mass: 2 }),
    guardian: guardianFor(2),
    model: { kit: 'frog', palette: ['#5fbf4a', '#2f7a2b', '#f6e28a'], props: { tongue: 2.2 } },
    flavor: 'Tongue is technically a ranged weapon.',
    voice: { pitch: 140, timbre: 'honk' },
  },
  {
    id: 'meadow.sparrow',
    name: 'Sparrow',
    tier: 2,
    roles: ['critter', 'guardian'],
    eats: ['meadow.aphid', 'meadow.grasshopper', 'meadow.beetle'],
    stats: stats({ hp: 48, speed: 4.2, damage: 11, attackRate: 1.8, radius: 0.4, bounty: 15, mass: 1 }),
    guardian: guardianFor(2, { cost: 120, placeCooldown: 0.9 }),
    model: { kit: 'bird', palette: ['#a8794f', '#6b4a2c', '#f4e9d4'], props: { wingSpan: 1.1 } },
    flavor: 'Small. Constant. Menace.',
    voice: { pitch: 1600, timbre: 'chirp' },
  },
  {
    id: 'meadow.snake',
    name: 'Grass Snake',
    tier: 3,
    roles: ['critter', 'guardian'],
    eats: ['meadow.fieldmouse', 'meadow.frog', 'meadow.sparrow'],
    stats: stats({ hp: 120, speed: 2.4, damage: 26, attackRate: 1.2, range: 1.6, radius: 0.5, bounty: 34, mass: 2.4 }),
    guardian: guardianFor(3),
    model: { kit: 'serpent', palette: ['#6f9e3c', '#3f5f22', '#e8d36a'], props: { segments: 8 } },
    flavor: 'Legless and thriving.',
    voice: { pitch: 300, timbre: 'growl' },
  },
  {
    id: 'meadow.fox',
    name: 'Red Fox',
    tier: 3,
    roles: ['critter', 'guardian'],
    eats: ['meadow.fieldmouse', 'meadow.sparrow', 'meadow.frog'],
    stats: stats({ hp: 140, speed: 3.6, damage: 30, attackRate: 1.3, range: 0.8, radius: 0.62, bounty: 38, mass: 3 }),
    guardian: guardianFor(3, { cost: 260 }),
    model: { kit: 'quadruped', palette: ['#e0713a', '#b14a1e', '#f7efe2', '#2b2340'], props: { snout: 1.3, tail: 1.8, earPoint: 1 } },
    flavor: 'Has a plan. The plan is teeth.',
    voice: { pitch: 420, timbre: 'growl' },
  },
  {
    id: 'meadow.badger',
    name: 'Badger',
    tier: 4,
    roles: ['critter', 'guardian'],
    eats: ['meadow.snake', 'meadow.fox', 'meadow.fieldmouse'],
    stats: stats({ hp: 300, speed: 2.2, damage: 58, attackRate: 1.1, range: 0.9, radius: 0.75, bounty: 80, mass: 5 }),
    guardian: guardianFor(4),
    model: { kit: 'quadruped', palette: ['#3a3a44', '#f2f0e6', '#6b6b78', '#2b2340'], scale: 1.2, props: { snout: 1.1, tail: 0.6, stripe: 1, bulk: 1.4 } },
    flavor: 'Fears nothing. Owns a shovel.',
    voice: { pitch: 190, timbre: 'rumble' },
  },
  {
    id: 'meadow.hawk',
    name: 'Harrier Hawk',
    tier: 4,
    roles: ['critter', 'guardian'],
    eats: ['meadow.snake', 'meadow.sparrow', 'meadow.fox'],
    stats: stats({ hp: 250, speed: 4.6, damage: 64, attackRate: 1.4, range: 1.2, radius: 0.7, bounty: 84, mass: 3.6 }),
    guardian: guardianFor(4, { cost: 620, placeCooldown: 1.4 }),
    model: { kit: 'raptor', palette: ['#7a5a3a', '#d9c9a8', '#f0b429', '#2b2340'], scale: 1.15, props: { wingSpan: 1.5 } },
    flavor: 'Arrives from directly above. Rude.',
    voice: { pitch: 1300, timbre: 'chirp' },
  },
  {
    id: 'meadow.bear',
    name: 'Meadow Bear',
    tier: 5,
    roles: ['critter', 'guardian'],
    eats: ['meadow.badger', 'meadow.hawk', 'meadow.fox', 'meadow.snake'],
    stats: stats({ hp: 900, speed: 1.9, damage: 130, attackRate: 0.9, range: 1.3, radius: 1.05, bounty: 220, mass: 9 }),
    guardian: guardianFor(5, { cost: 1400, satietyPerMeal: 0.3 }),
    model: { kit: 'bear', palette: ['#8a5a36', '#5c3a22', '#f0d9b5', '#2b2340'], scale: 1.5, props: { bulk: 1.2 } },
    flavor: 'The last word in meadow-based conflict resolution.',
    voice: { pitch: 90, timbre: 'rumble' },
  },
];

const HOUSE = p(0, 11);

const laneWest = lane('west', curve(p(-9, -14), HOUSE, 3.2, 10), 1);
const laneEast = lane('east', curve(p(9, -14), HOUSE, -3.2, 10), 1);
const laneNorth = lane('north', curve(p(0, -15), HOUSE, 1.5, 8), 1.4);

const w1 = wave([entry('meadow.aphid', 8, { spacing: 0.55 })], { reward: 30, rest: 7, title: 'Something is nibbling' });
const w2 = wave(
  [entry('meadow.aphid', 10, { spacing: 0.4 }), entry('meadow.grasshopper', 5, { spacing: 0.7, delay: 3 })],
  { reward: 45, rest: 6 },
);
const w3 = wave(
  [
    entry('meadow.grasshopper', 12, { spacing: 0.35 }),
    entry('meadow.beetle', 4, { spacing: 1.1, delay: 4 }),
  ],
  { reward: 60, rest: 6, title: 'Shells incoming' },
);
const w4 = wave(
  [
    entry('meadow.aphid', 20, { spacing: 0.18 }),
    entry('meadow.fieldmouse', 6, { spacing: 0.8, delay: 2 }),
  ],
  { reward: 80, rest: 6 },
);
const w5 = wave(
  [
    entry('meadow.beetle', 10, { spacing: 0.5 }),
    entry('meadow.frog', 3, { spacing: 1.6, delay: 5, lane: 'west' }),
    entry('meadow.sparrow', 4, { spacing: 1, delay: 7, lane: 'east' }),
  ],
  { reward: 110, rest: 7, title: 'The middle of the chain wakes up' },
);

export const meadow: BiomeDef = {
  id: 'meadow',
  name: 'Buttercup Meadow',
  order: 0,
  blurb: 'Gentle. Sunlit. Absolutely crawling with things that want your house.',
  mapPosition: p(-6, 2),
  unlock: { stars: 0 },
  palette: {
    sky: '#9fe3f5',
    ground: '#8fd45c',
    groundAccent: '#75bf46',
    path: '#d9b877',
    fog: '#cdefff',
    sun: '#fff6d6',
    rim: '#ffd9a0',
  },
  music: 'meadow',
  ambience: { bed: 'wind', density: 0.4 },
  species,
  levels: [
    {
      id: 'meadow-1',
      name: 'The Back Garden',
      arena: { width: 26, depth: 32 },
      house: { position: HOUSE, hp: 260 },
      lanes: [laneWest, laneEast],
      startingCoins: 90,
      starGoals: { houseHp: 0.9, coins: 260, noFeral: true },
      waves: [w1, w2, w3, w4, w5],
      props: [
        { kit: 'prop.tree', position: p(-10, 4), scale: 1.2 },
        { kit: 'prop.tree', position: p(11, 1), scale: 0.9, rotation: 1.1 },
        { kit: 'prop.bush', position: p(-5, 7) },
        { kit: 'prop.bush', position: p(6, 8), scale: 1.3 },
        { kit: 'prop.rock', position: p(3, -3), scale: 1.1 },
      ],
      totems: [{ id: 'coinfall', kind: 'coinfall', position: p(-7, 9) }],
    },
    {
      id: 'meadow-2',
      name: 'Three Ways In',
      arena: { width: 30, depth: 34 },
      house: { position: HOUSE, hp: 320 },
      lanes: [laneWest, laneEast, laneNorth],
      startingCoins: 120,
      starGoals: { houseHp: 0.85, coins: 520, noFeral: true },
      waves: [
        w2,
        w3,
        w4,
        w5,
        harder(w4, 1.4, 4),
        wave(
          [
            entry('meadow.fieldmouse', 14, { spacing: 0.3 }),
            entry('meadow.snake', 2, { spacing: 2.4, delay: 6, lane: 'north' }),
          ],
          { reward: 150, rest: 7, title: 'Something long is coming' },
        ),
        harder(w5, 1.6, 3),
      ],
      props: [
        { kit: 'prop.tree', position: p(-12, 0), scale: 1.4 },
        { kit: 'prop.rock', position: p(9, 5) },
        { kit: 'prop.bush', position: p(-3, 9), scale: 1.2 },
      ],
      totems: [
        { id: 'coinfall', kind: 'coinfall', position: p(-8, 9) },
        { id: 'roar', kind: 'roar', position: p(8, 9) },
      ],
    },
    {
      id: 'meadow-3',
      name: 'Bear Country',
      arena: { width: 32, depth: 36 },
      house: { position: HOUSE, hp: 420 },
      lanes: [laneWest, laneEast, laneNorth],
      startingCoins: 180,
      starGoals: { houseHp: 0.8, coins: 900 },
      waves: [
        w3,
        w4,
        w5,
        harder(w5, 1.5, 2),
        wave(
          [
            entry('meadow.sparrow', 16, { spacing: 0.25 }),
            entry('meadow.fox', 3, { spacing: 2, delay: 5 }),
          ],
          { reward: 190, rest: 7 },
        ),
        wave(
          [
            entry('meadow.snake', 6, { spacing: 1.4 }),
            entry('meadow.badger', 2, { spacing: 3, delay: 8, lane: 'north' }),
          ],
          { reward: 240, rest: 8, title: 'Diggers' },
        ),
        wave(
          [
            entry('meadow.grasshopper', 30, { spacing: 0.12 }),
            entry('meadow.hawk', 4, { spacing: 1.8, delay: 6 }),
          ],
          { reward: 300, rest: 9, title: 'Sky and grass at once' },
        ),
        wave(
          [
            entry('meadow.fox', 8, { spacing: 0.9 }),
            entry('meadow.badger', 4, { spacing: 2.2, delay: 5 }),
            entry('meadow.bear', 1, { spacing: 1, delay: 14, lane: 'north', boss: true }),
          ],
          { reward: 600, rest: 10, title: 'THE MEADOW BEAR' },
        ),
      ],
      props: [
        { kit: 'prop.tree', position: p(-13, 2), scale: 1.5 },
        { kit: 'prop.tree', position: p(13, -2), scale: 1.3 },
        { kit: 'prop.rock', position: p(0, 2), scale: 1.6 },
        { kit: 'prop.bush', position: p(-6, 8) },
        { kit: 'prop.bush', position: p(7, 7), scale: 1.1 },
      ],
      totems: [
        { id: 'coinfall', kind: 'coinfall', position: p(-9, 9) },
        { id: 'roar', kind: 'roar', position: p(9, 9) },
      ],
    },
  ],
};
