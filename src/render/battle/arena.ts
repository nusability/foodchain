/**
 * The battlefield itself: ground, lanes, scenery, house, lighting.
 *
 * Built once per level from the biome palette and the level's lane geometry.
 * Everything here is static — the moving parts live in BattleScene.
 */
import * as THREE from 'three';
import type { BiomeDef, LevelDef } from '@/content/schema';
import { pathLength, pointAtDistance, towards } from '@/core/math';
import { Rng } from '@/core/rng';
import { makeContext, outlineAll } from '../models/kit';
import { getKit } from '../models/registry';
import { toon } from '../style';

export interface Arena {
  root: THREE.Group;
  house: THREE.Object3D;
  /** Shakes the house when something bites it. */
  shake(strength: number): void;
  update(dt: number): void;
  dispose(): void;
}

/** A lane drawn as a flat ribbon of quads following the polyline. */
function laneRibbon(
  points: readonly { x: number; z: number }[],
  width: number,
  color: string,
): THREE.Mesh {
  const length = pathLength(points);
  const steps = Math.max(8, Math.ceil(length * 1.5));
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= steps; i++) {
    const d = (i / steps) * length;
    const here = pointAtDistance(points, d);
    const ahead = pointAtDistance(points, Math.min(length, d + 0.35));
    const behind = pointAtDistance(points, Math.max(0, d - 0.35));
    const dir = towards(behind, ahead);
    // Taper the ends so a lane fades into the ground rather than stopping dead.
    const t = i / steps;
    const taper = Math.min(1, Math.min(t, 1 - t) * 8 + 0.35);
    const w = (width * taper) / 2;
    positions.push(here.x - dir.z * w, LANE_Y, here.z + dir.x * w);
    positions.push(here.x + dir.z * w, LANE_Y, here.z - dir.x * w);
    if (i < steps) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  // A lane's winding depends on which way its polyline runs, so half of them
  // would face the ground and vanish. Double-siding is cheaper than deriving
  // the winding per lane, and the material is cloned so the shared toon cache
  // is not affected.
  const material = toon(color).clone();
  material.side = THREE.DoubleSide;

  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  // Rendered before the creatures and biased off the ground plane so it never
  // z-fights with it.
  mesh.renderOrder = -2;
  return mesh;
}

/** Just clear of the ground plane — enough to beat depth precision at range. */
const LANE_Y = 0.06;

