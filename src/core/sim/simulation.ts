/**
 * The battle simulation.
 *
 * Pure logic: no three.js, no DOM, no timers. Step it with a fixed dt and
 * drain the event queue — the renderer and the audio engine are both just
 * consumers of that queue. That separation is what makes the interesting
 * parts (hunger, feral turncoats, wave pacing, economy) unit-testable.
 */
import type { BiomeDef, LevelDef, SpeciesDef, SpeciesId } from '@/content/schema';
import { FoodChain } from '@/core/foodchain/chain';
import {
  clamp,
  clamp01,
  dist,
  dist2,
  pathLength,
  pointAtDistance,
  towards,
  v2,
  type Vec2,
} from '@/core/math';
import { Rng } from '@/core/rng';
import { SpatialHash } from './spatial';
import { WaveDirector } from './spawner';
import {
  DEFAULT_SIM_CONFIG,
  type LevelOutcome,
  type PlacementResult,
  type SimConfig,
  type SimEvent,
  type SimStatus,
  type Unit,
  type UnitId,
} from './types';

export interface SimulationOptions {
  biome: BiomeDef;
  level: LevelDef;
  seed?: number | string;
  config?: Partial<SimConfig>;
  /** Species the player has unlocked. Defaults to every guardian in the biome. */
  unlocked?: ReadonlySet<SpeciesId>;
  /** Flat stat bonuses from meta progression / IAP-free upgrades. */
  bonuses?: { guardianDamage?: number; guardianHp?: number; coinRate?: number; houseHp?: number };
}

interface LaneCache {
  id: string;
  points: Vec2[];
  length: number;
  weight: number;
}

export class Simulation {
  readonly biome: BiomeDef;
  readonly level: LevelDef;
  readonly chain: FoodChain;
  readonly config: SimConfig;
  readonly rng: Rng;
  readonly director: WaveDirector;
  readonly unlocked: ReadonlySet<SpeciesId>;

  readonly units = new Map<UnitId, Unit>();
  readonly house: { pos: Vec2; hp: number; maxHp: number };

  coins = 0;
  coinsCollected = 0;
  feralCount = 0;
  elapsed = 0;
  status: SimStatus = 'running';

  private nextId = 1;
  private events: SimEvent[] = [];
  private readonly lanes = new Map<string, LaneCache>();
  private readonly grid: SpatialHash<Unit>;
  private readonly cooldowns = new Map<SpeciesId, number>();
  private readonly placedCounts = new Map<SpeciesId, number>();
  private readonly bonuses: Required<NonNullable<SimulationOptions['bonuses']>>;
  private trickleCarry = 0;
  private queryBuffer: Unit[] = [];

  constructor(opts: SimulationOptions) {
    this.biome = opts.biome;
    this.level = opts.level;
    this.chain = FoodChain.fromBiome(opts.biome);
    this.config = { ...DEFAULT_SIM_CONFIG, ...opts.config };
    this.rng = new Rng(opts.seed ?? `${opts.biome.id}/${opts.level.id}`);
    this.director = new WaveDirector(opts.level, this.rng.fork('waves'));
    this.bonuses = {
      guardianDamage: opts.bonuses?.guardianDamage ?? 1,
      guardianHp: opts.bonuses?.guardianHp ?? 1,
      coinRate: opts.bonuses?.coinRate ?? 1,
      houseHp: opts.bonuses?.houseHp ?? 1,
    };
    this.unlocked =
      opts.unlocked ?? new Set(this.chain.guardians().map((g) => g.id));

    for (const lane of opts.level.lanes) {
      this.lanes.set(lane.id, {
        id: lane.id,
        points: lane.points,
        length: pathLength(lane.points),
        weight: lane.weight,
      });
    }

    this.house = {
      pos: { ...opts.level.house.position },
      hp: opts.level.house.hp * this.bonuses.houseHp,
      maxHp: opts.level.house.hp * this.bonuses.houseHp,
    };
    this.coins = opts.level.startingCoins;

    const maxRange = Math.max(
      2,
      ...opts.biome.species.map((s) => s.stats.range + s.stats.radius * 2),
    );
    this.grid = new SpatialHash<Unit>(maxRange, (u) => u.pos);
  }

