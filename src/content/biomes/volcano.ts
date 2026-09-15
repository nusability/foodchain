/**
 * Cinder Caldera — biome 5, the FINAL biome.
 *
 * Every earlier biome teaches one lesson (meadow: branches cross, jungle:
 * swarms drown you, tundra: heavy hitters hit hard). This biome assumes the
 * player already knows all three and tests them at once, on a chain that
 * runs one tier deeper than they are used to (0-6, not 0-5).
 *
 * SHAPE: two low-tier roots (a crawler and a jumper) fan into three tier-2
 * lines — a shell line, a wing line, and a claw line — which cross hard at
 * tier 3 (the lizard and the serpent each eat prey from *both* other lines,
 * not just their own), cross again at tier 4 (golem/brute), then the two
 * tier-5 apex-candidates (roc, panther) each eat from both tier-4 lines
 * before the dragon eats all four of them. The tree keeps re-merging on
 * purpose: a player who only ever built "the crab line" or "the moth line"
 * gets punished the moment a golem or a dragon turns feral, because nothing
 * in their narrow build order can answer it.
 *
 * THE EXTRA TIER: one more rung than usual means one more feral-cascade step
 * before the top of the chain is even reached — a feral tier-4 doesn't just
 * threaten the house, it out-classes every tier-1/2 guardian still on the
 * field, because guardianFor()'s feralScale climbs with tier and this biome
 * pushes every one of those multipliers higher than the formula default (see
 * the `feralScale` overrides below — roughly +0.3 to +1.1 over baseline by
 * the time you reach the apex). Losing control of a mid-tier guardian here
 * is not a local problem, it's a cascade.
 */
import type { BiomeDef, SpeciesDef } from '../schema';
import { curve, entry, guardianFor, harder, lane, p, stats, wave } from '../helpers';

