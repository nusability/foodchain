import { describe, expect, it } from 'vitest';
import type { SpeciesDef } from '@/content/schema';
import { guardianFor, stats } from '@/content/helpers';
import { FoodChain } from './chain';

function species(
  id: string,
  tier: number,
  eats: string[],
  opts: { guardian?: boolean; cost?: number } = {},
): SpeciesDef {
  return {
    id,
    name: id,
    tier,
    roles: opts.guardian ? ['critter', 'guardian'] : ['critter'],
    eats,
    stats: stats({ hp: 10 * (tier + 1), speed: 2, damage: 5 }),
    ...(opts.guardian
      ? { guardian: { ...guardianFor(tier), ...(opts.cost ? { cost: opts.cost } : {}) } }
      : {}),
    model: { kit: 'grub', palette: ['#ffffff'] },
  };
}

/**
 * A deliberately branching chain: two roots, two mid-tier branches that cross,
 * and one apex that eats from both. This is the shape every real biome uses.
 */
const branching = [
  species('b.ant', 0, []),
  species('b.moth', 0, []),
  species('b.mouse', 1, ['b.ant'], { guardian: true, cost: 20 }),
  species('b.bird', 1, ['b.moth', 'b.ant'], { guardian: true, cost: 50 }),
  species('b.snake', 2, ['b.mouse', 'b.bird'], { guardian: true, cost: 120 }),
  species('b.cat', 2, ['b.bird'], { guardian: true, cost: 90 }),
  species('b.bear', 3, ['b.snake', 'b.cat'], { guardian: true, cost: 400 }),
];

describe('FoodChain', () => {
  const chain = new FoodChain(branching);

  it('rejects duplicate species', () => {
    expect(() => new FoodChain([...branching, species('b.ant', 0, [])])).toThrow(/duplicate/);
  });

  it('rejects dangling prey references', () => {
    expect(() => new FoodChain([species('x', 1, ['nope'])])).toThrow(/unknown species/);
  });

  it('answers who eats whom', () => {
    expect(chain.eats('b.snake', 'b.mouse')).toBe(true);
    expect(chain.eats('b.mouse', 'b.snake')).toBe(false);
    expect(chain.eats('b.cat', 'b.mouse')).toBe(false);
  });

  it('lists predators lowest tier first', () => {
    expect(chain.predatorsOf('b.bird').map((s) => s.id)).toEqual(['b.snake', 'b.cat']);
  });

  it('finds roots and apexes', () => {
    expect(chain.roots().map((s) => s.id).sort()).toEqual(['b.ant', 'b.moth']);
    expect(chain.apexes().map((s) => s.id)).toEqual(['b.bear']);
    expect(chain.maxTier).toBe(3);
  });

  describe('bestCounter — the thing auto-placement leans on', () => {
    it('picks the cheapest predator of the threat', () => {
      expect(chain.bestCounter('b.bird')?.id).toBe('b.cat');
    });

    it('respects a budget', () => {
      expect(chain.bestCounter('b.bird', { budget: 100 })?.id).toBe('b.cat');
      expect(chain.bestCounter('b.bird', { budget: 50 })).toBeNull();
    });

    it('respects what the player has unlocked', () => {
      const unlocked = new Set(['b.snake']);
      expect(chain.bestCounter('b.bird', { unlocked })?.id).toBe('b.snake');
    });

    it('returns null when nothing can answer', () => {
      expect(chain.bestCounter('b.bear')).toBeNull();
    });
  });

  it('finds the escalation path between two rungs', () => {
    expect(chain.pathUp('b.ant', 'b.bear')?.map((s) => s.id)).toEqual([
      'b.ant',
      'b.mouse',
      'b.snake',
      'b.bear',
    ]);
    expect(chain.pathUp('b.bear', 'b.ant')).toBeNull();
    expect(chain.pathUp('b.ant', 'b.ant')?.map((s) => s.id)).toEqual(['b.ant']);
  });

  it('groups by tier with no holes', () => {
    const tiers = chain.byTier();
    expect(tiers).toHaveLength(4);
    expect(tiers[0].map((s) => s.id).sort()).toEqual(['b.ant', 'b.moth']);
    expect(tiers[3].map((s) => s.id)).toEqual(['b.bear']);
  });

  it('is acyclic — every path up strictly increases tier', () => {
    for (const s of chain.all) {
      for (const prey of chain.preyOf(s.id)) {
        expect(prey.tier).toBeLessThan(s.tier);
      }
    }
  });
});
