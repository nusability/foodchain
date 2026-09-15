/**
 * Semantic validation for content packs.
 *
 * TypeScript already guarantees the *shape* of a BiomeDef. What it cannot
 * check is whether the food chain actually makes sense: dangling `eats`
 * references, cycles, waves that spawn a species nobody can counter, lanes
 * that miss the house. That is what this does.
 *
 * `npm run validate:content` runs it over every registered biome, so a content
 * sub-agent can check its own work before handing it back.
 */
import type { BiomeDef, LevelDef, SpeciesDef } from './schema';
import { speciesById } from './schema';
import { dist, pathLength } from '@/core/math';

export type Severity = 'error' | 'warning';

export interface Issue {
  severity: Severity;
  path: string;
  message: string;
}

export interface ValidationResult {
  issues: Issue[];
  errors: Issue[];
  warnings: Issue[];
  ok: boolean;
}

class Collector {
  readonly issues: Issue[] = [];

  error(path: string, message: string): void {
    this.issues.push({ severity: 'error', path, message });
  }

  warn(path: string, message: string): void {
    this.issues.push({ severity: 'warning', path, message });
  }

  require(cond: boolean, path: string, message: string): boolean {
    if (!cond) this.error(path, message);
    return cond;
  }
}

function finish(c: Collector): ValidationResult {
  const errors = c.issues.filter((i) => i.severity === 'error');
  const warnings = c.issues.filter((i) => i.severity === 'warning');
  return { issues: c.issues, errors, warnings, ok: errors.length === 0 };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function validateBiome(biome: BiomeDef): ValidationResult {
  const c = new Collector();
  const at = biome.id || '<unnamed biome>';

  c.require(!!biome.id, at, 'biome.id is required');
  c.require(!!biome.name, at, 'biome.name is required');
  c.require(biome.species.length > 0, at, 'biome has no species');
  c.require(biome.levels.length > 0, at, 'biome has no levels');
  c.require(!!biome.music, at, 'biome.music must name a registered song');

  for (const [slot, value] of Object.entries(biome.palette ?? {})) {
    if (!HEX.test(String(value))) {
      c.error(`${at}.palette.${slot}`, `"${value}" is not a #rrggbb colour`);
    }
  }

  validateChain(biome, c);
  for (const level of biome.levels) validateLevel(biome, level, c);

  return finish(c);
}

function validateChain(biome: BiomeDef, c: Collector): void {
  const byId = speciesById(biome);
  const at = biome.id;

  if (byId.size !== biome.species.length) {
    c.error(`${at}.species`, 'duplicate species ids');
  }

  for (const s of biome.species) {
    const p = `${at}.species.${s.id}`;

    if (!s.id.startsWith(`${biome.id}.`)) {
      c.warn(p, `id should be namespaced as "${biome.id}.<name>"`);
    }
    if (s.roles.length === 0) c.error(p, 'species needs at least one role');
    if (s.roles.includes('guardian') && !s.guardian) {
      c.error(p, 'role "guardian" requires a guardian block');
    }
    if (s.guardian && !s.roles.includes('guardian')) {
      c.warn(p, 'has a guardian block but no "guardian" role — it can never be placed');
    }

    validateStats(s, p, c);

    for (const preyId of s.eats) {
      const prey = byId.get(preyId);
      if (!prey) {
        c.error(`${p}.eats`, `references unknown species "${preyId}"`);
        continue;
      }
      if (prey.tier >= s.tier) {
        c.error(
          `${p}.eats`,
          `"${preyId}" is tier ${prey.tier} but the eater is tier ${s.tier} — ` +
            'predators must sit strictly above their prey (this is what keeps the chain acyclic)',
        );
      }
      if (preyId === s.id) c.error(`${p}.eats`, 'a species cannot eat itself');
    }

    if (s.guardian) {
      const g = s.guardian;
      if (g.cost <= 0) c.error(`${p}.guardian.cost`, 'must be > 0');
      if (g.costGrowth < 1) c.warn(`${p}.guardian.costGrowth`, 'below 1 makes spam cheaper over time');
      if (g.hungerRate <= 0) c.error(`${p}.guardian.hungerRate`, 'must be > 0 — guardians must eventually go feral');
      if (g.feralScale < 1) c.warn(`${p}.guardian.feralScale`, 'feral form should be at least as strong as the tame one');
      if (g.satietyPerMeal <= 0) c.error(`${p}.guardian.satietyPerMeal`, 'must be > 0 or the guardian can never be fed');
    }

    if (!s.model?.kit) c.error(`${p}.model.kit`, 'model kit is required');
    for (const col of s.model?.palette ?? []) {
      if (!HEX.test(col)) c.error(`${p}.model.palette`, `"${col}" is not a #rrggbb colour`);
    }
  }

  const tiers = [...new Set(biome.species.map((s) => s.tier))].sort((a, b) => a - b);
  if (tiers[0] !== 0) {
    c.warn(`${at}.species`, `lowest tier is ${tiers[0]}; chains normally start at tier 0`);
  }
  for (let i = 1; i < tiers.length; i++) {
    if (tiers[i] !== tiers[i - 1] + 1) {
      c.warn(`${at}.species`, `tier ${tiers[i - 1] + 1} is empty — the chain has a gap`);
    }
  }

  // The core promise of the game: whatever you place, something can eat it.
  const apexTier = Math.max(...biome.species.map((s) => s.tier));
  for (const g of biome.species.filter((s) => s.roles.includes('guardian'))) {
    if (g.tier >= apexTier) continue;
    const counters = biome.species.filter((s) => s.eats.includes(g.id));
    if (counters.length === 0) {
      c.error(
        `${at}.species.${g.id}`,
        'nothing in this biome eats it, so once it goes feral the level is unwinnable',
      );
    }
  }

  const apexes = biome.species.filter((s) => s.tier === apexTier);
  for (const apex of apexes) {
    if (apex.roles.includes('guardian') && apex.guardian && apex.guardian.hungerRate > 0) {
      const counters = biome.species.filter((s) => s.eats.includes(apex.id));
      if (counters.length === 0) {
        c.warn(
          `${at}.species.${apex.id}`,
          'apex guardian with nothing above it — its feral form must be beatable by damage alone',
        );
      }
    }
  }
}

function validateStats(s: SpeciesDef, p: string, c: Collector): void {
  const st = s.stats;
  const positive: Array<keyof typeof st> = ['hp', 'speed', 'attackRate', 'radius', 'mass'];
  for (const key of positive) {
    if (!(st[key] > 0)) c.error(`${p}.stats.${key}`, `must be > 0 (got ${st[key]})`);
  }
  if (st.damage < 0) c.error(`${p}.stats.damage`, 'must be >= 0');
  if (st.range < 0) c.error(`${p}.stats.range`, 'must be >= 0');
  if (st.bounty < 0) c.error(`${p}.stats.bounty`, 'must be >= 0');
  if (st.bounty === 0 && s.roles.includes('critter')) {
    c.warn(`${p}.stats.bounty`, 'critters should drop coins — the game rains coins by design');
  }
  if (st.speed > 12) c.warn(`${p}.stats.speed`, 'faster than 12 u/s reads as a blur on a phone screen');
}

function validateLevel(biome: BiomeDef, level: LevelDef, c: Collector): void {
  const byId = speciesById(biome);
  const p = `${biome.id}.levels.${level.id}`;

  c.require(level.lanes.length > 0, p, 'level has no lanes');
  c.require(level.waves.length > 0, p, 'level has no waves');
  if (level.arena.width <= 0 || level.arena.depth <= 0) {
    c.error(`${p}.arena`, 'arena dimensions must be positive');
  }
  if (level.house.hp <= 0) c.error(`${p}.house.hp`, 'must be > 0');

  const laneIds = new Set<string>();
  for (const lane of level.lanes) {
    const lp = `${p}.lanes.${lane.id}`;
    if (laneIds.has(lane.id)) c.error(lp, 'duplicate lane id');
    laneIds.add(lane.id);
    if (lane.points.length < 2) {
      c.error(lp, 'a lane needs at least two points');
      continue;
    }
    if (lane.weight <= 0) c.warn(lp, 'weight <= 0 means this lane is never picked for "any"');
    if (pathLength(lane.points) < 5) c.warn(lp, 'lane is very short — players get no reaction time');

    const end = lane.points[lane.points.length - 1];
    const gap = dist(end, level.house.position);
    if (gap > 3) {
      c.error(lp, `lane ends ${gap.toFixed(1)}u from the house — critters would stall short of it`);
    }

    const halfW = level.arena.width / 2;
    const halfD = level.arena.depth / 2;
    for (const [i, pt] of lane.points.entries()) {
      if (Math.abs(pt.x) > halfW + 0.01 || Math.abs(pt.z) > halfD + 0.01) {
        c.warn(`${lp}.points[${i}]`, 'point lies outside the arena bounds');
      }
    }
  }

  const spawnedTiers = new Set<number>();
  for (const [wi, wave] of level.waves.entries()) {
    const wp = `${p}.waves[${wi}]`;
    if (wave.entries.length === 0) c.error(wp, 'wave has no entries');
    if (wave.reward < 0) c.error(`${wp}.reward`, 'must be >= 0');
    for (const [ei, entry] of wave.entries.entries()) {
      const ep = `${wp}.entries[${ei}]`;
      const sp = byId.get(entry.species);
      if (!sp) {
        c.error(ep, `unknown species "${entry.species}"`);
        continue;
      }
      if (!sp.roles.includes('critter')) {
        c.error(ep, `"${entry.species}" is not a critter and cannot be spawned in a wave`);
      }
      spawnedTiers.add(sp.tier);
      if (entry.count <= 0) c.error(`${ep}.count`, 'must be > 0');
      if (entry.spacing < 0) c.error(`${ep}.spacing`, 'must be >= 0');
      if (entry.delay < 0) c.error(`${ep}.delay`, 'must be >= 0');
      if (entry.lane !== 'any' && !laneIds.has(entry.lane)) {
        c.error(`${ep}.lane`, `unknown lane "${entry.lane}"`);
      }
    }
  }

  // Every spawned critter needs at least one placeable answer in this biome.
  const guardians = biome.species.filter((s) => s.roles.includes('guardian'));
  for (const wave of level.waves) {
    for (const entry of wave.entries) {
      const sp = byId.get(entry.species);
      if (!sp) continue;
      const answer = guardians.some((g) => g.eats.includes(sp.id));
      if (!answer) {
        c.warn(
          `${p}`,
          `"${sp.id}" spawns here but no guardian in this biome eats it — players can only out-damage it`,
        );
      }
    }
  }

  if (level.startingCoins < 0) c.error(`${p}.startingCoins`, 'must be >= 0');
  const cheapest = Math.min(
    ...guardians.map((g) => g.guardian?.cost ?? Number.POSITIVE_INFINITY),
  );
  if (Number.isFinite(cheapest) && level.startingCoins < cheapest) {
    c.error(
      `${p}.startingCoins`,
      `${level.startingCoins} coins cannot afford the cheapest guardian (${cheapest})`,
    );
  }

  const goals = level.starGoals;
  if (goals.houseHp < 0 || goals.houseHp > 1) {
    c.error(`${p}.starGoals.houseHp`, 'must be a fraction between 0 and 1');
  }
  if (goals.coins < 0) c.error(`${p}.starGoals.coins`, 'must be >= 0');
}

export function validateBiomes(biomes: readonly BiomeDef[]): ValidationResult {
  const c = new Collector();
  const seen = new Set<string>();
  const orders = new Map<number, string>();

  for (const biome of biomes) {
    if (seen.has(biome.id)) c.error(biome.id, 'duplicate biome id');
    seen.add(biome.id);
    const clash = orders.get(biome.order);
    if (clash) c.warn(biome.id, `shares world-map order ${biome.order} with "${clash}"`);
    orders.set(biome.order, biome.id);
    c.issues.push(...validateBiome(biome).issues);
  }

  return finish(c);
}

export function formatIssues(result: ValidationResult): string {
  if (result.issues.length === 0) return 'content ok — no issues';
  return result.issues
    .map((i) => `${i.severity === 'error' ? 'ERROR' : 'warn '}  ${i.path}: ${i.message}`)
    .join('\n');
}