/** Scattered grass/coral/ash tufts, instanced so hundreds of them are free. */
function groundDetail(level: LevelDef, palette: BiomeDef['palette'], rng: Rng): THREE.InstancedMesh {
  const count = 420;
  const geo = new THREE.ConeGeometry(0.11, 0.55, 4);
  geo.translate(0, 0.27, 0);
  const mesh = new THREE.InstancedMesh(geo, toon(palette.groundAccent), count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const halfW = level.arena.width / 2;
  const halfD = level.arena.depth / 2;
  for (let i = 0; i < count; i++) {
    pos.set(rng.float(-halfW, halfW), 0, rng.float(-halfD, halfD));
    q.setFromAxisAngle(up, rng.float(0, Math.PI * 2));
    const s = rng.float(0.6, 1.6);
    scale.set(s, rng.float(0.7, 1.8), s);
    m.compose(pos, q, scale);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildProp(
  kitId: string,
  radius: number,
  palette: string[],
  seed: string,
): THREE.Object3D | null {
  const kit = getKit(kitId);
  if (!kit) return null;
  const ctx = makeContext({ kit: kitId, palette }, radius, 0, seed);
  const group = new THREE.Group();
  group.add(kit.build(ctx).body);
  return group;
}

export function buildArena(biome: BiomeDef, level: LevelDef, seed = 1): Arena {
  const root = new THREE.Group();
  const rng = new Rng(`${biome.id}/${level.id}/${seed}`);
  const palette = biome.palette;

  // Ground, cut larger than the arena so the edge never shows on screen.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(level.arena.width + 16, level.arena.depth + 16),
    toon(palette.ground),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);
  root.add(groundDetail(level, palette, rng.fork('detail')));

  for (const lane of level.lanes) root.add(laneRibbon(lane.points, 2.6, palette.path));

  for (const [i, prop] of (level.props ?? []).entries()) {
    const obj = buildProp(
      prop.kit,
      1.1 * (prop.scale ?? 1),
      [palette.groundAccent, palette.ground, palette.path, palette.rim],
      `${level.id}/prop${i}`,
    );
    if (!obj) continue;
    obj.position.set(prop.position.x, 0, prop.position.z);
    obj.rotation.y = prop.rotation ?? rng.float(0, Math.PI * 2);
    outlineAll(obj, 0.04);
    root.add(obj);
  }

  // Totems — the king walks onto these instead of opening a menu.
  for (const totem of level.totems ?? []) {
    const obj = buildProp(
      'prop.totem',
      0.9,
      ['#c8a86a', '#8a6a3a', '#5a4428', palette.rim],
      `${level.id}/${totem.id}`,
    );
    if (obj) {
      obj.position.set(totem.position.x, 0, totem.position.z);
      obj.name = `totem:${totem.id}`;
      outlineAll(obj, 0.045);
      root.add(obj);
    }
    // A ring on the ground shows the trigger radius without any UI at all.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.3, 1.7, 24),
      new THREE.MeshBasicMaterial({ color: palette.rim, transparent: true, opacity: 0.45 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(totem.position.x, 0.04, totem.position.z);
    root.add(ring);
  }

  const houseGroup = new THREE.Group();
  const house = buildProp(
    'prop.house',
    1.15,
    ['#e8d5b0', '#c2452e', '#8a5a36', '#6a8fc4'],
    `${level.id}/house`,
  );
  if (house) {
    outlineAll(house, 0.035);
    houseGroup.add(house);
  }
  houseGroup.position.set(level.house.position.x, 0, level.house.position.z);
  root.add(houseGroup);

  // Lighting, tinted by the biome so each one reads differently at a glance.
  root.add(
    new THREE.HemisphereLight(new THREE.Color(palette.sky), new THREE.Color(palette.ground), 1.15),
  );

  const sun = new THREE.DirectionalLight(new THREE.Color(palette.sun), 1.5);
  sun.position.set(-12, 22, -8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const shadowCam = sun.shadow.camera;
  shadowCam.left = -level.arena.width * 0.7;
  shadowCam.right = level.arena.width * 0.7;
  shadowCam.top = level.arena.depth * 0.7;
  shadowCam.bottom = -level.arena.depth * 0.7;
  shadowCam.near = 1;
  shadowCam.far = 70;
  sun.shadow.bias = -0.0015;
  root.add(sun, sun.target);

  // A cool rim light from behind keeps silhouettes from going flat.
  const rim = new THREE.DirectionalLight(new THREE.Color(palette.rim), 0.55);
  rim.position.set(10, 8, 14);
  root.add(rim);

  let shakeAmount = 0;
  let shakeTime = 0;

  return {
    root,
    house: houseGroup,
    shake(strength: number) {
      shakeAmount = Math.min(0.5, shakeAmount + strength);
    },
    update(dt: number) {
      shakeTime += dt;
      shakeAmount = Math.max(0, shakeAmount - dt * 1.6);
      if (shakeAmount > 0.001) {
        houseGroup.position.x = level.house.position.x + Math.sin(shakeTime * 47) * shakeAmount * 0.4;
        houseGroup.position.y = Math.abs(Math.sin(shakeTime * 39)) * shakeAmount * 0.2;
        houseGroup.rotation.z = Math.sin(shakeTime * 53) * shakeAmount * 0.12;
      } else {
        houseGroup.position.set(level.house.position.x, 0, level.house.position.z);
        houseGroup.rotation.z = 0;
      }
    },
    dispose() {
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry && !mesh.userData.isOutline) mesh.geometry.dispose();
      });
      root.removeFromParent();
    },
  };
}
