import { describe, expect, it } from 'vitest';
import type { BiomeDef } from '@/content/schema';
import { testBiome, testLevel } from '../../../tests/fixtures';
import { freshSave, type SaveData } from './save';
import {
  applyLevelResult,
  availableGuardians,
  isBiomeUnlocked,
  isLevelUnlocked,
  levelKey,
  maxStarsInBiome,
  nextLevel,
  recordFor,
  starsInBiome,
  totalStars,
  unlockSpecies,
} from './progression';

const biomeA: BiomeDef = testBiome({
  id: 'a',
  order: 0,
  unlock: { stars: 0 },
  levels: [testLevel({ id: 'a-1' }), testLevel({ id: 'a-2' }), testLevel({ id: 'a-3' })],
});

const biomeB: BiomeDef = testBiome({
  id: 'b',
  order: 1,
  unlock: { stars: 5 },
  levels: [testLevel({ id: 'b-1' })],
});

function withCleared(save: SaveData, biomeId: string, levelId: string, stars = 3): SaveData {
  return applyLevelResult(save, { biomeId, levelId, stars, coins: 100, cleared: true });
}

describe('progression', () => {
  it('starts with nothing cleared', () => {
    const save = freshSave();
    expect(totalStars(save)).toBe(0);
    expect(recordFor(save, 'a', 'a-1')).toEqual({ stars: 0, bestCoins: 0, cleared: false });
  });

  it('records a result and counts stars', () => {
    const save = withCleared(freshSave(), 'a', 'a-1', 2);
    expect(save.levels[levelKey('a', 'a-1')]).toEqual({ stars: 2, bestCoins: 100, cleared: true });
    expect(totalStars(save)).toBe(2);
    expect(starsInBiome(save, biomeA)).toBe(2);
  });

  it('keeps the best result and never downgrades it', () => {
    let save = withCleared(freshSave(), 'a', 'a-1', 3);
    save = applyLevelResult(save, {
      biomeId: 'a',
      levelId: 'a-1',
      stars: 1,
      coins: 10,
      cleared: false,
    });
    expect(save.levels[levelKey('a', 'a-1')]).toEqual({ stars: 3, bestCoins: 100, cleared: true });
  });

  it('counts the maximum stars a biome can give', () => {
    // The fixture level offers a no-feral bonus star, so four each.
    expect(maxStarsInBiome(biomeA)).toBe(12);
  });

  describe('unlocks', () => {
    it('gates a biome on a star count', () => {
      const save = freshSave();
      expect(isBiomeUnlocked(save, biomeA)).toBe(true);
      expect(isBiomeUnlocked(save, biomeB)).toBe(false);
      const richer = withCleared(withCleared(save, 'a', 'a-1'), 'a', 'a-2');
      expect(isBiomeUnlocked(richer, biomeB)).toBe(true);
    });

    it('opens levels in order', () => {
      const save = freshSave();
      expect(isLevelUnlocked(save, biomeA, biomeA.levels[0])).toBe(true);
      expect(isLevelUnlocked(save, biomeA, biomeA.levels[1])).toBe(false);
      const cleared = withCleared(save, 'a', 'a-1');
      expect(isLevelUnlocked(cleared, biomeA, biomeA.levels[1])).toBe(true);
    });

    it('a locked biome locks its first level too', () => {
      expect(isLevelUnlocked(freshSave(), biomeB, biomeB.levels[0])).toBe(false);
    });
  });

  describe('nextLevel', () => {
    it('points at the first uncleared level', () => {
      expect(nextLevel(freshSave(), [biomeA, biomeB])?.level.id).toBe('a-1');
      const save = withCleared(freshSave(), 'a', 'a-1');
      expect(nextLevel(save, [biomeA, biomeB])?.level.id).toBe('a-2');
    });

    it('skips locked biomes', () => {
      let save = freshSave();
      for (const id of ['a-1', 'a-2', 'a-3']) save = withCleared(save, 'a', id, 1);
      // Only 3 stars: biome B needs 5, so there is nothing new to point at.
      expect(nextLevel(save, [biomeA, biomeB])?.biome.id).toBe('b');
    });

    it('returns null with no biomes at all', () => {
      expect(nextLevel(freshSave(), [])).toBeNull();
    });
  });

  describe('species unlocks', () => {
    it('unlocks on first sight and is idempotent', () => {
      let save = unlockSpecies(freshSave(), ['t.frog', 't.frog']);
      expect(save.unlockedSpecies).toEqual(['t.frog']);
      const same = unlockSpecies(save, ['t.frog']);
      expect(same).toBe(save); // unchanged saves are returned as-is
      save = unlockSpecies(save, ['t.hawk']);
      expect(save.unlockedSpecies.sort()).toEqual(['t.frog', 't.hawk']);
    });

    it('always offers the bottom two tiers so a biome is never empty', () => {
      const available = availableGuardians(freshSave(), biomeA);
      expect(available).toContain('t.frog'); // tier 1
      expect(available).not.toContain('t.hawk'); // tier 2, not yet met
    });

    it('offers higher tiers once the player has met them', () => {
      const save = unlockSpecies(freshSave(), ['t.hawk']);
      expect(availableGuardians(save, biomeA)).toContain('t.hawk');
    });
  });
});
