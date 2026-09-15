/**
 * The comic look, in one place.
 *
 * Everything is flat-shaded, banded-toon lit and wrapped in an inverted-hull
 * outline. Materials are cached and shared aggressively — a phone rendering
 * three hundred animals cannot afford a material per body part.
 */
import * as THREE from 'three';

const toonMaterials = new Map<string, THREE.MeshToonMaterial>();
const basicMaterials = new Map<string, THREE.MeshBasicMaterial>();
let gradientMap: THREE.DataTexture | null = null;

/** Three hard bands — the classic cel-shading ramp. */
function toonRamp(): THREE.DataTexture {
  if (gradientMap) return gradientMap;
  const steps = new Uint8Array([90, 160, 225, 255]);
  const tex = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
  tex.needsUpdate = true;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  gradientMap = tex;
  return tex;
}

export function toon(color: THREE.ColorRepresentation, opts: { emissive?: number } = {}): THREE.MeshToonMaterial {
  const key = `${new THREE.Color(color).getHexString()}|${opts.emissive ?? 0}`;
  const cached = toonMaterials.get(key);
  if (cached) return cached;
  const mat = new THREE.MeshToonMaterial({
    color,
    gradientMap: toonRamp(),
  });
  // MeshToonMaterial has no flatShading flag; the faceted look comes from
  // baking flat normals into the geometry instead (see models/kit.ts).
  if (opts.emissive) {
    mat.emissive = new THREE.Color(color).multiplyScalar(opts.emissive);
  }
  toonMaterials.set(key, mat);
  return mat;
}

export function flat(color: THREE.ColorRepresentation): THREE.MeshBasicMaterial {
  const key = new THREE.Color(color).getHexString();
  const cached = basicMaterials.get(key);
  if (cached) return cached;
  const mat = new THREE.MeshBasicMaterial({ color });
  basicMaterials.set(key, mat);
  return mat;
}

const OUTLINE_MATERIAL = new THREE.MeshBasicMaterial({
  color: 0x1a1526,
  side: THREE.BackSide,
});

/**
 * Inverted-hull outline. Cheap, reads well at phone size, and — crucially —
 * survives squash-and-stretch because it is a child of the mesh it outlines.
 */
export function outline(mesh: THREE.Mesh, thickness = 0.06): THREE.Mesh {
  const shell = new THREE.Mesh(mesh.geometry, OUTLINE_MATERIAL);
  const s = 1 + thickness;
  shell.scale.set(s, s, s);
  shell.renderOrder = -1;
  shell.userData.isOutline = true;
  mesh.add(shell);
  return shell;
}

/** Two googly eyes, because every animal in this game has googly eyes. */
export function googlyEyes(
  radius: number,
  spacing: number,
  forward: number,
  height: number,
): THREE.Group {
  const group = new THREE.Group();
  const whiteGeo = new THREE.SphereGeometry(radius, 10, 8);
  const pupilGeo = new THREE.SphereGeometry(radius * 0.45, 8, 6);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(whiteGeo, flat('#fffdf5'));
    eye.position.set(side * spacing, height, forward);
    const pupil = new THREE.Mesh(pupilGeo, flat('#1a1526'));
    pupil.position.set(0, 0, radius * 0.72);
    pupil.name = 'pupil';
    eye.add(pupil);
    eye.name = 'eye';
    group.add(eye);
  }
  group.name = 'eyes';
  return group;
}

export function disposeTree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry && !mesh.userData.isOutline) mesh.geometry.dispose();
  });
}