const species: SpeciesDef[] = [
  // --- tier 0: roots. No guardian block — nothing this small can be planted. ---
  {
    id: 'volcano.ash-grub',
    name: 'Ash Grub',
    tier: 0,
    roles: ['critter'],
    eats: [],
    stats: stats({ hp: 12, speed: 1.6, damage: 2, attackRate: 1.2, radius: 0.3, bounty: 4, mass: 0.4 }),
    model: { kit: 'grub', palette: ['#6b6259', '#3f3934', '#ff7a2e'], scale: 0.7, props: { segments: 4 } },
    flavor: 'Technically already on fire. Does not seem to mind.',
    voice: { pitch: 880, timbre: 'squeak' },
  },
  {
    id: 'volcano.cinder-flea',
    name: 'Cinder Flea',
    tier: 0,
    roles: ['critter'],
    eats: [],
    stats: stats({ hp: 16, speed: 3.2, damage: 3, attackRate: 1.3, radius: 0.3, bounty: 5, mass: 0.4 }),
    model: { kit: 'hopper', palette: ['#d97a3a', '#5a2c14'], scale: 0.75, props: { wings: false } },
    flavor: 'Bounces off the lava. Bounces off everything, honestly.',
    voice: { pitch: 1300, timbre: 'chirp' },
  },

  // --- tier 1: the first answers. Both eat both roots — no wrong first pick. ---
  {
    id: 'volcano.cinder-beetle',
    name: 'Cinder Beetle',
    tier: 1,
    roles: ['critter', 'guardian'],
    eats: ['volcano.ash-grub', 'volcano.cinder-flea'],
    stats: stats({ hp: 42, speed: 1.3, damage: 9, attackRate: 1.1, range: 0.6, radius: 0.45, bounty: 11, mass: 1.6 }),
    guardian: guardianFor(1, { cost: 55, feralScale: 1.6 }),
    model: { kit: 'beetle', palette: ['#3a2e28', '#171310', '#ff8a3c'], props: { horn: 1.1 } },
    flavor: 'Shell doubles as a griddle. Very proud of this.',
    voice: { pitch: 220, timbre: 'growl' },
  },
  {
    id: 'volcano.soot-rat',
    name: 'Soot Rat',
    tier: 1,
    roles: ['critter', 'guardian'],
    eats: ['volcano.ash-grub', 'volcano.cinder-flea'],
    stats: stats({ hp: 34, speed: 3.4, damage: 8, attackRate: 1.6, radius: 0.38, bounty: 10, mass: 0.9 }),
    guardian: guardianFor(1, { cost: 65, hungerRate: 0.032, feralScale: 1.55 }),
    model: { kit: 'rodent', palette: ['#4a4038', '#241d18', '#ff9a4a'], props: { earSize: 1.2, tail: 1.5 } },
    flavor: 'Breeds faster than the mountain can kill it. Nature finds a way.',
    voice: { pitch: 1150, timbre: 'squeak' },
  },

  // --- tier 2: the fan-out. Three lines, deliberately overlapping prey so
  // no single tier-1 pick is a dead end for the player who leans on it. ---
  {
    id: 'volcano.magma-snail',
    name: 'Magma Snail',
    tier: 2,
    roles: ['critter', 'guardian'],
    eats: ['volcano.cinder-beetle', 'volcano.ash-grub'],
    stats: stats({ hp: 95, speed: 0.9, damage: 16, attackRate: 0.8, range: 0.5, radius: 0.6, bounty: 24, mass: 3 }),
    guardian: guardianFor(2, { cost: 130, feralScale: 1.9 }),
    model: { kit: 'snail', palette: ['#ff7a2e', '#241a14', '#0f0a08'], props: { shellTurns: 6 } },
    flavor: 'Leaves a permanent glowing trail. Great for tracking, bad for stealth.',
    voice: { pitch: 130, timbre: 'honk' },
  },
  {
    id: 'volcano.ash-moth',
    name: 'Ash Moth',
    tier: 2,
    roles: ['critter', 'guardian'],
    eats: ['volcano.cinder-flea', 'volcano.soot-rat'],
    stats: stats({ hp: 58, speed: 4.4, damage: 13, attackRate: 1.7, radius: 0.4, bounty: 18, mass: 1 }),
    guardian: guardianFor(2, { cost: 150, placeCooldown: 0.8, feralScale: 1.8 }),
    model: { kit: 'moth', palette: ['#8a7d6e', '#d9c9b0', '#ff5a2e'], props: { wingSpan: 1.3, hover: 1.1 } },
    flavor: 'Drawn to light. Mostly its own.',
    voice: { pitch: 1500, timbre: 'chirp' },
  },
  {
    id: 'volcano.obsidian-crab',
    name: 'Obsidian Crab',
    tier: 2,
    roles: ['critter', 'guardian'],
    eats: ['volcano.soot-rat', 'volcano.cinder-beetle'],
    stats: stats({ hp: 88, speed: 1.5, damage: 18, attackRate: 1, range: 0.7, radius: 0.55, bounty: 22, mass: 2.6 }),
    guardian: guardianFor(2, { cost: 140, feralScale: 1.85 }),
    model: { kit: 'crab', palette: ['#1c1714', '#3a2e26', '#ff6a2e'], props: { clawSize: 1.3 } },
    flavor: 'Its shell was lava twenty minutes ago. It has not processed this.',
    voice: { pitch: 320, timbre: 'growl' },
  },

  // --- tier 3: the first re-merge. Each of these eats from TWO of the three
  // tier-2 lines plus a tier-1 straggler, so a player who fed only the shell
  // line still watches the lizard show up hungry for crab and beetle both. ---
  {
    id: 'volcano.lava-lizard',
    name: 'Lava Lizard',
    tier: 3,
    roles: ['critter', 'guardian'],
    eats: ['volcano.magma-snail', 'volcano.obsidian-crab', 'volcano.cinder-beetle'],
    stats: stats({ hp: 190, speed: 2.6, damage: 34, attackRate: 1.2, range: 1, radius: 0.55, bounty: 48, mass: 2.6 }),
    guardian: guardianFor(3, { cost: 300, feralScale: 2.1 }),
    model: { kit: 'lizard', palette: ['#2b201a', '#ff5a1e', '#f7c948'], props: { frill: 1.2 } },
    flavor: 'Sheds its skin into the nearest fire pit. Efficient.',
    voice: { pitch: 260, timbre: 'growl' },
  },
  {
    id: 'volcano.fire-serpent',
    name: 'Fire Serpent',
    tier: 3,
    roles: ['critter', 'guardian'],
    eats: ['volcano.ash-moth', 'volcano.obsidian-crab', 'volcano.soot-rat'],
    stats: stats({ hp: 175, speed: 2.8, damage: 32, attackRate: 1.3, range: 1.6, radius: 0.5, bounty: 45, mass: 2.4 }),
    guardian: guardianFor(3, { cost: 290, feralScale: 2.15 }),
    model: { kit: 'serpent', palette: ['#3a1210', '#120705', '#ff4400'], props: { segments: 9 } },
    flavor: 'Not actually on fire. The glow is just enthusiasm.',
    voice: { pitch: 300, timbre: 'growl' },
  },

  // --- tier 4: the jungle/tundra mashup starts here — a slow basalt tank
  // and a fast ash-caked brute, each still reaching back to grab a tier-1/2
  // straggler so nothing below them is ever fully "safe" to ignore. ---
  {
    id: 'volcano.rock-golem',
    name: 'Rock Golem',
    tier: 4,
    roles: ['critter', 'guardian'],
    eats: ['volcano.magma-snail', 'volcano.lava-lizard', 'volcano.obsidian-crab'],
    stats: stats({ hp: 420, speed: 1.4, damage: 70, attackRate: 0.8, range: 1, radius: 0.9, bounty: 95, mass: 8 }),
    guardian: guardianFor(4, { cost: 650, satietyPerMeal: 0.25, feralScale: 2.4 }),
    model: { kit: 'golem', palette: ['#4a4038', '#221e19', '#ff7a2e'], scale: 1.15, props: { bulk: 1.4, cracks: 1.2 } },
    flavor: 'Every step is a small earthquake. It has stopped apologising.',
    voice: { pitch: 95, timbre: 'rumble' },
  },
  {
    id: 'volcano.ash-brute',
    name: 'Ash Brute',
    tier: 4,
    roles: ['critter', 'guardian'],
    eats: ['volcano.ash-moth', 'volcano.fire-serpent', 'volcano.soot-rat'],
    stats: stats({ hp: 380, speed: 2, damage: 78, attackRate: 1, range: 1.1, radius: 0.8, bounty: 100, mass: 6 }),
    guardian: guardianFor(4, { cost: 680, feralScale: 2.45 }),
    model: { kit: 'yeti', palette: ['#5c5248', '#2c2620', '#ffb347'], scale: 1.2, props: { bulk: 1.3, fur: 1.2 } },
    flavor: 'It was a glacier once. Adapted. Holds a grudge about it.',
    voice: { pitch: 110, timbre: 'rumble' },
  },

  // --- tier 5: near-apex. Each remerges the other branch's tier-4 pick, so
  // the two branches are functionally one branch by the time you're here. ---
  {
    id: 'volcano.cinder-roc',
    name: 'Cinder Roc',
    tier: 5,
    roles: ['critter', 'guardian'],
    eats: ['volcano.lava-lizard', 'volcano.fire-serpent', 'volcano.rock-golem'],
    stats: stats({ hp: 820, speed: 4.8, damage: 165, attackRate: 1.1, range: 1.4, radius: 0.85, bounty: 210, mass: 4.5 }),
    guardian: guardianFor(5, { cost: 1350, placeCooldown: 1.6, feralScale: 2.8 }),
    model: { kit: 'roc', palette: ['#241a14', '#ff6a2e', '#ffd27a'], scale: 1.2, props: { wingSpan: 1.6 } },
    flavor: 'Carries off livestock, cars, and occasionally the weather.',
    voice: { pitch: 500, timbre: 'chirp' },
  },
  {
    id: 'volcano.magma-panther',
    name: 'Magma Panther',
    tier: 5,
    roles: ['critter', 'guardian'],
    eats: ['volcano.rock-golem', 'volcano.ash-brute', 'volcano.fire-serpent'],
    stats: stats({ hp: 760, speed: 4.2, damage: 175, attackRate: 1.4, range: 0.9, radius: 0.75, bounty: 215, mass: 4 }),
    guardian: guardianFor(5, { cost: 1300, feralScale: 2.85 }),
    model: { kit: 'bigcat', palette: ['#1c1512', '#ff5a1e', '#100b09'], scale: 1.15, props: { stripe: 1, tail: 1.6 } },
    flavor: 'Footprints combust. Pursued strictly not recommended.',
    voice: { pitch: 180, timbre: 'growl' },
  },

  // --- tier 6: the apex. One dragon, eating all four tier-4/5 finalists —
  // the point where every branch this biome built finally collapses into
  // a single, unavoidable answer. Nothing eats it; damage is the answer. ---
  {
    id: 'volcano.dragon',
    name: 'Caldera Dragon',
    tier: 6,
    roles: ['critter', 'guardian'],
    eats: ['volcano.cinder-roc', 'volcano.magma-panther', 'volcano.rock-golem', 'volcano.ash-brute'],
    stats: stats({ hp: 2600, speed: 2.4, damage: 340, attackRate: 0.9, range: 1.8, radius: 1.3, bounty: 650, mass: 14 }),
    guardian: guardianFor(6, { cost: 2800, satietyPerMeal: 0.15, feralScale: 3.2, warnTime: 4 }),
    model: { kit: 'dragon', palette: ['#241014', '#ff3300', '#ffb300', '#0a0507'], scale: 1.5, props: { wingSpan: 1.6, horns: 1.2 } },
    flavor: 'The mountain has a landlord, and this is it.',
    voice: { pitch: 60, timbre: 'rumble' },
  },
];

