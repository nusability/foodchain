/**
 * CLI content check. Run with `npm run validate:content`.
 *
 * Content authors (including sub-agents) are expected to run this before
 * handing work back — it catches broken chains, dangling species references
 * and unplayable levels without needing to boot the game.
 */
import { BIOMES } from '../src/content/registry';
import { formatIssues, validateBiomes } from '../src/content/validate';
import { KIT_VOCABULARY } from '../src/render/models/registry';

const result = validateBiomes(BIOMES);

// Model kits are checked here rather than in validate.ts so that the pure
// content layer never has to import anything from the renderer.
const vocabulary = new Set<string>(KIT_VOCABULARY);
const kitIssues: string[] = [];
for (const biome of BIOMES) {
  for (const s of biome.species) {
    if (!vocabulary.has(s.model.kit)) {
      kitIssues.push(`ERROR  ${biome.id}.species.${s.id}.model.kit: unknown kit "${s.model.kit}"`);
    }
  }
  for (const level of biome.levels) {
    for (const prop of level.props ?? []) {
      if (!vocabulary.has(prop.kit)) {
        kitIssues.push(`ERROR  ${biome.id}.levels.${level.id}.props: unknown kit "${prop.kit}"`);
      }
    }
  }
}

console.log(formatIssues(result));
if (kitIssues.length) console.log(kitIssues.join('\n'));

const errorCount = result.errors.length + kitIssues.length;
console.log(
  `\n${BIOMES.length} biome(s), ` +
    `${BIOMES.reduce((n, b) => n + b.species.length, 0)} species, ` +
    `${BIOMES.reduce((n, b) => n + b.levels.length, 0)} levels — ` +
    `${errorCount} error(s), ${result.warnings.length} warning(s)`,
);

process.exit(errorCount > 0 ? 1 : 0);
