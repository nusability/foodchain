import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BIOMES } from '@/content/registry';
import { allKits, getKit, kitIds, KIT_VOCABULARY } from './registry';
import { makeContext, type KitParts } from './kit';

/** Kits that swim or fly and are meant to sit above the ground. */
const FLOATERS = new Set(['moth', 'fish', 'jelly', 'squid', 'roc', 'raptor', 'shark']);

function buildAt(kitId: string, radius: number): { parts: KitParts; box: THREE.Box3; prims: number } {
  const kit = getKit(kitId)!;
  const parts = kit.build(
    makeContext(
      { kit: kitId, palette: ['#cc4466', '#4466cc', '#ffcc44', '#223344'] },
      radius,
      2,
      `test:${kitId}:${radius}`,
    ),
  );
  const root = new THREE.Group();
  root.add(parts.body);
  let prims = 0;
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) prims++;
  });
  return { parts, box: new THREE.Box3().setFromObject(root), prims };
}

describe('model kits', () => {
  it('every id in the vocabulary is implemented', () => {
    const registered = new Set(kitIds());
    const missing = KIT_VOCABULARY.filter((id) => !registered.has(id));
    expect(missing, `unimplemented kits: ${missing.join(', ')}`).toEqual([]);
  });

  it('nothing is registered that the vocabulary does not list', () => {
    const vocabulary = new Set<string>(KIT_VOCABULARY);
    expect(kitIds().filter((id) => !vocabulary.has(id))).toEqual([]);
  });

  it('every kit carries a description for the authoring docs', () => {
    for (const kit of allKits()) expect(kit.description.length).toBeGreaterThan(10);
  });

  for (const kit of allKits()) {
    describe(kit.id, () => {
      it('builds', () => {
        expect(() => buildAt(kit.id, 0.6)).not.toThrow();
      });

      it('returns a rig the animator can drive', () => {
        const { parts } = buildAt(kit.id, 0.6);
        expect(parts.body).toBeInstanceOf(THREE.Object3D);
        for (const leg of parts.legs ?? []) expect(leg).toBeInstanceOf(THREE.Object3D);
        for (const accent of parts.accents ?? []) expect(accent).toBeInstanceOf(THREE.Object3D);
      });

      it('scales with ctx.radius rather than hard-coding sizes', () => {
        const small = buildAt(kit.id, 0.3).box.getSize(new THREE.Vector3()).y;
        const large = buildAt(kit.id, 1.2).box.getSize(new THREE.Vector3()).y;
        expect(large).toBeGreaterThan(small * 2);
      });

      it('stays within the primitive budget', () => {
        const { prims } = buildAt(kit.id, 0.6);
        expect(prims).toBeGreaterThan(1);
        // The dragon is the one deliberate exception — it is the game's apex.
        expect(prims).toBeLessThanOrEqual(kit.id === 'dragon' ? 40 : 32);
      });

      it('stands on the ground plane', () => {
        const { box } = buildAt(kit.id, 0.6);
        expect(box.min.y).toBeGreaterThan(-0.12);
        if (!FLOATERS.has(kit.id)) expect(box.min.y).toBeLessThan(0.3);
      });

      it('is deterministic for a given species seed', () => {
        const a = buildAt(kit.id, 0.6).box;
        const b = buildAt(kit.id, 0.6).box;
        expect(a.min.toArray()).toEqual(b.min.toArray());
        expect(a.max.toArray()).toEqual(b.max.toArray());
      });
    });
  }

  it('builds a model for every shipped species', () => {
    for (const biome of BIOMES) {
      for (const s of biome.species) {
        const kit = getKit(s.model.kit);
        expect(kit, `${s.id} wants kit "${s.model.kit}"`).toBeDefined();
        expect(() =>
          kit!.build(makeContext(s.model, s.stats.radius, s.tier, s.id)),
        ).not.toThrow();
      }
    }
  });
});