const HOUSE = p(0, 12);

// Same three lanes reused across all four levels, like the meadow — only the
// arena grows around them. Curves end exactly on HOUSE (sway is 0 at t=1),
// so every lane satisfies the "ends within 3u of the house" rule with room
// to spare even as the arena scales up toward the 34x38 finale cap.
const laneWest = lane('west', curve(p(-11, -15), HOUSE, 3.8, 10), 1);
const laneEast = lane('east', curve(p(11, -15), HOUSE, -3.8, 10), 1);
const laneNorth = lane('north', curve(p(0, -16), HOUSE, 1.8, 8), 1.4);

// --- Level 1 waves: establish the two roots and the three-way tier-2 fan. ---
const w1 = wave([entry('volcano.ash-grub', 12, { spacing: 0.5 })], { reward: 30, rest: 7, title: 'Something is smoking' });
const w2 = wave(
  [entry('volcano.ash-grub', 12, { spacing: 0.4 }), entry('volcano.cinder-flea', 6, { spacing: 0.7, delay: 3 })],
  { reward: 45, rest: 6 },
);
const w3 = wave(
  [entry('volcano.cinder-flea', 14, { spacing: 0.35 }), entry('volcano.cinder-beetle', 4, { spacing: 1.1, delay: 4 })],
  { reward: 65, rest: 6, title: 'Shells glow red-hot' },
);
const w4 = wave(
  [entry('volcano.ash-grub', 22, { spacing: 0.16 }), entry('volcano.soot-rat', 6, { spacing: 0.8, delay: 2 })],
  { reward: 85, rest: 6 },
);
const w5 = wave(
  [
    entry('volcano.cinder-beetle', 8, { spacing: 0.5 }),
    entry('volcano.magma-snail', 3, { spacing: 1.8, delay: 5, lane: 'west' }),
    entry('volcano.ash-moth', 4, { spacing: 1, delay: 7, lane: 'east' }),
  ],
  { reward: 120, rest: 7, title: 'The chain ignites' },
);
const w6 = wave(
  [entry('volcano.soot-rat', 10, { spacing: 0.4 }), entry('volcano.obsidian-crab', 3, { spacing: 2, delay: 6, lane: 'west' })],
  { reward: 140, rest: 7, title: 'Pincers in the ash' },
);
const w7 = wave(
  [
    entry('volcano.ash-grub', 16, { spacing: 0.2 }),
    entry('volcano.cinder-flea', 10, { spacing: 0.3, delay: 2 }),
    entry('volcano.magma-snail', 2, { spacing: 2, delay: 9, lane: 'west' }),
    entry('volcano.ash-moth', 2, { spacing: 2, delay: 9, lane: 'east' }),
  ],
  { reward: 180, rest: 8, title: 'Vents overflow' },
);

