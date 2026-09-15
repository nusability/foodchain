/**
 * Every biome in the game, in world-map order.
 *
 * Adding a biome is two lines: import it, list it. `npm run validate:content`
 * then checks the whole set — chain integrity, wave references, lane geometry,
 * star goals — before it ever reaches a player.
 */
import type { BiomeDef, LevelDef } from './schema';
import { meadow } from './biomes/meadow';
import { jungle } from './biomes/jungle';
import { tundra } from './biomes/tundra';
import { reef } from './biomes/reef';
import { volcano } from './biomes/volcano';

export const BIOMES: BiomeDef[] = [meadow, jungle, tundra, reef, volcano].sort(
  (a, b) => a.order - b.order,
);

export function biomeById(id: string): BiomeDef | undefined {
  return BIOMES.find((b) => b.id === id);
}

export function findLevel(biomeId: string, levelId: string): { biome: BiomeDef; level: LevelDef } | undefined {
  const biome = biomeById(biomeId);
  const level = biome?.levels.find((l) => l.id === levelId);
  return biome && level ? { biome, level } : undefined;
}

export function allSpecies() {
  return BIOMES.flatMap((b) => b.species);
}
