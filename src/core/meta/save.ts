/**
 * Save data: versioned, migrated forward, and storage-agnostic.
 *
 * Tests run against `MemoryStorage`; the browser uses localStorage. Migrations
 * are a plain chain of functions so adding a field later never bricks an
 * existing player's file.
 */
import type { PurchaseRecord } from '@/core/economy/iap';
import type { UpgradeLevels } from '@/core/economy/upgrades';
import type { WalletState } from '@/core/economy/wallet';

export const SAVE_VERSION = 3;
export const SAVE_KEY = 'foodchain.save.v1';

export interface LevelRecord {
  stars: number;
  bestCoins: number;
  cleared: boolean;
}

export interface SaveData {
  version: number;
  wallet: WalletState;
  upgrades: UpgradeLevels;
  /** `${biomeId}/${levelId}` -> record. */
  levels: Record<string, LevelRecord>;
  unlockedSpecies: string[];
  purchases: PurchaseRecord[];
  /** Keys of consumable purchases already converted into gems. */
  creditedPurchases: string[];
  settings: {
    musicVolume: number;
    sfxVolume: number;
    haptics: boolean;
    /** Automatic upgrades between levels. On by default — this is a casual game. */
    autoUpgrade: boolean;
    /** Auto-pick which animal to plant. On by default. */
    autoPick: boolean;
  };
  /** Epoch millis of the last save, used for offline coin accrual later. */
  savedAt: number;
}

export function freshSave(): SaveData {
  return {
    version: SAVE_VERSION,
    wallet: { coins: 0, gems: 0, lifetimeCoins: 0 },
    upgrades: {},
    levels: {},
    unlockedSpecies: [],
    purchases: [],
    creditedPurchases: [],
    settings: {
      musicVolume: 0.7,
      sfxVolume: 0.9,
      haptics: true,
      autoUpgrade: true,
      autoPick: true,
    },
    savedAt: 0,
  };
}

export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export class MemoryStorage implements StorageAdapter {
  private readonly map = new Map<string, string>();
  get(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  set(key: string, value: string): void {
    this.map.set(key, value);
  }
  remove(key: string): void {
    this.map.delete(key);
  }
}

export class BrowserStorage implements StorageAdapter {
  get(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  set(key: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* private browsing, quota — losing a save beats crashing the game */
    }
  }
  remove(key: string): void {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/** Index N migrates a version-N file to version N+1. */
const MIGRATIONS: Record<number, Migration> = {
  1: (data) => ({ ...data, purchases: [], creditedPurchases: [], version: 2 }),
  2: (data) => ({
    ...data,
    settings: {
      musicVolume: 0.7,
      sfxVolume: 0.9,
      haptics: true,
      autoUpgrade: true,
      autoPick: true,
      ...(data.settings as object | undefined),
    },
    version: 3,
  }),
};

export function migrate(raw: Record<string, unknown>): SaveData {
  let data = { ...raw };
  let version = typeof data.version === 'number' ? data.version : 1;
  let guard = 0;
  while (version < SAVE_VERSION && guard++ < 50) {
    const step = MIGRATIONS[version];
    if (!step) break;
    data = step(data);
    version = typeof data.version === 'number' ? data.version : version + 1;
  }
  // Fill anything a migration did not cover, so a partial file still boots.
  return { ...freshSave(), ...(data as Partial<SaveData>), version: SAVE_VERSION } as SaveData;
}

export function loadSave(storage: StorageAdapter, key = SAVE_KEY): SaveData {
  const raw = storage.get(key);
  if (!raw) return freshSave();
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return migrate(parsed);
  } catch {
    return freshSave();
  }
}

export function writeSave(
  storage: StorageAdapter,
  data: SaveData,
  key = SAVE_KEY,
  now = Date.now(),
): void {
  storage.set(key, JSON.stringify({ ...data, savedAt: now }));
}