// --- Level 2 waves: harder low tiers, plus the tier-3 cross-eaters arrive. ---
const w8 = harder(w4, 1.35, 6);
const w9 = harder(w5, 1.3, 3);
const w10 = wave(
  [entry('volcano.obsidian-crab', 10, { spacing: 0.45 }), entry('volcano.lava-lizard', 2, { spacing: 2.4, delay: 6, lane: 'west' })],
  { reward: 200, rest: 7, title: 'Something crawls out of the slag' },
);
const w11 = wave(
  [entry('volcano.ash-moth', 14, { spacing: 0.3 }), entry('volcano.fire-serpent', 2, { spacing: 2.4, delay: 6, lane: 'east' })],
  { reward: 210, rest: 7, title: 'The lava hisses back' },
);
const w12 = wave(
  [entry('volcano.ash-grub', 26, { spacing: 0.12 }), entry('volcano.cinder-flea', 18, { spacing: 0.14, delay: 2 })],
  { reward: 230, rest: 8, title: 'Mass eruption' },
);
const w13 = wave(
  [
    entry('volcano.cinder-beetle', 10, { spacing: 0.4 }),
    entry('volcano.soot-rat', 10, { spacing: 0.4, delay: 2 }),
    entry('volcano.lava-lizard', 2, { spacing: 2.6, delay: 9, lane: 'west' }),
    entry('volcano.fire-serpent', 2, { spacing: 2.6, delay: 9, lane: 'east' }),
  ],
  { reward: 270, rest: 9, title: 'Both banks boil over' },
);

