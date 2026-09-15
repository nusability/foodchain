/**
 * Builds every registered model kit headlessly and reports on it.
 *
 * Usage: npx tsx tools/check-kits.ts [kitId ...]
 *
 * three.js builds geometry fine without a DOM, so this catches the things that
 * actually go wrong in kits: missing rig parts, creatures that ignore
 * `ctx.radius`, runaway primitive counts, and models that float or sink.
 */
import * as THREE from 'three';
import { allKits, KIT_VOCABULARY } from '../src/render/models/registry';
import { makeContext } from '../src/render/models/kit';

const wanted = new Set(process.argv.slice(2));
const kits = allKits().filter((k) => wanted.size === 0 || wanted.has(k.id));

let failures = 0;
const RADII = [0.3, 0.6, 1.2];

console.log(`checking ${kits.length} kit(s)\n`);

for (const kit of kits) {
  const rows: string[] = [];
  const sizes: number[] = [];
  let primitives = 0;
  let parts: string[] = [];
  let failed = false;

  for (const radius of RADII) {
    let built;
    try {
      const ctx = makeContext(
        { kit: kit.id, palette: ['#cc4466', '#4466cc', '#ffcc44', '#223344'] },
        radius,
        2,
        `check:${kit.id}:${radius}`,
      );
      built = kit.build(ctx);
    } catch (e) {
      console.log(`FAIL  ${kit.id} @ r=${radius}: ${(e as Error).message}`);
      failures++;
      failed = true;
      break;
    }

    const root = new THREE.Group();
    root.add(built.body);
    let count = 0;
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) count++;
    });
    primitives = count;

    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    sizes.push(size.y);

    parts = [
      'body',
      built.head ? 'head' : '',
      built.jaw ? 'jaw' : '',
      built.legs?.length ? `legs(${built.legs.length})` : '',
      built.tail ? 'tail' : '',
      built.eyes ? 'eyes' : '',
      built.accents?.length ? `accents(${built.accents.length})` : '',
    ].filter(Boolean);

    if (radius === RADII[1]) {
      rows.push(
        `      size ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}  ` +
          `floor y=${box.min.y.toFixed(2)}`,
      );
      if (box.min.y < -0.05 * radius - 0.02) {
        rows.push(`      WARN  sinks below the ground plane (y=${box.min.y.toFixed(2)})`);
      }
      if (box.min.y > 0.4 * radius) {
        rows.push(`      WARN  floats above the ground plane (y=${box.min.y.toFixed(2)})`);
      }
    }
  }

  if (failed) continue;

  // A kit that ignores ctx.radius produces the same size at every radius.
  const scalesWithRadius =
    sizes.length === RADII.length && sizes[2] > sizes[0] * 2 && sizes[1] > sizes[0] * 1.3;
  if (!scalesWithRadius) {
    rows.push(
      `      FAIL  does not scale with ctx.radius (heights ${sizes.map((s) => s.toFixed(2)).join(', ')})`,
    );
    failures++;
  }
  if (primitives > 40) {
    rows.push(`      WARN  ${primitives} primitives is over the 25-ish budget`);
  }
  if (primitives < 2) {
    rows.push(`      FAIL  only ${primitives} primitive(s) — that is not a creature`);
    failures++;
  }

  console.log(`  ${kit.id.padEnd(14)} ${String(primitives).padStart(3)} prims   ${parts.join(' ')}`);
  for (const row of rows) console.log(row);
}

const registered = new Set(allKits().map((k) => k.id));
const missing = KIT_VOCABULARY.filter((id) => !registered.has(id));
if (missing.length && wanted.size === 0) {
  console.log(`\n${missing.length} kit(s) in KIT_VOCABULARY not yet implemented:\n  ${missing.join(', ')}`);
}

console.log(`\n${failures} failure(s)`);
process.exit(failures > 0 ? 1 : 0);
