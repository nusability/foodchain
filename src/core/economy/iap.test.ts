import { describe, expect, it } from 'vitest';
import {
  entitlementsFrom,
  LocalIapProvider,
  pendingGems,
  PRODUCTS,
  productById,
  type PurchaseRecord,
} from './iap';

describe('IAP framework', () => {
  it('every product is well formed', () => {
    for (const p of PRODUCTS) {
      expect(p.id).toMatch(/^[a-z]+\.[a-z-]+$/);
      expect(p.priceHint).toMatch(/^\$/);
      if (p.kind === 'currency') expect(p.grantsGems).toBeGreaterThan(0);
      if (p.kind === 'cosmetic') expect(p.unlocksSkin).toBeTruthy();
      // Nothing may gate content — that is a design rule, so it is a test.
      expect(p.kind).not.toBe('content');
    }
  });

  it('looks products up by id', () => {
    expect(productById('gems.pouch')?.grantsGems).toBe(120);
    expect(productById('nope')).toBeUndefined();
  });

  describe('LocalIapProvider', () => {
    it('purchases a product', async () => {
      const iap = new LocalIapProvider(() => 1000);
      const out = await iap.purchase('gems.pouch');
      expect(out).toEqual({
        status: 'purchased',
        record: { productId: 'gems.pouch', at: 1000, receipt: 'local:gems.pouch' },
      });
    });

    it('rejects unknown products', async () => {
      const out = await new LocalIapProvider().purchase('nope');
      expect(out.status).toBe('unavailable');
    });

    it('refuses to sell a non-consumable twice', async () => {
      const iap = new LocalIapProvider();
      await iap.purchase('removal.no-ads');
      expect((await iap.purchase('removal.no-ads')).status).toBe('already-owned');
    });

    it('allows repeat purchases of consumables', async () => {
      const iap = new LocalIapProvider();
      await iap.purchase('gems.pouch');
      expect((await iap.purchase('gems.pouch')).status).toBe('purchased');
    });

    it('restores only non-consumables', async () => {
      const iap = new LocalIapProvider();
      await iap.purchase('gems.pouch');
      await iap.purchase('removal.no-ads');
      const restored = await iap.restore();
      expect(restored.map((r) => r.productId)).toEqual(['removal.no-ads']);
    });
  });

  describe('entitlements', () => {
    const record = (productId: string, at = 1): PurchaseRecord => ({ productId, at });

    it('are empty by default', () => {
      expect(entitlementsFrom([])).toEqual({ noAds: false, skins: [], bonuses: {} });
    });

    it('derive from purchase history rather than being stored', () => {
      const e = entitlementsFrom([record('removal.no-ads'), record('cosmetic.crown-of-bees')]);
      expect(e.noAds).toBe(true);
      expect(e.skins).toEqual(['king.bees']);
    });

    it('accumulate boost bonuses', () => {
      const e = entitlementsFrom([record('boost.royal-feast')]);
      expect(e.bonuses.coinRate).toBe(0.25);
    });

    it('are idempotent for a repeated non-consumable', () => {
      const once = entitlementsFrom([record('cosmetic.crown-of-bees', 1)]);
      const twice = entitlementsFrom([
        record('cosmetic.crown-of-bees', 1),
        record('cosmetic.crown-of-bees', 2),
      ]);
      expect(twice.skins).toEqual(once.skins);
    });

    it('ignore records for products that no longer exist', () => {
      expect(entitlementsFrom([record('gems.retired')])).toEqual({
        noAds: false,
        skins: [],
        bonuses: {},
      });
    });
  });

  describe('gem crediting', () => {
    it('credits each consumable purchase exactly once', () => {
      const records: PurchaseRecord[] = [
        { productId: 'gems.pouch', at: 1 },
        { productId: 'gems.sack', at: 2 },
      ];
      const first = pendingGems(records, new Set());
      expect(first.gems).toBe(520);
      const second = pendingGems(records, new Set(first.creditedIds));
      expect(second.gems).toBe(0);
    });

    it('credits a repeat purchase of the same product again', () => {
      const records: PurchaseRecord[] = [
        { productId: 'gems.pouch', at: 1 },
        { productId: 'gems.pouch', at: 2 },
      ];
      expect(pendingGems(records, new Set()).gems).toBe(240);
    });

    it('never credits a non-currency product', () => {
      expect(pendingGems([{ productId: 'removal.no-ads', at: 1 }], new Set()).gems).toBe(0);
    });
  });
});
