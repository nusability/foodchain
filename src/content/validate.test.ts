import { describe, expect, it } from 'vitest';
import { BIOMES } from './registry';
import { FoodChain } from '@/core/foodchain/chain';
import { KIT_VOCABULARY } from '@/render/models/registry';
import { songById } from '@/audio/music/songs';
import { testBiome, testLevel, testSpecies } from '../../tests/fixtures';
import { entry, lane, p, wave } from './helpers';
import { formatIssues, validateBiome, validateBiomes } from './validate';

describe('content validator', () => {
  it('accepts a well-formed biome', () => {
    const result = validateBiome(testBiome());
    expect(result.errors, formatIssues(result)).toEqual([]);
  });

  it('rejects a predator that eats something above it', () => {
    const biome = testBiome({
      species: [
        testSpecies({ id: 't.low', tier: 0, eats: ['t.high'] }),
        testSpecies({ id: 't.high', tier: 1 }),
      ],
    });
    expect(validateBiome(biome).errors.some((e) => /strictly above/.test(e.message))).toBe(true);
  });

  it('rejects a dangling prey reference', () => {
    const biome = testBiome({
      species: [testSpecies({ id: 't.a', tier: 0, eats: ['t.ghost'] })],
    });
    expect(validateBiome(biome).errors.some((e) => /unknown species/.test(e.message))).toBe(true);
  });

  it('rejects a species that eats itself', () => {
    const biome = testBiome({
      species: [testSpecies({ id: 't.a', tier: 0, eats: ['t.a'] })],
    });
    expect(validateBiome(biome).errors.some((e) => /cannot eat itself/.test(e.message))).toBe(true);
  });

  it('rejects a guardian nothing can eat — an unwinnable feral turn', () => {
    const biome = testBiome({
      species: [
        testSpecies({ id: 't.bug', tier: 0 }),
        testSpecies({
          id: 't.orphan',
          tier: 1,
          roles: ['critter', 'guardian'],
          eats: ['t.bug'],
          guardian: {
            cost: 10, costGrowth: 1.2, placeCooldown: 1, hungerRate: 0.1,
            satietyPerMeal: 0.5, feralScale: 2, warnTime: 2,
          },
        }),
        testSpecies({ id: 't.apex', tier: 2, eats: ['t.bug'] }),
      ],
      levels: [testLevel({ waves: [wave([entry('t.bug', 1, { lane: 'mid' })])] })],
    });
    expect(validateBiome(biome).errors.some((e) => /nothing in this biome eats it/.test(e.message))).toBe(true);
  });

  it('rejects a lane that stops short of the house', () => {
    const biome = testBiome({
      levels: [testLevel({ lanes: [lane('mid', [p(0, -10), p(0, 0)], 1)] })],
    });
    expect(validateBiome(biome).errors.some((e) => /from the house/.test(e.message))).toBe(true);
  });

  it('rejects a wave that spawns an unknown or unspawnable species', () => {
    const unknown = testBiome({
      levels: [testLevel({ waves: [wave([entry('t.ghost', 1, { lane: 'mid' })])] })],
    });
    expect(validateBiome(unknown).errors.some((e) => /unknown species/.test(e.message))).toBe(true);
  });

  it('rejects a wave pointing at a lane the level does not have', () => {
    const biome = testBiome({
      levels: [testLevel({ waves: [wave([entry('t.bug', 1, { lane: 'nowhere' })])] })],
    });
    expect(validateBiome(biome).errors.some((e) => /unknown lane/.test(e.message))).toBe(true);
  });

  it('rejects a purse that cannot afford the cheapest guardian', () => {
    const biome = testBiome({ levels: [testLevel({ startingCoins: 1 })] });
    expect(validateBiome(biome).errors.some((e) => /cheapest guardian/.test(e.message))).toBe(true);
  });

  it('rejects impossible star goals and bad colours', () => {
    const biome = testBiome({
      palette: { ...testBiome().palette, sky: 'blue' },
      levels: [testLevel({ starGoals: { houseHp: 4, coins: -1 } })],
    });
    const messages = validateBiome(biome).errors.map((e) => e.message).join('\n');
    expect(messages).toMatch(/not a #rrggbb colour/);
    expect(messages).toMatch(/fraction between 0 and 1/);
  });

  it('flags duplicate biome ids across a set', () => {
    const result = validateBiomes([testBiome(), testBiome()]);
    expect(result.errors.some((e) => /duplicate biome id/.test(e.message))).toBe(true);
  });
});

describe('shipped content', () => {
  const result = validateBiomes(BIOMES);

  it('has no errors', () => {
    expect(result.errors, formatIssues(result)).toEqual([]);
  });

  it('ships every biome the world map expects', () => {
    expect(BIOMES.length).toBeGreaterThanOrEqual(5);
    const orders = BIOMES.map((b) => b.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  for (const biome of BIOMES) {
    describe(biome.id, () => {
      const chain = FoodChain.fromBiome(biome);

      it('has a real chain, not a single ladder', () => {
        expect(chain.maxTier).toBeGreaterThanOrEqual(4);
        expect(biome.species.length).toBeGreaterThanOrEqual(8);
        // A tree: at least one tier holds more than one species.
        expect(chain.byTier().some((t) => t.length > 1)).toBe(true);
      });

      it('starts at tier 0 with critters that cannot be planted', () => {
        const roots = chain.byTier()[0];
        expect(roots.length).toBeGreaterThan(0);
        for (const r of roots) expect(r.eats).toEqual([]);
      });

      it('every placeable guardian below the apex has a predator', () => {
        const apexTier = chain.maxTier;
        for (const g of chain.guardians()) {
          if (g.tier >= apexTier) continue;
          expect(chain.predatorsOf(g.id).length, `${g.id} has no predator`).toBeGreaterThan(0);
        }
      });

      it('only uses model kits that exist', () => {
        const vocabulary = new Set<string>(KIT_VOCABULARY);
        for (const s of biome.species) expect(vocabulary.has(s.model.kit), s.model.kit).toBe(true);
        for (const level of biome.levels) {
          for (const prop of level.props ?? []) {
            expect(vocabulary.has(prop.kit), prop.kit).toBe(true);
          }
        }
      });

      it('names a song that exists', () => {
        expect(songById(biome.music), `missing song "${biome.music}"`).toBeDefined();
      });

      it('escalates: later levels are harder than earlier ones', () => {
        const pressure = biome.levels.map((l) =>
          l.waves.reduce((n, w) => n + w.entries.reduce((m, e) => m + e.count, 0), 0),
        );
        expect(pressure[pressure.length - 1]).toBeGreaterThan(pressure[0]);
      });

      it('ends on a boss', () => {
        const last = biome.levels[biome.levels.length - 1];
        const hasBoss = last.waves.some((w) => w.entries.some((e) => e.boss));
        expect(hasBoss, `${biome.id}'s last level has no boss wave`).toBe(true);
      });
    });
  }
});