  // ---------------------------------------------------------------- events

  drainEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  private emit(event: SimEvent): void {
    this.events.push(event);
  }

  // ------------------------------------------------------------ lifecycle

  start(): void {
    this.director.begin();
    this.emit({ type: 'waveStart', index: 0, title: this.level.waves[0]?.title });
  }

  get aliveUnits(): Unit[] {
    return [...this.units.values()];
  }

  get hostiles(): Unit[] {
    return this.aliveUnits.filter((u) => u.faction === 'critter');
  }

  get guardians(): Unit[] {
    return this.aliveUnits.filter((u) => u.faction === 'guardian');
  }

  // ------------------------------------------------------------ placement

  /** Current price of the next copy of a guardian, after the growth curve. */
  priceOf(speciesId: SpeciesId): number {
    const species = this.chain.has(speciesId) ? this.chain.get(speciesId) : null;
    if (!species?.guardian) return Number.POSITIVE_INFINITY;
    const owned = this.placedCounts.get(speciesId) ?? 0;
    return Math.round(species.guardian.cost * Math.pow(species.guardian.costGrowth, owned));
  }

  cooldownOf(speciesId: SpeciesId): number {
    return Math.max(0, this.cooldowns.get(speciesId) ?? 0);
  }

  canPlace(speciesId: SpeciesId, pos: Vec2): PlacementResult {
    if (!this.chain.has(speciesId)) return { ok: false, reason: 'unknown-species' };
    const species = this.chain.get(speciesId);
    if (!species.guardian || !species.roles.includes('guardian') || !this.unlocked.has(speciesId)) {
      return { ok: false, reason: 'not-placeable' };
    }
    const cost = this.priceOf(speciesId);
    if (cost > this.coins) return { ok: false, reason: 'unaffordable', cost };
    if (this.cooldownOf(speciesId) > 0) return { ok: false, reason: 'cooldown', cost };

    const halfW = this.level.arena.width / 2;
    const halfD = this.level.arena.depth / 2;
    if (Math.abs(pos.x) > halfW || Math.abs(pos.z) > halfD) {
      return { ok: false, reason: 'out-of-bounds', cost };
    }
    if (dist(pos, this.house.pos) < 1.4) return { ok: false, reason: 'occupied', cost };

    for (const other of this.units.values()) {
      if (other.faction !== 'guardian') continue;
      const min = species.stats.radius + other.species.stats.radius + this.config.placementGap;
      if (dist2(pos, other.pos) < min * min) return { ok: false, reason: 'occupied', cost };
    }
    return { ok: true, cost };
  }

  /** Plant a guardian. Returns the created unit, or why it could not be planted. */
  place(speciesId: SpeciesId, pos: Vec2): PlacementResult {
    const check = this.canPlace(speciesId, pos);
    if (!check.ok) return check;

    const species = this.chain.get(speciesId);
    const cost = check.cost!;
    this.coins -= cost;
    this.placedCounts.set(speciesId, (this.placedCounts.get(speciesId) ?? 0) + 1);
    this.cooldowns.set(speciesId, species.guardian!.placeCooldown);

    const unit = this.makeUnit(species, { ...pos }, 'guardian');
    unit.anchor = { ...pos };
    unit.state = 'planted';
    unit.hp = unit.maxHp = species.stats.hp * this.bonuses.guardianHp;
    unit.damageMul = this.bonuses.guardianDamage;
    unit.facing = Math.atan2(this.house.pos.x - pos.x, this.house.pos.z - pos.z) + Math.PI;
    unit.squish = 1;
    this.units.set(unit.id, unit);
    this.emit({ type: 'placed', unit, cost });
    return { ok: true, unit, cost };
  }