// --- Level 3 waves: tier-4 heavy hitters, deliberately mixed into swarm
// waves rather than isolated — the jungle-swarm / tundra-tank mashup. ---
const w14 = harder(w10, 1.3, 2);
const w15 = harder(w11, 1.3, 2);
const w16 = wave(
  [entry('volcano.magma-snail', 12, { spacing: 0.35 }), entry('volcano.rock-golem', 2, { spacing: 3, delay: 7, lane: 'west' })],
  { reward: 320, rest: 8, title: 'The ground stands up' },
);
const w17 = wave(
  [entry('volcano.ash-moth', 14, { spacing: 0.3 }), entry('volcano.ash-brute', 2, { spacing: 3, delay: 7, lane: 'east' })],
  { reward: 330, rest: 8, title: 'It was never a snowdrift' },
);
const w18 = wave(
  [entry('volcano.ash-grub', 30, { spacing: 0.1 }), entry('volcano.cinder-flea', 20, { spacing: 0.12, delay: 2 })],
  { reward: 260, rest: 8, title: 'Swarm season' },
);
const w19 = wave(
  [
    entry('volcano.lava-lizard', 6, { spacing: 1.6 }),
    entry('volcano.fire-serpent', 6, { spacing: 1.6, delay: 2 }),
    entry('volcano.rock-golem', 2, { spacing: 3, delay: 10, lane: 'north' }),
  ],
  { reward: 380, rest: 9, title: 'Both jaws close at once' },
);
const w20 = wave(
  [
    entry('volcano.obsidian-crab', 10, { spacing: 0.4 }),
    entry('volcano.soot-rat', 10, { spacing: 0.4, delay: 2 }),
    entry('volcano.ash-brute', 3, { spacing: 2.6, delay: 9, lane: 'west' }),
    entry('volcano.rock-golem', 2, { spacing: 3, delay: 11, lane: 'east' }),
  ],
  { reward: 450, rest: 10, title: 'The Scar answers' },
);

