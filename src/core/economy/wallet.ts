/**
 * Persistent currencies.
 *
 * `coins` are the soft currency the game rains on the player. `gems` are the
 * hard currency — earned slowly, and the thing an in-app purchase would top
 * up one day. Keeping both behind one small API means the IAP layer never has
 * to reach into save data directly.
 */
export type Currency = 'coins' | 'gems';

export interface WalletState {
  coins: number;
  gems: number;
  /** Lifetime totals, for achievements and for balancing telemetry. */
  lifetimeCoins: number;
}

export type WalletListener = (change: {
  currency: Currency;
  delta: number;
  balance: number;
  reason: string;
}) => void;

export class Wallet {
  private listeners = new Set<WalletListener>();

  constructor(private state: WalletState = { coins: 0, gems: 0, lifetimeCoins: 0 }) {}

  get coins(): number {
    return this.state.coins;
  }

  get gems(): number {
    return this.state.gems;
  }

  get lifetimeCoins(): number {
    return this.state.lifetimeCoins;
  }

  snapshot(): WalletState {
    return { ...this.state };
  }

  onChange(listener: WalletListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  balance(currency: Currency): number {
    return this.state[currency];
  }

  earn(currency: Currency, amount: number, reason = 'unknown'): number {
    if (amount <= 0) return this.state[currency];
    const rounded = Math.floor(amount);
    this.state[currency] += rounded;
    if (currency === 'coins') this.state.lifetimeCoins += rounded;
    this.notify(currency, rounded, reason);
    return this.state[currency];
  }

  canAfford(currency: Currency, amount: number): boolean {
    return this.state[currency] >= amount;
  }

  /** Returns false and changes nothing when the player cannot afford it. */
  spend(currency: Currency, amount: number, reason = 'unknown'): boolean {
    if (amount <= 0) return true;
    if (!this.canAfford(currency, amount)) return false;
    this.state[currency] -= amount;
    this.notify(currency, -amount, reason);
    return true;
  }

  private notify(currency: Currency, delta: number, reason: string): void {
    for (const l of this.listeners) {
      l({ currency, delta, balance: this.state[currency], reason });
    }
  }
}
