/**
 * Validates a single biome file, without it being registered.
 *
 * Usage: npx tsx tools/validate-biome.ts src/content/biomes/jungle.ts
 *
 * This is what lets several content authors work at once — nobody has to touch
 * the shared registry to check their own work.
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { BiomeDef } from '../src/content/schema';
import { formatIssues, validateBiome } from '../src/content/validate';
import { KIT_VOCABULARY } from '../src/render/models/registry';
import { FoodChain } from '../src/core/foodchain/chain';

const target = process.argv[2];
if (!target) {
  console.error('usage: npx tsx tools/validate-biome.ts <path-to-biome.ts>');
  process.exit(2);
}

const mod: Record<string, unknown> = await import(pathToFileURL(resolve(target)).href);
const biome = Object.values(mod).find(
  (v): v is BiomeDef =>
    !!v && typeof v === 'object' && 'species' in (v as object) && 'levels' in (v as object),
);

if (!biome) {
  console.error(`no BiomeDef exported from ${target}`);
  process.exit(2);
}

const result = validateBiome(biome);
console.log(formatIssues(result));

const vocabulary = new Set<string>(KIT_VOCABULARY);
const kitErrors: string[] = [];
for (const s of biome.species) {
  if (!vocabulary.has(s.model.kit)) {
    kitErrors.push(`ERROR  ${s.id}.model.kit: "${s.model.kit}" is not in KIT_VOCABULARY`);
  }
}
for (const level of biome.levels) {
  for (const prop of level.props ?? []) {
    if (!vocabulary.has(prop.kit)) {
      kitErrors.push(`ERROR  ${level.id}.props: "${prop.kit}" is not in KIT_VOCABULARY`);
    }
  }
}
if (kitErrors.length) console.log(kitErrors.join('\n'));

// A readable picture of the chain is worth more than any single check.
try {
  const chain = new FoodChain(biome.species);
  console.log('\nfood chain');
  for (const [tier, group] of chain.byTier().entries()) {
    if (group.length === 0) continue;
    const line = group
      .map((s) => {
        const roles = s.roles.includes('guardian') ? '*' : ' ';
        const preds = chain.predatorsOf(s.id).length;
        return `${s.name}${roles}(eats ${s.eats.length}, eaten by ${preds})`;
      })
      .join('   ');
    console.log(`  tier ${tier}: ${line}`);
  }
  console.log('  * = placeable guardian');
} catch (e) {
  console.log(`\nchain could not be built: ${(e as Error).message}`);
}

const waves = biome.levels.reduce((n, l) => n + l.waves.length, 0);
const critters = biome.levels.reduce(
  (n, l) => n + l.waves.reduce((m, w) => m + w.entries.reduce((k, e) => k + e.count, 0), 0),
  0,
);
console.log(
  `\n${biome.species.length} species, ${biome.levels.length} levels, ${waves} waves, ` +
    `${critters} critters spawned in total — ` +
    `${result.errors.length + kitErrors.length} error(s), ${result.warnings.length} warning(s)`,
);

process.exit(result.errors.length + kitErrors.length > 0 ? 1 : 0);
