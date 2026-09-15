/**
 * Authoring helpers for content packs.
 *
 * Biomes are TypeScript, not JSON, precisely so that a ten-wave level is
 * written as a few lines of intent instead of a thousand lines of literals.
 */
import type { LaneDef, SpeciesDef, SpeciesStats, WaveDef, WaveEntry } from './schema';
import type { Vec2 } from '@/core/math';

export const p = (x: number, z: number): Vec2 => ({ x, z });

/** A lane from a list of waypoints. */
export function lane(id: string, points: Vec2[], weight = 1): LaneDef {
  return { id, points, weight };
}

/** Straight line between two points, subdivided — handy as a lane spine. */
export function line(from: Vec2, to: Vec2, steps = 4): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    out.push({ x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t });
  }
  return out;
}

/** A gentle S-curve lane — reads better than a straight line on screen. */
export function curve(from: Vec2, to: Vec2, bulge = 4, steps = 8): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const sway = Math.sin(t * Math.PI * 2) * bulge;
    out.push({
      x: from.x + (to.x - from.x) * t + sway,
      z: from.z + (to.z - from.z) * t,
    });
  }
  return out;
}

export function entry(
  species: string,
  count: number,
  opts: Partial<Omit<WaveEntry, 'species' | 'count'>> = {},
): WaveEntry {
  return {
    species,
    count,
    spacing: opts.spacing ?? 0.5,
    delay: opts.delay ?? 0,
    lane: opts.lane ?? 'any',
    ...(opts.hpScale !== undefined ? { hpScale: opts.hpScale } : {}),
    ...(opts.speedScale !== undefined ? { speedScale: opts.speedScale } : {}),
    ...(opts.boss ? { boss: true } : {}),
  };
}

export function wave(
  entries: WaveEntry[],
  opts: { reward?: number; rest?: number; title?: string } = {},
): WaveDef {
  return {
    entries,
    reward: opts.reward ?? 40,
    restAfter: opts.rest ?? 6,
    ...(opts.title ? { title: opts.title } : {}),
  };
}

/**
 * Scales a wave's difficulty. Use it to reuse one wave shape across a level
 * while the numbers climb — which is most of what level design here is.
 */
export function harder(base: WaveDef, factor: number, extraCount = 0): WaveDef {
  return {
    ...base,
    entries: base.entries.map((e) => ({
      ...e,
      count: e.count + extraCount,
      hpScale: (e.hpScale ?? 1) * factor,
      spacing: Math.max(0.12, e.spacing * 0.92),
    })),
    reward: Math.round(base.reward * (1 + (factor - 1) * 0.7)),
  };
}

export const stats = (s: Partial<SpeciesStats> & Pick<SpeciesStats, 'hp' | 'speed' | 'damage'>): SpeciesStats => ({
  attackRate: 1,
  range: 0.5,
  radius: 0.45,
  bounty: Math.max(2, Math.round(s.hp / 4)),
  mass: 1,
  ...s,
});

/**
 * Standard guardian block, scaled by tier. Higher tiers cost more, eat more
 * often, and go feral faster — which is the escalation treadmill the whole
 * game runs on.
 */
export function guardianFor(tier: number, overrides: Partial<SpeciesDef['guardian']> = {}) {
  const base = {
    cost: Math.round(25 * Math.pow(2.05, tier)),
    costGrowth: 1.22,
    placeCooldown: 0.6 + tier * 0.25,
    // Tier 1 survives ~50 s unfed; tier 5 about 22 s.
    hungerRate: 0.02 + tier * 0.006,
    satietyPerMeal: Math.max(0.12, 0.42 - tier * 0.05),
    feralScale: 1.35 + tier * 0.12,
    warnTime: 5,
  };
  return { ...base, ...overrides };
}