  private makeUnit(species: SpeciesDef, pos: Vec2, faction: 'critter' | 'guardian'): Unit {
    return {
      id: this.nextId++,
      species,
      faction,
      hp: species.stats.hp,
      maxHp: species.stats.hp,
      pos,
      facing: 0,
      state: faction === 'guardian' ? 'planted' : 'walking',
      laneId: null,
      laneDistance: 0,
      laneOffset: 0,
      anchor: null,
      satiety: 1,
      feral: false,
      warned: false,
      target: null,
      cooldown: 0,
      boss: false,
      kills: 0,
      age: 0,
      damageMul: 1,
      speedMul: 1,
      scale: species.model.scale ?? 1,
      squish: 0,
      waveIndex: -1,
    };
  }

  // ----------------------------------------------------------------- step

  step(dt: number): void {
    if (this.status !== 'running') return;
    this.elapsed += dt;

    for (const [id, t] of this.cooldowns) {
      if (t > 0) this.cooldowns.set(id, Math.max(0, t - dt));
    }

    this.runDirector(dt);
    this.grid.rebuild(this.units.values());

    for (const unit of this.units.values()) {
      // Something may already have killed this unit earlier in the same step.
      // Skipping it matters: stepCritter/stepGuardian both assign `state`, so
      // running one would overwrite 'dead' and the corpse would fight on with
      // negative hit points until something else happened to kill it again.
      if (unit.state === 'dead') continue;
      unit.age += dt;
      unit.cooldown = Math.max(0, unit.cooldown - dt);
      if (unit.faction === 'guardian') this.stepGuardian(unit, dt);
      else this.stepCritter(unit, dt);
    }

    this.separate(dt);
    this.payTrickle(dt);
    this.reap();
    this.checkEnd();
  }

  private runDirector(dt: number): void {
    const beforeIndex = this.director.waveIndex;
    const beforePhase = this.director.phase;
    const requests = this.director.step(dt);
    for (const req of requests) this.spawnFromRequest(req);

    // The moment the last critter of a wave dies, pay out. Doing it here
    // rather than in the renderer keeps the payout in the tested layer.
    const clearedNow =
      beforePhase === 'clearing' &&
      (this.director.phase === 'resting' || this.director.phase === 'done');
    if (clearedNow) this.claimWaveReward(beforeIndex);

    if (this.director.waveIndex !== beforeIndex && this.director.waveIndex >= 0) {
      const wave = this.level.waves[this.director.waveIndex];
      this.emit({
        type: 'waveStart',
        index: this.director.waveIndex,
        title: wave?.title,
      });
    }
  }

  private spawnFromRequest(req: { species: string; laneId: string; hpScale: number; speedScale: number; boss: boolean; waveIndex: number }): void {
    if (!this.chain.has(req.species)) return;
    const species = this.chain.get(req.species);
    const lane = this.lanes.get(req.laneId) ?? [...this.lanes.values()][0];
    if (!lane) return;

    const unit = this.makeUnit(species, { ...lane.points[0] }, 'critter');
    unit.laneId = lane.id;
    unit.laneDistance = 0;
    unit.laneOffset = this.rng.float(-0.9, 0.9) * (1 + species.stats.radius);
    unit.waveIndex = req.waveIndex;
    unit.speedMul = req.speedScale * this.rng.float(0.92, 1.08);
    unit.boss = req.boss;

    const hpScale = req.hpScale * (req.boss ? this.config.bossHp : 1);
    unit.hp = unit.maxHp = species.stats.hp * hpScale;
    if (req.boss) unit.scale *= this.config.bossScale;

    this.placeOnLane(unit, lane);
    this.units.set(unit.id, unit);
    this.emit({ type: 'spawn', unit });
  }

  private placeOnLane(unit: Unit, lane: LaneCache): void {
    const here = pointAtDistance(lane.points, unit.laneDistance);
    const ahead = pointAtDistance(lane.points, Math.min(lane.length, unit.laneDistance + 0.5));
    const dir = towards(here, ahead);
    unit.pos.x = here.x - dir.z * unit.laneOffset;
    unit.pos.z = here.z + dir.x * unit.laneOffset;
    if (dir.x !== 0 || dir.z !== 0) unit.facing = Math.atan2(dir.x, dir.z);
  }

  // ------------------------------------------------------------ behaviour

