/**
 * What the player has unlocked, and what the world map should show.
 *
 * Unlocks are intentionally generous: a biome opens on a star count, and every
 * guardian in a biome unlocks as soon as you meet it as an enemy. The game is
 * supposed to feel like it keeps handing you things.
 */
import type { BiomeDef, LevelDef, SpeciesId } from '@/content/schema';
import type { LevelRecord, SaveData } from './save';

export const levelKey = (biomeId: string, levelId: string): string => `${biomeId}/${levelId}`;

export function recordFor(save: SaveData, biomeId: string, levelId: string): LevelRecord {
  return save.levels[levelKey(biomeId, levelId)] ?? { stars: 0, bestCoins: 0, cleared: false };
}

export function totalStars(save: SaveData): number {
  return Object.values(save.levels).reduce((n, r) => n + r.stars, 0);
}

export function starsInBiome(save: SaveData, biome: BiomeDef): number {
  return biome.levels.reduce((n, lvl) => n + recordFor(save, biome.id, lvl.id).stars, 0);
}

export function maxStarsInBiome(biome: BiomeDef): number {
  return biome.levels.reduce((n, lvl) => n + (lvl.starGoals.noFeral ? 4 : 3), 0);
}

export function isBiomeUnlocked(save: SaveData, biome: BiomeDef): boolean {
  return totalStars(save) >= biome.unlock.stars;
}

/** Levels unlock in order; the first one in a biome is always open. */
export function isLevelUnlocked(save: SaveData, biome: BiomeDef, level: LevelDef): boolean {
  const index = biome.levels.findIndex((l) => l.id === level.id);
  if (index <= 0) return isBiomeUnlocked(save, biome);
  const prev = biome.levels[index - 1];
  return recordFor(save, biome.id, prev.id).cleared;
}

/** The level the world map should point the player at. */
export function nextLevel(
  save: SaveData,
  biomes: readonly BiomeDef[],
): { biome: BiomeDef; level: LevelDef } | null {
  const ordered = [...biomes].sort((a, b) => a.order - b.order);
  for (const biome of ordered) {
    if (!isBiomeUnlocked(save, biome)) continue;
    for (const level of biome.levels) {
      if (!recordFor(save, biome.id, level.id).cleared) return { biome, level };
    }
  }
  const last = ordered[ordered.length - 1];
  return last ? { biome: last, level: last.levels[last.levels.length - 1] } : null;
}

export interface LevelResult {
  biomeId: string;
  levelId: string;
  stars: number;
  coins: number;
  cleared: boolean;
}

/** Folds a finished level into the save. Records are best-of, never downgraded. */
export function applyLevelResult(save: SaveData, result: LevelResult): SaveData {
  const key = levelKey(result.biomeId, result.levelId);
  const prev = save.levels[key] ?? { stars: 0, bestCoins: 0, cleared: false };
  return {
    ...save,
    levels: {
      ...save.levels,
      [key]: {
        stars: Math.max(prev.stars, result.stars),
        bestCoins: Math.max(prev.bestCoins, result.coins),
        cleared: prev.cleared || result.cleared,
      },
    },
  };
}

/**
 * Species become placeable once the player has seen them. Called by the battle
 * host whenever a critter spawns, so meeting a wolf is what teaches you to
 * plant one.
 */
export function unlockSpecies(save: SaveData, ids: readonly SpeciesId[]): SaveData {
  const set = new Set(save.unlockedSpecies);
  let changed = false;
  for (const id of ids) {
    if (!set.has(id)) {
      set.add(id);
      changed = true;
    }
  }
  return changed ? { ...save, unlockedSpecies: [...set] } : save;
}

/**
 * Guardians the player may plant in a biome. The bottom two tiers are always
 * available so a fresh biome is never a blank screen.
 */
export function availableGuardians(save: SaveData, biome: BiomeDef): SpeciesId[] {
  const unlocked = new Set(save.unlockedSpecies);
  return biome.species
    .filter((s) => s.roles.includes('guardian') && s.guardian)
    .filter((s) => s.tier <= 1 || unlocked.has(s.id))
    .map((s) => s.id);
}
