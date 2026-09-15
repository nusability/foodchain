/**
 * The model-kit contract.
 *
 * A "kit" is a procedural, parameterised animal builder. Content authors never
 * write geometry — they pick a kit id, hand it a palette and a few props, and
 * the kit returns a rigged group. Everything is built from primitives so there
 * are no assets to download and a new species costs one line of data.
 *
 * Rig convention (this is what the shared animator drives — see animator.ts):
 *
 *   group.userData.parts = {
 *     body,        // the squishable core; scaled for squash & stretch
 *     head,        // bobs and turns
 *     jaw,         // opens when attacking
 *     legs: [],    // swing back and forth while walking
 *     tail,        // wags
 *     eyes,        // blink
 *     accents: [], // free-swinging bits (antennae, ears, fins)
 *   }
 *
 * Only `body` is required; the animator skips anything missing.
 */
import * as THREE from 'three';
import type { ModelSpec } from '@/content/schema';
import { Rng } from '@/core/rng';
import { flat, outline, toon, googlyEyes } from '../style';

export interface KitParts {
  body: THREE.Object3D;
  head?: THREE.Object3D;
  jaw?: THREE.Object3D;
  legs?: THREE.Object3D[];
  tail?: THREE.Object3D;
  eyes?: THREE.Object3D;
  accents?: THREE.Object3D[];
}

export interface KitContext {
  spec: ModelSpec;
  /** Body radius from the species stats — kits size themselves to it. */
  radius: number;
  tier: number;
  rng: Rng;
  /** `spec.palette[i]`, falling back to a sensible default. */
  color(index: number, fallback: string): string;
  /** `spec.props[key]` as a number, with a default. */
  num(key: string, fallback: number): number;
  /** `spec.props[key]` as a boolean, with a default. */
  bool(key: string, fallback: boolean): boolean;
  /** `spec.props[key]` as a string, with a default. */
  str(key: string, fallback: string): string;
}

export type KitBuilder = (ctx: KitContext) => KitParts;

export interface Kit {
  id: string;
  /** One line for the authoring docs. */
  description: string;
  /** Props this kit understands, for the docs and the validator. */
  props?: Record<string, string>;
  build: KitBuilder;
}

export function makeContext(spec: ModelSpec, radius: number, tier: number, seed: string): KitContext {
  const rng = new Rng(seed);
  return {
    spec,
    radius,
    tier,
    rng,
    color: (i, fallback) => spec.palette[i] ?? fallback,
    num: (key, fallback) => {
      const v = spec.props?.[key];
      return typeof v === 'number' ? v : fallback;
    },
    bool: (key, fallback) => {
      const v = spec.props?.[key];
      return typeof v === 'boolean' ? v : fallback;
    },
    str: (key, fallback) => {
      const v = spec.props?.[key];
      return typeof v === 'string' ? v : fallback;
    },
  };
}

// ------------------------------------------------------------- primitives
//
// Shared geometry, cached by shape signature. Building three hundred animals
// per level means never allocating a geometry we have already made.

const geoCache = new Map<string, THREE.BufferGeometry>();

/** Bakes flat per-face normals so toon shading reads as faceted low-poly. */
export function faceted(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = geo.index ? geo.toNonIndexed() : geo;
  out.computeVertexNormals();
  if (out !== geo) geo.dispose();
  return out;
}

function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  const hit = geoCache.get(key);
  if (hit) return hit;
  const geo = faceted(make());
  geoCache.set(key, geo);
  return geo;
}

/** A squashed sphere — the workhorse body shape. Low poly on purpose. */
export function blob(
  radius: number,
  color: string,
  squash = { x: 1, y: 1, z: 1 },
  detail = 1,
): THREE.Mesh {
  const seg = detail > 1 ? 12 : 8;
  const geo = cached(`blob:${seg}`, () => new THREE.SphereGeometry(1, seg, Math.max(5, seg - 2)));
  const mesh = new THREE.Mesh(geo, toon(color));
  mesh.scale.set(radius * squash.x, radius * squash.y, radius * squash.z);
  mesh.castShadow = true;
  return mesh;
}

/** A chunky rounded box. Good for houses, crates, beetles. */
export function chunk(w: number, h: number, d: number, color: string): THREE.Mesh {
  const geo = cached('chunk', () => new THREE.BoxGeometry(1, 1, 1, 1, 1, 1));
  const mesh = new THREE.Mesh(geo, toon(color));
  mesh.scale.set(w, h, d);
  mesh.castShadow = true;
  return mesh;
}

/** A tapered limb or horn. */
export function cone(radius: number, height: number, color: string, segments = 6): THREE.Mesh {
  const geo = cached(`cone:${segments}`, () => new THREE.ConeGeometry(1, 1, segments));
  const mesh = new THREE.Mesh(geo, toon(color));
  mesh.scale.set(radius, height, radius);
  mesh.castShadow = true;
  return mesh;
}

/** A leg, an antenna, a tail segment. */
export function stick(radius: number, length: number, color: string, segments = 5): THREE.Mesh {
  const geo = cached(`stick:${segments}`, () =>
    new THREE.CylinderGeometry(1, 1, 1, segments),
  );
  const mesh = new THREE.Mesh(geo, toon(color));
  mesh.scale.set(radius, length, radius);
  mesh.castShadow = true;
  return mesh;
}

/** A flat card — wings, fins, leaves. Double-sided so it reads from behind. */
export function fin(w: number, h: number, color: string): THREE.Mesh {
  const geo = cached('fin', () => new THREE.PlaneGeometry(1, 1));
  const mat = toon(color).clone();
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.set(w, h, 1);
  return mesh;
}

/**
 * Builds a leg that swings from its top. Returns the pivot, so the animator
 * can rotate it without the leg detaching from the hip.
 */
export function pivotLeg(
  at: { x: number; y: number; z: number },
  radius: number,
  length: number,
  color: string,
  footColor?: string,
): THREE.Group {
  const pivot = new THREE.Group();
  pivot.position.set(at.x, at.y, at.z);
  const limb = stick(radius, length, color);
  limb.position.y = -length / 2;
  pivot.add(limb);
  if (footColor) {
    const foot = blob(radius * 1.5, footColor, { x: 1, y: 0.7, z: 1.4 });
    foot.position.y = -length;
    pivot.add(foot);
  }
  pivot.name = 'leg';
  return pivot;
}

/** Wraps every mesh in the tree with an outline shell. */
export function outlineAll(root: THREE.Object3D, thickness = 0.06): void {
  const meshes: THREE.Mesh[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && !mesh.userData.isOutline) meshes.push(mesh);
  });
  for (const mesh of meshes) outline(mesh, thickness);
}

export { flat, toon, googlyEyes };
