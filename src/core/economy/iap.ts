/**
 * In-app purchases.
 *
 * Nothing here talks to a store yet — and deliberately so. The game is built
 * around an `IapProvider` interface so that swapping in StoreKit / Play
 * Billing / Stripe later is a one-file change, while today a local stub lets
 * the rest of the game (and its tests) behave exactly as it will in
 * production.
 *
 * Design rules baked in:
 *   - Entitlements are derived state. Nothing in the save file says "damage
 *     x2"; it says "owns starter-pack", and bonuses are computed.
 *   - Every product is either cosmetic, a convenience multiplier, or hard
 *     currency. No content is gated behind a purchase.
 *   - Purchases are idempotent: restoring on a new device replays them.
 */
import type { UpgradeBonuses } from './upgrades';

export type ProductKind = 'currency' | 'boost' | 'cosmetic' | 'removal';

export interface ProductDef {
  id: string;
  name: string;
  description: string;
  kind: ProductKind;
  /** Display price. Real prices come from the store at runtime. */
  priceHint: string;
  /** Consumables can be bought repeatedly; entitlements cannot. */
  consumable: boolean;
  /** Hard currency granted, for `kind: 'currency'`. */
  grantsGems?: number;
  /** Permanent multipliers, for `kind: 'boost'`. */
  bonuses?: Partial<UpgradeBonuses>;
  /** Cosmetic id unlocked, for `kind: 'cosmetic'`. */
  unlocksSkin?: string;
}

export const PRODUCTS: ProductDef[] = [
  {
    id: 'gems.pouch',
    name: 'Pouch of Gems',
    description: 'A modest fistful of sparkly.',
    kind: 'currency',
    priceHint: '$1.99',
    consumable: true,
    grantsGems: 120,
  },
  {
    id: 'gems.sack',
    name: 'Sack of Gems',
    description: 'The king needs a bigger pocket.',
    kind: 'currency',
    priceHint: '$4.99',
    consumable: true,
    grantsGems: 400,
  },
  {
    id: 'boost.royal-feast',
    name: 'Royal Feast',
    description: 'Permanently +25% coins. Everyone eats well.',
    kind: 'boost',
    priceHint: '$3.99',
    consumable: false,
    bonuses: { coinRate: 0.25 },
  },
  {
    id: 'removal.no-ads',
    name: 'No Interruptions',
    description: 'Removes ad breaks between biomes, forever.',
    kind: 'removal',
    priceHint: '$2.99',
    consumable: false,
  },
  {
    id: 'cosmetic.crown-of-bees',
    name: 'Crown of Bees',
    description: 'It is a crown. It is made of bees. It buzzes.',
    kind: 'cosmetic',
    priceHint: '$1.99',
    consumable: false,
    unlocksSkin: 'king.bees',
  },
];

export function productById(id: string): ProductDef | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export interface PurchaseRecord {
  productId: string;
  /** Epoch millis. */
  at: number;
  /** Opaque receipt from the store; verified server-side in a real build. */
  receipt?: string;
}

export type PurchaseOutcome =
  | { status: 'purchased'; record: PurchaseRecord }
  | { status: 'already-owned' }
  | { status: 'cancelled' }
  | { status: 'unavailable'; reason: string };

export interface IapProvider {
  /** Products the store actually offers right now. */
  listProducts(): Promise<ProductDef[]>;
  purchase(productId: string): Promise<PurchaseOutcome>;
  /** Replays non-consumable purchases after a reinstall. */
  restore(): Promise<PurchaseRecord[]>;
}

/**
 * Stub provider used in development and in tests. It "succeeds" instantly and
 * keeps records in memory, so the purchase flow can be exercised end to end
 * without a store.
 */
export class LocalIapProvider implements IapProvider {
  private records: PurchaseRecord[] = [];

  constructor(private readonly now: () => number = Date.now) {}

  async listProducts(): Promise<ProductDef[]> {
    return PRODUCTS;
  }

  async purchase(productId: string): Promise<PurchaseOutcome> {
    const product = productById(productId);
    if (!product) return { status: 'unavailable', reason: `unknown product "${productId}"` };
    if (!product.consumable && this.records.some((r) => r.productId === productId)) {
      return { status: 'already-owned' };
    }
    const record: PurchaseRecord = { productId, at: this.now(), receipt: `local:${productId}` };
    this.records.push(record);
    return { status: 'purchased', record };
  }

  async restore(): Promise<PurchaseRecord[]> {
    return this.records.filter((r) => !productById(r.productId)?.consumable);
  }
}

export interface Entitlements {
  noAds: boolean;
  skins: string[];
  bonuses: Partial<UpgradeBonuses>;
}

/** Derives what the player owns from their purchase history. */
export function entitlementsFrom(records: readonly PurchaseRecord[]): Entitlements {
  const out: Entitlements = { noAds: false, skins: [], bonuses: {} };
  for (const record of records) {
    const product = productById(record.productId);
    if (!product) continue;
    if (product.kind === 'removal' && product.id === 'removal.no-ads') out.noAds = true;
    if (product.unlocksSkin && !out.skins.includes(product.unlocksSkin)) {
      out.skins.push(product.unlocksSkin);
    }
    for (const [key, value] of Object.entries(product.bonuses ?? {})) {
      const k = key as keyof UpgradeBonuses;
      out.bonuses[k] = (out.bonuses[k] ?? 0) + (value as number);
    }
  }
  return out;
}

/** Gems owed by consumable purchases that have not been credited yet. */
export function pendingGems(
  records: readonly PurchaseRecord[],
  credited: ReadonlySet<string>,
): { gems: number; creditedIds: string[] } {
  let gems = 0;
  const creditedIds: string[] = [];
  for (const record of records) {
    const key = `${record.productId}@${record.at}`;
    if (credited.has(key)) continue;
    const product = productById(record.productId);
    if (product?.grantsGems) {
      gems += product.grantsGems;
      creditedIds.push(key);
    }
  }
  return { gems, creditedIds };
}
