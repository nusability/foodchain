/**
 * The "no menus" brain.
 *
 * The player never selects an animal. They walk the king somewhere and the
 * game decides what belongs there: the cheapest thing that actually eats the
 * nastiest nearby threat. Feral guardians are weighted heaviest, because a
 * feral guardian is exactly the moment the player is supposed to reach for the
 * next rung of the chain.
 */
import type { SpeciesDef, SpeciesId } from '@/content/schema';
import { dist } from '@/core/math';
import type { Vec2 } from '@/core/math';
import type { Simulation } from './simulation';
import type { Unit } from './types';

export interface Threat {
  unit: Unit;
  /** Higher is more urgent. */
  score: number;
}

export interface AutoPickOptions {
  /** Threats beyond this radius from the placement point are ignored. */
  radius?: number;
  /** Extra weight given to feral turncoats. */
  feralWeight?: number;
  /** Extra weight given to bosses. */
  bossWeight?: number;
}

/** Ranks what the player should be worried about near a point. */
export function threatsNear(
  sim: Simulation,
  at: Vec2,
  opts: AutoPickOptions = {},
): Threat[] {
  const radius = opts.radius ?? 14;
  const feralWeight = opts.feralWeight ?? 3;
  const bossWeight = opts.bossWeight ?? 2.5;
  const out: Threat[] = [];

  for (const unit of sim.units.values()) {
    if (unit.faction !== 'critter') continue;
    const d = dist(at, unit.pos);
    if (d > radius) continue;
    // Proximity to the *house* matters more than proximity to the king.
    const toHouse = dist(unit.pos, sim.house.pos);
    let score = (1 + unit.species.tier) * (1 / (1 + d * 0.25)) * (1 / (1 + toHouse * 0.08));
    score *= unit.maxHp / 20 + 1;
    if (unit.feral) score *= feralWeight;
    if (unit.boss) score *= bossWeight;
    out.push({ unit, score });
  }

  return out.sort((a, b) => b.score - a.score);
}

export interface AutoPick {
  species: SpeciesDef;
  cost: number;
  /** What it was chosen to eat, if anything. Drives the "vs" toast. */
  answersThreat: SpeciesId | null;
}

/**
 * Choose what to plant. Returns null when nothing is affordable — the caller
 * shows a "keep collecting" nudge rather than planting something useless.
 */
export function autoPick(
  sim: Simulation,
  at: Vec2,
  opts: AutoPickOptions = {},
): AutoPick | null {
  const affordable = (s: SpeciesDef): boolean =>
    sim.canPlace(s.id, at).ok;

  const threats = threatsNear(sim, at, opts);

  // 1. Answer the scariest thing we can actually counter.
  for (const threat of threats) {
    const counters = sim.chain
      .predatorsOf(threat.unit.species.id)
      .filter((s) => s.roles.includes('guardian') && s.guardian && affordable(s))
      .sort((a, b) => sim.priceOf(a.id) - sim.priceOf(b.id) || a.tier - b.tier);
    if (counters.length > 0) {
      const species = counters[0];
      return { species, cost: sim.priceOf(species.id), answersThreat: threat.unit.species.id };
    }
  }

  // 2. Nothing on screen we can counter — plant the strongest thing that eats
  //    *something* in this biome's lower tiers, so it is useful in a moment.
  const onFieldSpecies = new Set([...sim.units.values()].map((u) => u.species.id));
  const generallyUseful = sim.chain
    .guardians()
    .filter((s) => affordable(s))
    .sort((a, b) => sim.priceOf(b.id) - sim.priceOf(a.id));

  const useful = generallyUseful.find((s) => s.eats.some((p) => onFieldSpecies.has(p)));
  if (useful) {
    const threat = useful.eats.find((p) => onFieldSpecies.has(p)) ?? null;
    return { species: useful, cost: sim.priceOf(useful.id), answersThreat: threat };
  }

  // 3. Fall back to the cheapest thing available — always give the player
  //    *something* for their tap.
  const cheapest = sim.chain
    .guardians()
    .filter((s) => affordable(s))
    .sort((a, b) => sim.priceOf(a.id) - sim.priceOf(b.id))[0];
  if (!cheapest) return null;
  return { species: cheapest, cost: sim.priceOf(cheapest.id), answersThreat: null };
}

/**
 * The escalation hint: given what is on the field, what is the next rung the
 * player will need? Feeds the chain ribbon in the HUD.
 */
export function nextRung(sim: Simulation): SpeciesDef | null {
  let worst: Unit | null = null;
  for (const unit of sim.units.values()) {
    if (unit.faction !== 'critter') continue;
    if (!worst || unit.species.tier > worst.species.tier) worst = unit;
  }
  if (!worst) return null;
  const counters = sim.chain
    .predatorsOf(worst.species.id)
    .filter((s) => s.roles.includes('guardian') && s.guardian);
  return counters.sort((a, b) => a.tier - b.tier)[0] ?? null;
}
