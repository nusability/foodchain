/**
 * Song registry.
 *
 * Every biome's `music` field names one of these. The test suite validates all
 * of them, so a song that drifts below the 36-bar / key-change brief fails CI
 * rather than quietly shipping.
 */
import type { SongDef } from '../song';
import { meadow } from './meadow';
import { jungle } from './jungle';
import { tundra } from './tundra';
import { reef } from './reef';
import { volcano } from './volcano';

export const SONGS: SongDef[] = [meadow, jungle, tundra, reef, volcano];

export function songById(id: string): SongDef | undefined {
  return SONGS.find((s) => s.id === id);
}
