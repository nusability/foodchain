/**
 * Deterministic, seedable RNG.
 *
 * The whole simulation is driven from one of these so that a (seed, level)
 * pair always produces the same wave composition — which is what makes the
 * sim unit-testable and replays reproducible.
 */
export class Rng {
  private state: number;

  constructor(seed: number | string = 1) {
    this.state = typeof seed === 'string' ? Rng.hashString(seed) : seed >>> 0;
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  static hashString(s: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** mulberry32 — small, fast, good enough for gameplay. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1 - Number.EPSILON));
  }

  bool(chance = 0.5): boolean {
    return this.next() < chance;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: empty array');
    return items[this.int(0, items.length - 1)];
  }

  /** Weighted pick. Entries with weight <= 0 are ignored. */
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T {
    let total = 0;
    for (const item of items) {
      const w = weightOf(item);
      if (w > 0) total += w;
    }
    if (total <= 0) throw new Error('Rng.weighted: no positive weights');
    let roll = this.next() * total;
    for (const item of items) {
      const w = weightOf(item);
      if (w <= 0) continue;
      roll -= w;
      if (roll <= 0) return item;
    }
    return items[items.length - 1];
  }

  /** Fisher-Yates, in place. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  /** Point inside a disc of the given radius, uniformly distributed. */
  inDisc(radius: number): { x: number; y: number } {
    const a = this.next() * Math.PI * 2;
    const r = Math.sqrt(this.next()) * radius;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  }

  fork(tag: string): Rng {
    return new Rng((this.state ^ Rng.hashString(tag)) >>> 0);
  }
}
