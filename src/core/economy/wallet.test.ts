import { describe, expect, it, vi } from 'vitest';
import { Wallet } from './wallet';

describe('Wallet', () => {
  it('earns and tracks lifetime coins', () => {
    const w = new Wallet();
    w.earn('coins', 50, 'test');
    w.earn('gems', 5, 'test');
    expect(w.coins).toBe(50);
    expect(w.gems).toBe(5);
    expect(w.lifetimeCoins).toBe(50);
  });

  it('ignores non-positive earnings', () => {
    const w = new Wallet();
    w.earn('coins', 0);
    w.earn('coins', -20);
    expect(w.coins).toBe(0);
  });

  it('floors fractional earnings', () => {
    const w = new Wallet();
    w.earn('coins', 12.9);
    expect(w.coins).toBe(12);
  });

  it('spends only what it has', () => {
    const w = new Wallet({ coins: 30, gems: 0, lifetimeCoins: 30 });
    expect(w.spend('coins', 40)).toBe(false);
    expect(w.coins).toBe(30);
    expect(w.spend('coins', 30)).toBe(true);
    expect(w.coins).toBe(0);
  });

  it('spending gems does not touch lifetime coins', () => {
    const w = new Wallet({ coins: 0, gems: 10, lifetimeCoins: 100 });
    w.spend('gems', 4);
    expect(w.lifetimeCoins).toBe(100);
  });

  it('notifies listeners, and stops after unsubscribe', () => {
    const w = new Wallet();
    const seen = vi.fn();
    const off = w.onChange(seen);
    w.earn('coins', 10, 'reward');
    expect(seen).toHaveBeenCalledWith({
      currency: 'coins',
      delta: 10,
      balance: 10,
      reason: 'reward',
    });
    off();
    w.earn('coins', 10);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('snapshots without aliasing internal state', () => {
    const w = new Wallet();
    const snap = w.snapshot();
    w.earn('coins', 10);
    expect(snap.coins).toBe(0);
  });
});
