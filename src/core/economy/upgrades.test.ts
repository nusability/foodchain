import { describe, expect, it } from 'vitest';
import { Wallet } from './wallet';
import {
  autoPurchase,
  bonusesFor,
  costOf,
  UPGRADES,
  upgradeById,
  type UpgradeLevels,
} from './upgrades';

describe('upgrades', () => {
  it('prices climb with each level owned', () => {
    const def = UPGRADES[0];
    expect(costOf(def, 0)).toBe(def.baseCost);
    expect(costOf(def, 3)).toBeGreaterThan(costOf(def, 2));
  });

  it('bonuses start neutral and accumulate', () => {
    expect(bonusesFor({})).toMatchObject({ guardianDamage: 1, startingCoins: 0 });
    const boosted = bonusesFor({ 'sharper-teeth': 5 });
    expect(boosted.guardianDamage).toBeCloseTo(1 + 0.08 * 5, 5);
  });

  it('flat-effect upgrades add rather than multiply', () => {
    expect(bonusesFor({ 'piggy-bank': 4 }).startingCoins).toBe(60);
  });

  it('ignores unknown upgrade ids in save data', () => {
    expect(bonusesFor({ 'not-a-thing': 99 })).toEqual(bonusesFor({}));
  });

  describe('autoPurchase — the casual upgrade path', () => {
    it('buys nothing when the player is broke', () => {
      const wallet = new Wallet({ coins: 10, gems: 0, lifetimeCoins: 10 });
      const levels: UpgradeLevels = {};
      const bought = autoPurchase((n) => wallet.spend('coins', n), wallet.coins, levels);
      expect(bought).toEqual([]);
      expect(levels).toEqual({});
    });

    it('buys in priority order', () => {
      const wallet = new Wallet({ coins: 400, gems: 0, lifetimeCoins: 400 });
      const levels: UpgradeLevels = {};
      const bought = autoPurchase((n) => wallet.spend('coins', n), wallet.coins, levels);
      expect(bought[0].upgrade.id).toBe('sharper-teeth');
      expect(bought.length).toBeGreaterThan(1);
    });

    it('actually spends the coins it reports spending', () => {
      const wallet = new Wallet({ coins: 5000, gems: 0, lifetimeCoins: 5000 });
      const levels: UpgradeLevels = {};
      const bought = autoPurchase((n) => wallet.spend('coins', n), wallet.coins, levels);
      const total = bought.reduce((n, b) => n + b.cost, 0);
      expect(wallet.coins).toBe(5000 - total);
    });

    it('keeps a reserve back so the player still feels rich', () => {
      const wallet = new Wallet({ coins: 200, gems: 0, lifetimeCoins: 200 });
      const bought = autoPurchase((n) => wallet.spend('coins', n), wallet.coins, {}, { reserve: 150 });
      expect(bought).toEqual([]);
    });

    it('respects the per-call purchase cap', () => {
      const wallet = new Wallet({ coins: 1e9, gems: 0, lifetimeCoins: 1e9 });
      const bought = autoPurchase((n) => wallet.spend('coins', n), wallet.coins, {}, { maxPurchases: 3 });
      expect(bought).toHaveLength(3);
    });

    it('stops at an upgrade’s max level', () => {
      const def = upgradeById('coin-magnet')!;
      const levels: UpgradeLevels = { [def.id]: def.maxLevel };
      const wallet = new Wallet({ coins: 1e9, gems: 0, lifetimeCoins: 1e9 });
      const bought = autoPurchase((n) => wallet.spend('coins', n), wallet.coins, levels, {
        maxPurchases: 40,
      });
      expect(bought.some((b) => b.upgrade.id === def.id)).toBe(false);
      expect(levels[def.id]).toBe(def.maxLevel);
    });

    it('records the level each purchase reached', () => {
      const wallet = new Wallet({ coins: 1e6, gems: 0, lifetimeCoins: 1e6 });
      const levels: UpgradeLevels = {};
      const bought = autoPurchase((n) => wallet.spend('coins', n), wallet.coins, levels, {
        maxPurchases: 6,
      });
      for (const b of bought) expect(levels[b.upgrade.id]).toBeGreaterThanOrEqual(b.level);
    });
  });
});
