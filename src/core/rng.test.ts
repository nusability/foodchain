import { describe, expect, it } from 'vitest';
import { Rng } from './rng';

describe('Rng', () => {
  it('is deterministic for a given seed', () => {
    const a = new Rng('meadow');
    const b = new Rng('meadow');
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different streams for different seeds', () => {
    const a = new Rng('meadow');
    const b = new Rng('jungle');
    expect(a.next()).not.toBe(b.next());
  });

  it('stays inside [0, 1)', () => {
    const rng = new Rng(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int() is inclusive at both ends', () => {
    const rng = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) seen.add(rng.int(1, 3));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('weighted() never picks a zero-weight entry', () => {
    const rng = new Rng(11);
    const items = [
      { id: 'a', w: 0 },
      { id: 'b', w: 1 },
    ];
    for (let i = 0; i < 200; i++) {
      expect(rng.weighted(items, (i2) => i2.w).id).toBe('b');
    }
  });

  it('weighted() roughly respects the weights', () => {
    const rng = new Rng(3);
    const items = [
      { id: 'a', w: 3 },
      { id: 'b', w: 1 },
    ];
    let a = 0;
    for (let i = 0; i < 4000; i++) if (rng.weighted(items, (i2) => i2.w).id === 'a') a++;
    expect(a / 4000).toBeGreaterThan(0.7);
    expect(a / 4000).toBeLessThan(0.8);
  });

  it('throws rather than silently picking from an empty set', () => {
    expect(() => new Rng(1).pick([])).toThrow();
    expect(() => new Rng(1).weighted([{ w: 0 }], (i) => i.w)).toThrow();
  });

  it('fork() derives a stable but distinct stream', () => {
    const base = () => new Rng('seed');
    expect(base().fork('waves').next()).toBe(base().fork('waves').next());
    expect(base().fork('waves').next()).not.toBe(base().fork('loot').next());
  });
});