  private stepGuardian(unit: Unit, dt: number): void {
    const g = unit.species.guardian!;

    // Hunger. The whole game hangs off this line: everything you place is on
    // a timer, and feeding it is the only way to hold that timer back.
    if (this.elapsed > this.config.hungerGrace) {
      unit.satiety = clamp01(unit.satiety - g.hungerRate * dt);
    }
    const warnAt = g.hungerRate * g.warnTime;
    if (!unit.warned && unit.satiety <= warnAt) {
      unit.warned = true;
      this.emit({ type: 'feralWarning', unit });
    }
    if (unit.satiety <= 0) {
      this.turnFeral(unit);
      return;
    }

    const target = this.acquireTarget(unit);
    unit.target = target?.id ?? null;
    if (!target) {
      // Drift home and face the incoming lane.
      if (unit.anchor) this.moveTowards(unit, unit.anchor, unit.species.stats.speed * 0.6, dt);
      unit.state = 'planted';
      return;
    }

    const reach = unit.species.stats.range + unit.species.stats.radius + target.species.stats.radius;
    if (dist2(unit.pos, target.pos) > reach * reach) {
      // Lunge, but never further than the leash from where we were planted.
      const before = { ...unit.pos };
      this.moveTowards(unit, target.pos, unit.species.stats.speed, dt);
      if (unit.anchor && dist(unit.pos, unit.anchor) > this.config.leash) {
        unit.pos = before;
      }
      unit.state = 'walking';
    } else {
      unit.state = 'attacking';
      this.faceTowards(unit, target.pos);
      this.tryAttack(unit, target);
    }
  }

  private stepCritter(unit: Unit, dt: number): void {
    const target = this.acquireTarget(unit);
    unit.target = target?.id ?? null;

    if (target) {
      const reach =
        unit.species.stats.range + unit.species.stats.radius + target.species.stats.radius;
      if (dist2(unit.pos, target.pos) <= reach * reach) {
        unit.state = 'attacking';
        this.faceTowards(unit, target.pos);
        this.tryAttack(unit, target);
        return;
      }
      if (unit.feral) {
        // Feral things chase whatever is closest — they are not on a lane.
        this.moveTowards(unit, target.pos, this.speedOf(unit), dt);
        unit.state = 'walking';
        return;
      }
    }

    // Reached the house? Chew on it.
    const houseReach = unit.species.stats.range + unit.species.stats.radius + 1.2;
    if (dist2(unit.pos, this.house.pos) <= houseReach * houseReach) {
      unit.state = 'attacking';
      this.faceTowards(unit, this.house.pos);
      this.tryBiteHouse(unit);
      return;
    }

    unit.state = 'walking';
    if (unit.feral || !unit.laneId) {
      this.moveTowards(unit, this.house.pos, this.speedOf(unit), dt);
      return;
    }
    const lane = this.lanes.get(unit.laneId);
    if (!lane) {
      this.moveTowards(unit, this.house.pos, this.speedOf(unit), dt);
      return;
    }
    unit.laneDistance = Math.min(lane.length, unit.laneDistance + this.speedOf(unit) * dt);
    this.placeOnLane(unit, lane);
  }

  private speedOf(unit: Unit): number {
    return unit.species.stats.speed * unit.speedMul;
  }

  private moveTowards(unit: Unit, goal: Vec2, speed: number, dt: number): void {
    const d = dist(unit.pos, goal);
    if (d < 1e-4) return;
    const step = Math.min(d, speed * dt);
    const dir = towards(unit.pos, goal);
    unit.pos.x += dir.x * step;
    unit.pos.z += dir.z * step;
    unit.facing = Math.atan2(dir.x, dir.z);
  }

  private faceTowards(unit: Unit, goal: Vec2): void {
    const dir = towards(unit.pos, goal);
    if (dir.x !== 0 || dir.z !== 0) unit.facing = Math.atan2(dir.x, dir.z);
  }

