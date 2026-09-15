/**
 * Content schema for Food Chain.
 *
 * Everything a content author (human or sub-agent) produces — biomes, food
 * chains, species, levels, waves — is plain data shaped by the types below.
 * Nothing in here imports the renderer or the simulation, so content packs
 * can be validated and unit-tested in isolation.
 *
 * See docs/BIOME_AUTHORING.md for the authoring guide.
 */
import type { Vec2 } from '@/core/math';

export type SpeciesId = string;
export type BiomeId = string;
export type LevelId = string;

/** Where a species sits in the food chain. Tier 0 is the bottom (bugs, seeds). */
export type Tier = number;

export interface SpeciesStats {
  /** Hit points at wave 1 / tier baseline. */
  hp: number;
  /** World units per second while crawling. */
  speed: number;
  /** Damage per attack. */
  damage: number;
  /** Attacks per second. */
  attackRate: number;
  /** Reach, in world units, measured centre-to-centre minus radii. */
  range: number;
  /** Body radius — drives crowd packing and hit detection. */
  radius: number;
  /** Coins dropped on death. The game is meant to rain coins: be generous. */
  bounty: number;
  /** Heavier things squish less and shrug off knockback. */
  mass: number;
}

/**
 * Guardian-specific data. A species with this block can be *placed* by the
 * player. Everything placeable eventually goes feral — that is the game.
 */
export interface GuardianSpec {
  /** Coin cost of the first placement in a level. */
  cost: number;
  /** Cost multiplier applied per copy already on the field. */
  costGrowth: number;
  /** Seconds before the same species can be placed again. */
  placeCooldown: number;
  /** Satiety drained per second while idle. At 0 the guardian turns feral. */
  hungerRate: number;
  /** Satiety restored per kill, as a fraction of max (0..1). */
  satietyPerMeal: number;
  /** Multiplier applied to stats once feral — feral things are scary. */
  feralScale: number;
  /** Seconds of "about to turn" warning wobble before going feral. */
  warnTime: number;
}

/** Points the renderer at a model builder plus its palette. */
export interface ModelSpec {
  /** Registered model kit id — see src/render/models/registry.ts. */
  kit: string;
  /** Comic-book palette, hex strings. Slot meaning is kit-specific. */
  palette: string[];
  /** Uniform scale multiplier applied on top of the kit's natural size. */
  scale?: number;
  /** Free-form knobs consumed by the kit builder. */
  props?: Record<string, number | string | boolean>;
}

export interface SpeciesDef {
  id: SpeciesId;
  name: string;
  tier: Tier;
  /** Can it spawn as an enemy, be placed as a guardian, or both? */
  roles: Array<'critter' | 'guardian'>;
  /** Species ids this one can eat. Forms the edges of the food-chain tree. */
  eats: SpeciesId[];
  stats: SpeciesStats;
  guardian?: GuardianSpec;
  model: ModelSpec;
  /** One wacky line shown when the species first appears. */
  flavor?: string;
  /** Overrides for procedural voice synthesis — see src/audio/sfx. */
  voice?: {
    /** Base pitch in Hz for chirps/roars. Big animals go low. */
    pitch?: number;
    /** 'chirp' | 'growl' | 'squeak' | 'honk' | 'rumble' */
    timbre?: string;
  };
}

export interface LaneDef {
  id: string;
  /** Polyline from the spawn edge to the house. At least two points. */
  points: Vec2[];
  /** Relative chance this lane is chosen when a wave entry says `lane: 'any'`. */
  weight: number;
}

export interface WaveEntry {
  species: SpeciesId;
  count: number;
  /** Seconds between each spawn in this entry. */
  spacing: number;
  /** Seconds after wave start before the first spawn. */
  delay: number;
  /** Lane id, or 'any' to roll one per critter using lane weights. */
  lane: string | 'any';
  hpScale?: number;
  speedScale?: number;
  /** Bosses get a name card, a screen shake and a much bigger bounty. */
  boss?: boolean;
}

export interface WaveDef {
  entries: WaveEntry[];
  /** Coins handed out for clearing the wave. */
  reward: number;
  /** Seconds of calm after the wave is cleared. */
  restAfter: number;
  /** Optional banner text. */
  title?: string;
}

/** A spot the king can walk onto to trigger something. No menus, ever. */
export interface TotemDef {
  id: string;
  kind: 'rally' | 'roar' | 'coinfall' | 'shop' | 'exit';
  position: Vec2;
}

export interface PropDef {
  kit: string;
  position: Vec2;
  rotation?: number;
  scale?: number;
}

export interface StarGoals {
  /** 3rd star: finish with at least this fraction of house HP (0..1). */
  houseHp: number;
  /** 2nd star: collect at least this many coins during the level. */
  coins: number;
  /** Bonus star condition: never let a guardian go feral. */
  noFeral?: boolean;
}

export interface LevelDef {
  id: LevelId;
  name: string;
  arena: { width: number; depth: number };
  house: { position: Vec2; hp: number };
  lanes: LaneDef[];
  waves: WaveDef[];
  startingCoins: number;
  starGoals: StarGoals;
  totems?: TotemDef[];
  props?: PropDef[];
}

export interface BiomePalette {
  sky: string;
  ground: string;
  groundAccent: string;
  path: string;
  fog: string;
  sun: string;
  rim: string;
}

export interface BiomeDef {
  id: BiomeId;
  name: string;
  /** Order on the world map; also the default unlock order. */
  order: number;
  blurb: string;
  /** Position on the world map, in world-map units. */
  mapPosition: Vec2;
  unlock: {
    /** Stars needed across all earlier biomes. */
    stars: number;
  };
  palette: BiomePalette;
  species: SpeciesDef[];
  levels: LevelDef[];
  /** Song id registered in src/audio/music/songs. */
  music: string;
  ambience?: {
    /** 'wind' | 'jungle' | 'ice' | 'reef' | 'lava' | 'night' */
    bed: string;
    density?: number;
  };
}

/** Convenience accessors used across the codebase. */
export function speciesById(biome: BiomeDef): Map<SpeciesId, SpeciesDef> {
  const map = new Map<SpeciesId, SpeciesDef>();
  for (const s of biome.species) map.set(s.id, s);
  return map;
}

export function guardiansOf(biome: BiomeDef): SpeciesDef[] {
  return biome.species.filter((s) => s.roles.includes('guardian') && s.guardian);
}

export function crittersOf(biome: BiomeDef): SpeciesDef[] {
  return biome.species.filter((s) => s.roles.includes('critter'));
}
