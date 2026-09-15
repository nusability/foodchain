/**
 * The kit vocabulary.
 *
 * Content authors may only reference kit ids listed here. That constraint is
 * what lets a biome author and a model author work in parallel: the biome
 * says "kit: 'quadruped', palette: [...], props: { snout: 1.3 }" and trusts
 * that a quadruped exists.
 *
 * Adding a kit: implement it in a file under this folder, then register it
 * here. `npm run validate:content` fails on any species pointing at a kit id
 * that nobody has registered.
 */
import type { Kit } from './kit';
import { BUG_KITS } from './kits.bugs';
import { CRITTER_KITS } from './kits.critters';
import { BEAST_KITS } from './kits.beasts';
import { ODDITY_KITS } from './kits.oddities';
import { PROP_KITS } from './kits.props';

const registry = new Map<string, Kit>();

function register(kits: readonly Kit[]): void {
  for (const kit of kits) {
    if (registry.has(kit.id)) throw new Error(`duplicate model kit "${kit.id}"`);
    registry.set(kit.id, kit);
  }
}

register(BUG_KITS);
register(CRITTER_KITS);
register(BEAST_KITS);
register(ODDITY_KITS);
register(PROP_KITS);

export function getKit(id: string): Kit | undefined {
  return registry.get(id);
}

export function kitIds(): string[] {
  return [...registry.keys()].sort();
}

export function allKits(): Kit[] {
  return [...registry.values()];
}

/** Kit ids the content validator accepts. Kept in sync with the registry. */
export const KIT_VOCABULARY = [
  // bugs & crawlers (tier 0-1)
  'grub', 'beetle', 'hopper', 'ant', 'spider', 'moth', 'snail',
  // small critters (tier 1-2)
  'rodent', 'bird', 'frog', 'lizard', 'crab', 'fish', 'bunny',
  // beasts (tier 2-4)
  'quadruped', 'boar', 'serpent', 'raptor', 'bigcat', 'bear', 'croc', 'shark', 'stag',
  // oddities & apexes (tier 4-6)
  'blob', 'jelly', 'squid', 'golem', 'yeti', 'dragon', 'roc',
  // props & scenery
  'prop.house', 'prop.tree', 'prop.rock', 'prop.bush', 'prop.totem', 'prop.king',
] as const;

export type KitId = (typeof KIT_VOCABULARY)[number];
