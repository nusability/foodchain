import type { SpeciesDef } from '@/content/schema';
import type { Vec2 } from '@/core/math';

export type UnitId = number;

export type UnitState = 'walking' | 'attacking' | 'planted' | 'dead';

export interface Unit {
  id: UnitId;
  species: SpeciesDef;
  /** Guardians defend; critters march. A feral guardian becomes a critter. */
  faction: 'critter' | 'guardian';
  hp: number;
  maxHp: number;
  pos: Vec2;
  /** Radians, +Z forward. Render lerps towards this. */
  facing: number;
  state: UnitState;

  // --- lane walking (critters) ---
  laneId: string | null;
  laneDistance: number;
  /** Lateral offset from the lane centreline so crowds read as a swarm. */
  laneOffset: number;

  // --- planted guardians ---
  anchor: Vec2 | null;
  /** 1 -> stuffed, 0 -> feral. */
  satiety: number;
  feral: boolean;
  /** True once the pre-feral wobble has been announced. */
  warned: boolean;

  target: UnitId | null;
  cooldown: number;
  boss: boolean;
  kills: number;
  age: number;
  /** Multipliers folded in at spawn time (wave scaling, feral scaling, upgrades). */
  damageMul: number;
  speedMul: number;
  /** Visual size multiplier. */
  scale: number;
  /** Set by the sim, consumed and decayed by the renderer for squish pops. */
  squish: number;
  /** Which wave produced this unit, for director bookkeeping. -1 for guardians. */
  waveIndex: number;
}

export type SimStatus = 'running' | 'won' | 'lost';

export type SimEvent =
  | { type: 'spawn'; unit: Unit }
  | { type: 'placed'; unit: Unit; cost: number }
  | { type: 'attack'; attacker: UnitId; target: UnitId; damage: number; pos: Vec2; onDiet: boolean }
  | { type: 'death'; unit: Unit; killer: UnitId | null; bounty: number }
  | { type: 'coins'; amount: number; pos: Vec2; reason: 'bounty' | 'wave' | 'totem' | 'trickle' }
  | { type: 'fed'; unit: Unit }
  | { type: 'feralWarning'; unit: Unit }
  | { type: 'feral'; unit: Unit }
  | { type: 'houseHit'; damage: number; hpLeft: number; attacker: UnitId }
  | { type: 'waveStart'; index: number; title?: string }
  | { type: 'waveCleared'; index: number; reward: number }
  | { type: 'levelEnd'; status: Exclude<SimStatus, 'running'>; stars: number };

export interface PlacementResult {
  ok: boolean;
  reason?: 'unaffordable' | 'cooldown' | 'occupied' | 'out-of-bounds' | 'unknown-species' | 'not-placeable';
  unit?: Unit;
  cost?: number;
}

export interface SimConfig {
  /** Damage multiplier when attacking something that is not on your menu. */
  offDietDamage: number;
  /** How far a planted guardian may lunge from its anchor. */
  leash: number;
  /** Crowd separation strength. */
  separation: number;
  /** Minimum gap between two planted guardians, added to their radii. */
  placementGap: number;
  /** Passive coin trickle per second — the game should always be paying out. */
  coinTrickle: number;
  /** Seconds of grace at the very start of a level before hunger begins. */
  hungerGrace: number;
  /** Bounty multiplier for bosses. */
  bossBounty: number;
  /** Stat multiplier for bosses. */
  bossHp: number;
  bossScale: number;
}

export const DEFAULT_SIM_CONFIG: SimConfig = {
  offDietDamage: 0.25,
  leash: 2.2,
  separation: 6,
  placementGap: 0.35,
  coinTrickle: 1.5,
  hungerGrace: 6,
  bossBounty: 12,
  bossHp: 9,
  bossScale: 1.9,
};

export interface LevelOutcome {
  status: SimStatus;
  stars: number;
  coinsCollected: number;
  houseHpFraction: number;
  feralCount: number;
  elapsed: number;
}

export type { Vec2 };
