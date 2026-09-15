import { describe, expect, it } from 'vitest';
import {
  BrowserStorage,
  freshSave,
  loadSave,
  MemoryStorage,
  migrate,
  SAVE_KEY,
  SAVE_VERSION,
  writeSave,
} from './save';

describe('save data', () => {
  it('round-trips', () => {
    const storage = new MemoryStorage();
    const save = { ...freshSave(), upgrades: { 'sharper-teeth': 3 } };
    writeSave(storage, save, SAVE_KEY, 12345);
    const loaded = loadSave(storage);
    expect(loaded.upgrades).toEqual({ 'sharper-teeth': 3 });
    expect(loaded.savedAt).toBe(12345);
  });

  it('returns a fresh save when there is nothing stored', () => {
    expect(loadSave(new MemoryStorage()).version).toBe(SAVE_VERSION);
  });

  it('survives corrupt save data rather than crashing the game', () => {
    const storage = new MemoryStorage();
    storage.set(SAVE_KEY, '{not json at all');
    expect(loadSave(storage)).toEqual(freshSave());
  });

  describe('migrations', () => {
    it('brings a version-1 file forward', () => {
      const old = { version: 1, wallet: { coins: 99, gems: 0, lifetimeCoins: 99 }, upgrades: {}, levels: {} };
      const migrated = migrate(old as never);
      expect(migrated.version).toBe(SAVE_VERSION);
      expect(migrated.wallet.coins).toBe(99);
      expect(migrated.purchases).toEqual([]);
      expect(migrated.settings.autoUpgrade).toBe(true);
    });

    it('keeps settings a player had already chosen', () => {
      const old = {
        version: 2,
        settings: { musicVolume: 0, sfxVolume: 0.2 },
      };
      const migrated = migrate(old as never);
      expect(migrated.settings.musicVolume).toBe(0);
      expect(migrated.settings.sfxVolume).toBe(0.2);
      // And fills in the fields that version did not have.
      expect(migrated.settings.autoPick).toBe(true);
    });

    it('fills gaps in a partial file', () => {
      const migrated = migrate({ version: SAVE_VERSION } as never);
      expect(migrated.levels).toEqual({});
      expect(migrated.wallet.coins).toBe(0);
    });

    it('treats a versionless file as version 1', () => {
      expect(migrate({} as never).version).toBe(SAVE_VERSION);
    });

    it('does not loop forever on an impossible version', () => {
      expect(migrate({ version: -5 } as never).version).toBe(SAVE_VERSION);
    });
  });

  it('BrowserStorage degrades quietly when localStorage is unavailable', () => {
    // Private browsing, blocked site data, or a non-DOM context: losing a save
    // is bad, but throwing on boot is worse.
    const storage = new BrowserStorage();
    expect(storage.get('anything')).toBeNull();
    expect(() => storage.set('anything', 'value')).not.toThrow();
    expect(() => storage.remove('anything')).not.toThrow();
    expect(loadSave(storage)).toEqual(freshSave());
  });
});