  /** Nearest hostile within the unit's awareness radius, preferring real prey. */
  private acquireTarget(unit: Unit): Unit | null {
    const awareness =
      unit.species.stats.range + unit.species.stats.radius + (unit.faction === 'guardian' ? this.config.leash : 0.8);
    const near = this.grid.queryNear(unit.pos, awareness + 2, this.queryBuffer);
    let best: Unit | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const other of near) {
      if (other.id === unit.id || other.hp <= 0 || other.state === 'dead') continue;
      if (!this.isHostileTo(unit, other)) continue;
      const d2 = dist2(unit.pos, other.pos);
      const reach = awareness + other.species.stats.radius + 2;
      if (d2 > reach * reach) continue;
      // Prey you can actually eat is always more attractive than a chew toy.
      const onDiet = this.chain.eats(unit.species.id, other.species.id);
      const score = d2 * (onDiet ? 1 : 4);
      if (score < bestScore) {
        bestScore = score;
        best = other;
      }
    }
    return best;
  }

  private isHostileTo(a: Unit, b: Unit): boolean {
    return a.faction !== b.faction;
  }

  private tryAttack(attacker: Unit, target: Unit): void {
    if (attacker.cooldown > 0) return;
    attacker.cooldown = 1 / attacker.species.stats.attackRate;

    const onDiet = this.chain.eats(attacker.species.id, target.species.id);
    const damage =
      attacker.species.stats.damage *
      attacker.damageMul *
      (onDiet ? 1 : this.config.offDietDamage);

    target.hp -= damage;
    target.squish = Math.min(1, target.squish + 0.6);
    attacker.squish = Math.min(1, attacker.squish + 0.35);
    this.emit({
      type: 'attack',
      attacker: attacker.id,
      target: target.id,
      damage,
      pos: { ...target.pos },
      onDiet,
    });

    if (target.hp <= 0) this.kill(target, attacker);
  }

  private tryBiteHouse(unit: Unit): void {
    if (unit.cooldown > 0) return;
    unit.cooldown = 1 / unit.species.stats.attackRate;
    const damage = unit.species.stats.damage * unit.damageMul;
    this.house.hp = Math.max(0, this.house.hp - damage);
    unit.squish = Math.min(1, unit.squish + 0.5);
    this.emit({ type: 'houseHit', damage, hpLeft: this.house.hp, attacker: unit.id });
  }

  private kill(victim: Unit, killer: Unit | null): void {
    if (victim.state === 'dead') return;
    victim.state = 'dead';
    victim.hp = 0;

    const bounty = Math.round(
      victim.species.stats.bounty * (victim.boss ? this.config.bossBounty : 1),
    );
    this.emit({ type: 'death', unit: victim, killer: killer?.id ?? null, bounty });

    if (bounty > 0) {
      this.award(bounty, victim.pos, 'bounty');
    }

    if (killer && killer.faction === 'guardian' && killer.species.guardian) {
      killer.kills++;
      const before = killer.satiety;
      killer.satiety = clamp01(killer.satiety + killer.species.guardian.satietyPerMeal);
      killer.squish = 1;
      if (killer.satiety > before) {
        killer.warned = killer.satiety <= killer.species.guardian.hungerRate * killer.species.guardian.warnTime;
        this.emit({ type: 'fed', unit: killer });
      }
    }
  }

  /**
   * A guardian's timer ran out. It keeps its species (so the chain still
   * applies — something above it can still eat it) but switches sides and
   * comes for the house, harder than it was.
   */
  private turnFeral(unit: Unit): void {
    const g = unit.species.guardian!;
    unit.faction = 'critter';
    unit.feral = true;
    unit.anchor = null;
    unit.laneId = null;
    unit.satiety = 0;
    unit.state = 'walking';
    unit.damageMul *= g.feralScale;
    unit.speedMul *= 1 + (g.feralScale - 1) * 0.4;
    unit.maxHp *= g.feralScale;
    unit.hp = Math.min(unit.maxHp, unit.hp * g.feralScale);
    unit.scale *= 1.15;
    unit.squish = 1;
    this.feralCount++;
    // Feral units are no longer this wave's problem, and they pay out big.
    this.emit({ type: 'feral', unit });
  }

  /** Push overlapping bodies apart so a swarm stays readable. */
  private separate(dt: number): void {
    const buf: Unit[] = [];
    for (const unit of this.units.values()) {
      if (unit.state === 'dead') continue;
      const r = unit.species.stats.radius * unit.scale;
      this.grid.queryNear(unit.pos, r * 2 + 1, buf);
      for (const other of buf) {
        if (other.id <= unit.id || other.state === 'dead') continue;
        const or = other.species.stats.radius * other.scale;
        const min = r + or;
        const d2 = dist2(unit.pos, other.pos);
        if (d2 >= min * min || d2 < 1e-8) continue;
        const d = Math.sqrt(d2);
        const push = ((min - d) / min) * this.config.separation * dt;
        const nx = (unit.pos.x - other.pos.x) / d;
        const nz = (unit.pos.z - other.pos.z) / d;
        const wa = other.species.stats.mass / (unit.species.stats.mass + other.species.stats.mass);
        const wb = 1 - wa;
        unit.pos.x += nx * push * wa;
        unit.pos.z += nz * push * wa;
        other.pos.x -= nx * push * wb;
        other.pos.z -= nz * push * wb;
      }
    }
  }

  private payTrickle(dt: number): void {
    this.trickleCarry += this.config.coinTrickle * this.bonuses.coinRate * dt;
    if (this.trickleCarry >= 1) {
      const amount = Math.floor(this.trickleCarry);
      this.trickleCarry -= amount;
      this.award(amount, this.house.pos, 'trickle');
    }
  }

  award(amount: number, pos: Vec2, reason: 'bounty' | 'wave' | 'totem' | 'trickle'): void {
    if (amount <= 0) return;
    this.coins += amount;
    this.coinsCollected += amount;
    this.emit({ type: 'coins', amount, pos: { ...pos }, reason });
  }

  private reap(): void {
    for (const [id, unit] of this.units) {
      if (unit.state !== 'dead') continue;
      this.units.delete(id);
      if (unit.faction === 'critter' && unit.waveIndex >= 0 && !unit.feral) {
        this.director.notifyRemoved();
      }
    }
  }

  private checkEnd(): void {
    if (this.house.hp <= 0) {
      this.status = 'lost';
      this.emit({ type: 'levelEnd', status: 'lost', stars: 0 });
      return;
    }
    const noHostiles = this.hostiles.length === 0;
    if (this.director.isDone && noHostiles) {
      this.status = 'won';
      this.emit({ type: 'levelEnd', status: 'won', stars: this.stars() });
    }
  }

  stars(): number {
    if (this.status === 'lost') return 0;
    const goals = this.level.starGoals;
    let stars = 1; // clearing the level at all is always worth one.
    if (this.coinsCollected >= goals.coins) stars++;
    if (this.house.hp / this.house.maxHp >= goals.houseHp) stars++;
    if (goals.noFeral && this.feralCount === 0) stars++;
    return stars;
  }

  outcome(): LevelOutcome {
    return {
      status: this.status,
      stars: this.stars(),
      coinsCollected: this.coinsCollected,
      houseHpFraction: clamp01(this.house.hp / this.house.maxHp),
      feralCount: this.feralCount,
      elapsed: this.elapsed,
    };
  }

  /** Wave rewards are handed out by the host when the director clears a wave. */
  claimWaveReward(index: number): void {
    const reward = this.director.rewardForWave(index);
    if (reward > 0) {
      this.award(reward, this.house.pos, 'wave');
      this.emit({ type: 'waveCleared', index, reward });
    }
  }

  /** Nearest hostile to a point — used by auto-placement and camera framing. */
  nearestHostile(point: Vec2, maxRadius = Number.POSITIVE_INFINITY): Unit | null {
    let best: Unit | null = null;
    let bestD = maxRadius * maxRadius;
    for (const unit of this.units.values()) {
      if (unit.faction !== 'critter') continue;
      const d2 = dist2(point, unit.pos);
      if (d2 < bestD) {
        bestD = d2;
        best = unit;
      }
    }
    return best;
  }

  /** Clamp a point into the playable arena. */
  clampToArena(p: Vec2): Vec2 {
    const halfW = this.level.arena.width / 2;
    const halfD = this.level.arena.depth / 2;
    return v2(clamp(p.x, -halfW, halfW), clamp(p.z, -halfD, halfD));
  }
}
