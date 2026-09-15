/**
 * A minimal, fully-controlled biome for simulation tests.
 *
 * Deliberately not one of the shipping biomes: those are tuned for *feel* and
 * will keep changing, which would make every assertion here brittle. This one
 * has round numbers so expected outcomes can be reasoned about by hand.
 */
import type { BiomeDef, LevelDef, SpeciesDef } from '@/content/schema';
import { entry, lane, p, stats, wave } from '@/content/helpers';

export function testSpecies(overrides: Partial<SpeciesDef> & Pick<SpeciesDef, 'id' | 'tier'>): SpeciesDef {
  return {
    name: overrides.id,
    roles: ['critter'],
    eats: [],
    stats: stats({ hp: 20, speed: 2, damage: 5, attackRate: 1, range: 0.5, radius: 0.4, bounty: 5, mass: 1 }),
    model: { kit: 'grub', palette: ['#ffffff'] },
    ...overrides,
  } as SpeciesDef;
}

export const BUG = testSpecies({
  id: 't.bug',
  tier: 0,
  stats: stats({ hp: 20, speed: 2, damage: 4, attackRate: 1, range: 0.5, radius: 0.4, bounty: 5, mass: 1 }),
});

export const FROG = testSpecies({
  id: 't.frog',
  tier: 1,
  roles: ['critter', 'guardian'],
  eats: ['t.bug'],
  stats: stats({ hp: 60, speed: 1, damage: 20, attackRate: 2, range: 2, radius: 0.5, bounty: 12, mass: 2 }),
  guardian: {
    cost: 20,
    costGrowth: 1.5,
    placeCooldown: 1,
    hungerRate: 0.1,      // 10 seconds from full to feral
    satietyPerMeal: 0.5,
    feralScale: 2,
    warnTime: 2,
  },
});

export const HAWK = testSpecies({
  id: 't.hawk',
  tier: 2,
  roles: ['critter', 'guardian'],
  eats: ['t.frog', 't.bug'],
  stats: stats({ hp: 200, speed: 3, damage: 60, attackRate: 2, range: 2, radius: 0.6, bounty: 40, mass: 3 }),
  guardian: {
    cost: 150,
    costGrowth: 1.5,
    placeCooldown: 1,
    hungerRate: 0.05,
    satietyPerMeal: 0.4,
    feralScale: 2,
    warnTime: 3,
  },
});

export const HOUSE = p(0, 10);

export function testLevel(overrides: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 't-1',
    name: 'Test Level',
    arena: { width: 20, depth: 30 },
    house: { position: HOUSE, hp: 200 },
    lanes: [lane('mid', [p(0, -10), p(0, 0), HOUSE], 1)],
    startingCoins: 100,
    starGoals: { houseHp: 0.9, coins: 50, noFeral: true },
    waves: [wave([entry('t.bug', 3, { spacing: 1, lane: 'mid' })], { reward: 30, rest: 2 })],
    ...overrides,
  };
}

export function testBiome(overrides: Partial<BiomeDef> = {}): BiomeDef {
  return {
    id: 't',
    name: 'Testing Grounds',
    order: 0,
    blurb: 'for tests',
    mapPosition: p(0, 0),
    unlock: { stars: 0 },
    palette: {
      sky: '#000000',
      ground: '#111111',
      groundAccent: '#222222',
      path: '#333333',
      fog: '#444444',
      sun: '#555555',
      rim: '#666666',
    },
    music: 'meadow',
    species: [BUG, FROG, HAWK],
    levels: [testLevel()],
    ...overrides,
  };
}

/** Steps a simulation for `seconds` at the real fixed timestep. */
export function run(sim: { step(dt: number): void }, seconds: number, dt = 1 / 60): void {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) sim.step(dt);
}
