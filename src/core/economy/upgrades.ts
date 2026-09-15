/**
 * Meta upgrades.
 *
 * The game is meant to be extremely casual, so the player never browses an
 * upgrade screen: `autoPurchase` is run after every level and buys everything
 * affordable in priority order. The upgrade *screen* still exists in spirit —
 * it is just driven by the machine.
 */
export interface UpgradeDef {
  id: string;
  name: string;
  /** Short, wacky line shown in the coin-burst toast when it auto-buys. */
  blurb: string;
  maxLevel: number;
  baseCost: number;
  /** Cost multiplier per level already owned. */
  costGrowth: number;
  /** Bonus added per level — see `bonusesFor`. */
  effect: keyof UpgradeBonuses;
  perLevel: number;
  /** Lower numbers buy first. */
  priority: number;
}

export interface UpgradeBonuses {
  guardianDamage: number;
  guardianHp: number;
  coinRate: number;
  houseHp: number;
  startingCoins: number;
}

export const BASE_BONUSES: UpgradeBonuses = {
  guardianDamage: 1,
  guardianHp: 1,
  coinRate: 1,
  houseHp: 1,
  startingCoins: 0,
};

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'sharper-teeth',
    name: 'Sharper Teeth',
    blurb: 'Everyone bites harder. Dentists hate it.',
    maxLevel: 30,
    baseCost: 120,
    costGrowth: 1.28,
    effect: 'guardianDamage',
    perLevel: 0.08,
    priority: 1,
  },
  {
    id: 'thicker-hides',
    name: 'Thicker Hides',
    blurb: 'Your animals grew a second layer of animal.',
    maxLevel: 30,
    baseCost: 140,
    costGrowth: 1.3,
    effect: 'guardianHp',
    perLevel: 0.09,
    priority: 2,
  },
  {
    id: 'coin-magnet',
    name: 'Coin Magnet',
    blurb: 'Coins now find YOU. Terrifying.',
    maxLevel: 25,
    baseCost: 200,
    costGrowth: 1.32,
    effect: 'coinRate',
    perLevel: 0.1,
    priority: 3,
  },
  {
    id: 'royal-masonry',
    name: 'Royal Masonry',
    blurb: 'The house is now 4% castle.',
    maxLevel: 20,
    baseCost: 260,
    costGrowth: 1.35,
    effect: 'houseHp',
    perLevel: 0.12,
    priority: 4,
  },
  {
    id: 'piggy-bank',
    name: 'Piggy Bank',
    blurb: 'Start every level with pocket change.',
    maxLevel: 20,
    baseCost: 180,
    costGrowth: 1.4,
    effect: 'startingCoins',
    perLevel: 15,
    priority: 5,
  },
];

export type UpgradeLevels = Record<string, number>;

export function upgradeById(id: string): UpgradeDef | undefined {
  return UPGRADES.find((u) => u.id === id);
}

export function costOf(def: UpgradeDef, currentLevel: number): number {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, currentLevel));
}

export function bonusesFor(levels: UpgradeLevels): UpgradeBonuses {
  const out: UpgradeBonuses = { ...BASE_BONUSES };
  for (const def of UPGRADES) {
    const lvl = levels[def.id] ?? 0;
    if (lvl <= 0) continue;
    if (def.effect === 'startingCoins') out.startingCoins += def.perLevel * lvl;
    else out[def.effect] += def.perLevel * lvl;
  }
  return out;
}

export interface AutoPurchase {
  upgrade: UpgradeDef;
  level: number;
  cost: number;
}

export interface AutoPurchaseOptions {
  /** Keep this many coins in reserve so the player still feels rich. */
  reserve?: number;
  /** Safety valve so one fat wallet cannot buy the whole tree in one frame. */
  maxPurchases?: number;
}

/**
 * Spend coins on upgrades, cheapest-priority first, until nothing is
 * affordable. Mutates `levels` and returns what it bought so the UI can throw
 * a satisfying stack of toasts at the player.
 */
export function autoPurchase(
  spend: (amount: number) => boolean,
  available: number,
  levels: UpgradeLevels,
  opts: AutoPurchaseOptions = {},
): AutoPurchase[] {
  const reserve = opts.reserve ?? 0;
  const maxPurchases = opts.maxPurchases ?? 12;
  const bought: AutoPurchase[] = [];
  let budget = available - reserve;

  while (bought.length < maxPurchases) {
    const candidates = UPGRADES.filter((u) => (levels[u.id] ?? 0) < u.maxLevel)
      .map((u) => ({ u, cost: costOf(u, levels[u.id] ?? 0) }))
      .filter((c) => c.cost <= budget)
      .sort((a, b) => a.u.priority - b.u.priority || a.cost - b.cost);

    const next = candidates[0];
    if (!next) break;
    if (!spend(next.cost)) break;
    budget -= next.cost;
    const level = (levels[next.u.id] ?? 0) + 1;
    levels[next.u.id] = level;
    bought.push({ upgrade: next.u, level, cost: next.cost });
  }

  return bought;
}
