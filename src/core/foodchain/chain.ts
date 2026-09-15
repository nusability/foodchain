/**
 * The food chain, as a queryable graph.
 *
 * Edges run predator -> prey. Because the validator forces tier(predator) >
 * tier(prey), the graph is a DAG — but it is *not* a straight line: a biome
 * can branch (two tier-2 predators eating different tier-1 prey) and merge
 * again at an apex. The auto-play helpers below are what let the game pick
 * sensible guardians for the player without ever opening a menu.
 */
import type { BiomeDef, SpeciesDef, SpeciesId } from '@/content/schema';

export class FoodChain {
  private readonly byId = new Map<SpeciesId, SpeciesDef>();
  /** prey id -> species that eat it. */
  private readonly predators = new Map<SpeciesId, SpeciesDef[]>();

  constructor(species: readonly SpeciesDef[]) {
    for (const s of species) {
      if (this.byId.has(s.id)) throw new Error(`FoodChain: duplicate species "${s.id}"`);
      this.byId.set(s.id, s);
    }
    for (const s of species) {
      for (const preyId of s.eats) {
        if (!this.byId.has(preyId)) {
          throw new Error(`FoodChain: "${s.id}" eats unknown species "${preyId}"`);
        }
        const list = this.predators.get(preyId);
        if (list) list.push(s);
        else this.predators.set(preyId, [s]);
      }
    }
  }

  static fromBiome(biome: BiomeDef): FoodChain {
    return new FoodChain(biome.species);
  }

  get all(): SpeciesDef[] {
    return [...this.byId.values()];
  }

  get maxTier(): number {
    let max = 0;
    for (const s of this.byId.values()) max = Math.max(max, s.tier);
    return max;
  }

  get(id: SpeciesId): SpeciesDef {
    const s = this.byId.get(id);
    if (!s) throw new Error(`FoodChain: unknown species "${id}"`);
    return s;
  }

  has(id: SpeciesId): boolean {
    return this.byId.has(id);
  }

  /** Can `predator` damage `prey` at all? Non-prey take reduced damage, never zero. */
  eats(predatorId: SpeciesId, preyId: SpeciesId): boolean {
    return this.byId.get(predatorId)?.eats.includes(preyId) ?? false;
  }

  /** Everything that can eat `id`, cheapest tier first. */
  predatorsOf(id: SpeciesId): SpeciesDef[] {
    return [...(this.predators.get(id) ?? [])].sort((a, b) => a.tier - b.tier);
  }

  preyOf(id: SpeciesId): SpeciesDef[] {
    return this.get(id).eats.map((p) => this.get(p));
  }

  tierOf(id: SpeciesId): number {
    return this.get(id).tier;
  }

  guardians(): SpeciesDef[] {
    return this.all
      .filter((s) => s.roles.includes('guardian') && s.guardian)
      .sort((a, b) => a.tier - b.tier || (a.guardian!.cost - b.guardian!.cost));
  }

  /** Nothing eats these — the top of the chain. */
  apexes(): SpeciesDef[] {
    return this.all.filter((s) => this.predatorsOf(s.id).length === 0);
  }

  /** Nothing eats *anything* — the bottom of the chain. */
  roots(): SpeciesDef[] {
    return this.all.filter((s) => s.eats.length === 0);
  }

  /**
   * Cheapest placeable answer to a threat. This powers auto-placement: the
   * king walks somewhere and the game plants the right thing for the player.
   *
   * `affordable` filters by budget; when nothing is affordable we return null
   * so the caller can show a "save up" nudge rather than placing junk.
   */
  bestCounter(
    threatId: SpeciesId,
    opts: { budget?: number; unlocked?: ReadonlySet<SpeciesId> } = {},
  ): SpeciesDef | null {
    const { budget = Number.POSITIVE_INFINITY, unlocked } = opts;
    const candidates = this.predatorsOf(threatId).filter(
      (s) =>
        s.roles.includes('guardian') &&
        s.guardian &&
        s.guardian.cost <= budget &&
        (!unlocked || unlocked.has(s.id)),
    );
    if (candidates.length === 0) return null;
    // Cheapest first, then lowest tier — placing the smallest thing that does
    // the job keeps the escalation ladder intact.
    return candidates.sort(
      (a, b) => a.guardian!.cost - b.guardian!.cost || a.tier - b.tier,
    )[0];
  }

  /**
   * Shortest predator chain from `fromId` up to something that eats `toId`.
   * Used by the tutorial hints and by level validation tooling.
   */
  pathUp(fromId: SpeciesId, toId: SpeciesId): SpeciesDef[] | null {
    if (fromId === toId) return [this.get(fromId)];
    const queue: SpeciesId[][] = [[fromId]];
    const seen = new Set<SpeciesId>([fromId]);
    while (queue.length) {
      const path = queue.shift()!;
      const tail = path[path.length - 1];
      for (const pred of this.predatorsOf(tail)) {
        if (seen.has(pred.id)) continue;
        seen.add(pred.id);
        const next = [...path, pred.id];
        if (pred.id === toId) return next.map((id) => this.get(id));
        queue.push(next);
      }
    }
    return null;
  }

  /** Species grouped by tier, ascending. Handy for the chain HUD ribbon. */
  byTier(): SpeciesDef[][] {
    const out: SpeciesDef[][] = [];
    for (const s of this.all) {
      (out[s.tier] ??= []).push(s);
    }
    for (let i = 0; i < out.length; i++) out[i] ??= [];
    return out;
  }
}