// --- Level 4 (finale) waves. f1-f3 revisit the whole low/mid chain at once
// (the "mix everything" twist), f4-f6 bring in tier-4/5 one at a time so the
// player has time to place counters, f7 is one last full-board swarm, f8 is
// the deliberate "prove you built the top of the chain" gate — an all-heavy
// wave with no chaff to distract weak guardians — and f9 is the dragon,
// escorted so the player cannot simply funnel everything onto one lane. ---
const f1 = wave(
  [
    entry('volcano.ash-grub', 30, { spacing: 0.12 }),
    entry('volcano.cinder-flea', 20, { spacing: 0.14, delay: 2 }),
    entry('volcano.cinder-beetle', 6, { spacing: 0.6, delay: 5 }),
  ],
  { reward: 300, rest: 8, title: 'The mountain wakes' },
);
const f2 = wave(
  [
    entry('volcano.magma-snail', 6, { spacing: 1.2 }),
    entry('volcano.ash-moth', 6, { spacing: 1.2, delay: 2 }),
    entry('volcano.obsidian-crab', 6, { spacing: 1.2, delay: 4 }),
    entry('volcano.lava-lizard', 2, { spacing: 2.4, delay: 8, lane: 'west' }),
    entry('volcano.fire-serpent', 2, { spacing: 2.4, delay: 8, lane: 'east' }),
  ],
  { reward: 420, rest: 8, title: 'Every branch at once' },
);
const f3 = wave([entry('volcano.ash-grub', 40, { spacing: 0.08 })], { reward: 260, rest: 7, title: 'Total swarm' });
const f4 = wave(
  [entry('volcano.rock-golem', 3, { spacing: 3, lane: 'west' }), entry('volcano.ash-brute', 3, { spacing: 3, delay: 2, lane: 'east' })],
  { reward: 520, rest: 9, title: 'Tundra-cold, lava-hot, headed your way' },
);
const f5 = wave(
  [entry('volcano.lava-lizard', 10, { spacing: 0.6 }), entry('volcano.cinder-roc', 2, { spacing: 3.4, delay: 8, lane: 'north' })],
  { reward: 560, rest: 9, title: 'Ash roc, wings of cinder' },
);
const f6 = wave(
  [entry('volcano.fire-serpent', 10, { spacing: 0.6 }), entry('volcano.magma-panther', 2, { spacing: 3.4, delay: 8, lane: 'west' })],
  { reward: 580, rest: 9, title: 'The panther that outran the lava' },
);
const f7 = wave(
  [
    entry('volcano.ash-grub', 20, { spacing: 0.1 }),
    entry('volcano.cinder-flea', 20, { spacing: 0.1, delay: 1 }),
    entry('volcano.cinder-beetle', 8, { spacing: 0.5, delay: 4 }),
    entry('volcano.soot-rat', 8, { spacing: 0.5, delay: 4 }),
    entry('volcano.magma-snail', 4, { spacing: 1.4, delay: 8, lane: 'west' }),
    entry('volcano.ash-moth', 4, { spacing: 1.4, delay: 8, lane: 'east' }),
  ],
  { reward: 500, rest: 10, title: 'Cinder Caldera holds nothing back' },
);
const f8 = wave(
  [
    entry('volcano.rock-golem', 4, { spacing: 2.6, lane: 'west' }),
    entry('volcano.ash-brute', 4, { spacing: 2.6, delay: 3, lane: 'east' }),
    entry('volcano.cinder-roc', 3, { spacing: 3, delay: 7, lane: 'north' }),
    entry('volcano.magma-panther', 3, { spacing: 3, delay: 9, lane: 'west' }),
  ],
  { reward: 900, rest: 12, title: 'Everything you built is coming home' },
);
const f9 = wave(
  [
    entry('volcano.ash-brute', 3, { spacing: 2, lane: 'east' }),
    entry('volcano.cinder-roc', 3, { spacing: 2, delay: 2, lane: 'west' }),
    entry('volcano.dragon', 1, { spacing: 1, delay: 16, lane: 'north', boss: true }),
  ],
  { reward: 2200, rest: 12, title: 'THE CALDERA DRAGON' },
);

export const volcano: BiomeDef = {
  id: 'volcano',
  name: 'Cinder Caldera',
  order: 4,
  blurb: 'Molten, apocalyptic, and extremely proud of both.',
  mapPosition: p(12, -9),
  unlock: { stars: 40 },
  palette: {
    sky: '#2a0e12',
    ground: '#241f1c',
    groundAccent: '#ff6a1f',
    path: '#8c8478',
    fog: '#e08a3c',
    sun: '#ff9a3c',
    rim: '#ff4d2e',
  },
  music: 'volcano',
  ambience: { bed: 'lava', density: 0.65 },
  species,
  levels: [
    {
      id: 'volcano-1',
      name: 'Ashfall Vents',
      arena: { width: 28, depth: 34 },
      house: { position: HOUSE, hp: 400 },
      lanes: [laneWest, laneEast],
      startingCoins: 100,
      starGoals: { houseHp: 0.9, coins: 400, noFeral: true },
      waves: [w1, w2, w3, w4, w5, w6, w7],
      props: [
        { kit: 'prop.rock', position: p(-10, 4), scale: 1.3 },
        { kit: 'prop.rock', position: p(11, 1), scale: 1 },
        { kit: 'prop.tree', position: p(-5, 7), scale: 0.8, rotation: 0.4 },
        { kit: 'prop.bush', position: p(6, 8), scale: 1.1 },
        { kit: 'prop.rock', position: p(3, -3), scale: 1.4 },
      ],
      totems: [{ id: 'coinfall', kind: 'coinfall', position: p(-7, 9) }],
    },
    {
      id: 'volcano-2',
      name: 'The Slag Fields',
      arena: { width: 30, depth: 36 },
      house: { position: HOUSE, hp: 520 },
      lanes: [laneWest, laneEast, laneNorth],
      startingCoins: 150,
      starGoals: { houseHp: 0.85, coins: 760, noFeral: true },
      waves: [w3, w8, w9, w10, w11, w12, w13],
      props: [
        { kit: 'prop.rock', position: p(-12, 0), scale: 1.6 },
        { kit: 'prop.rock', position: p(9, 5), scale: 1.2 },
        { kit: 'prop.tree', position: p(-3, 9), scale: 0.7, rotation: 1 },
      ],
      totems: [
        { id: 'coinfall', kind: 'coinfall', position: p(-8, 9) },
        { id: 'roar', kind: 'roar', position: p(8, 9) },
      ],
    },
    {
      id: 'volcano-3',
      name: 'Obsidian Scar',
      arena: { width: 32, depth: 38 },
      house: { position: HOUSE, hp: 680 },
      lanes: [laneWest, laneEast, laneNorth],
      startingCoins: 220,
      starGoals: { houseHp: 0.8, coins: 1350 },
      waves: [w14, w15, w16, w17, w18, w19, w20],
      props: [
        { kit: 'prop.rock', position: p(-13, 2), scale: 1.7 },
        { kit: 'prop.rock', position: p(13, -2), scale: 1.5 },
        { kit: 'prop.rock', position: p(0, 2), scale: 1.9 },
        { kit: 'prop.bush', position: p(-6, 8) },
        { kit: 'prop.tree', position: p(7, 7), scale: 0.6, rotation: 2 },
      ],
      totems: [
        { id: 'coinfall', kind: 'coinfall', position: p(-9, 9) },
        { id: 'roar', kind: 'roar', position: p(9, 9) },
      ],
    },
    {
      id: 'volcano-4',
      name: 'Cinder Caldera',
      arena: { width: 34, depth: 38 },
      house: { position: HOUSE, hp: 900 },
      lanes: [laneWest, laneEast, laneNorth],
      startingCoins: 320,
      starGoals: { houseHp: 0.75, coins: 3750 },
      waves: [f1, f2, f3, f4, f5, f6, f7, f8, f9],
      props: [
        { kit: 'prop.rock', position: p(-14, 3), scale: 2 },
        { kit: 'prop.rock', position: p(14, -1), scale: 1.8 },
        { kit: 'prop.rock', position: p(0, -5), scale: 2.2 },
        { kit: 'prop.tree', position: p(-6, 8), scale: 0.5, rotation: 1.6 },
        { kit: 'prop.tree', position: p(7, 6), scale: 0.55, rotation: 0.2 },
      ],
      totems: [
        { id: 'coinfall', kind: 'coinfall', position: p(-9, 9) },
        { id: 'roar', kind: 'roar', position: p(9, 9) },
      ],
    },
  ],
};
