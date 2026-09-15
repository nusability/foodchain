/**
 * The world map.
 *
 * Also menu-free: each biome is an island the king physically walks to, and
 * stepping onto one enters it. Settings and the store are two more islands, so
 * the same "walk somewhere, something happens" grammar covers the whole game.
 */
import * as THREE from 'three';
import type { BiomeDef } from '@/content/schema';
import { clamp, damp, dist, type Vec2 } from '@/core/math';
import { Rng } from '@/core/rng';
import type { SaveData } from '@/core/meta/save';
import {
  isBiomeUnlocked,
  maxStarsInBiome,
  starsInBiome,
  totalStars,
} from '@/core/meta/progression';
import type { AudioEngine } from '@/audio/engine';
import { makeContext, outlineAll, blob, cone } from '../models/kit';
import { getKit } from '../models/registry';
import { toon, flat } from '../style';
import { FloaterField } from '../fx/floaters';
import { createFxFields, type ParticleField } from '../fx/particles';
import { King } from '../battle/king';

/** Top surface of an island disc — see buildIsland. */
const ISLAND_TOP = 0.28;

export type WorldTarget =
  | { kind: 'biome'; biome: BiomeDef }
  | { kind: 'store' }
  | { kind: 'settings' };

interface Island {
  target: WorldTarget;
  position: Vec2;
  group: THREE.Group;
  label: string;
  locked: boolean;
  bob: number;
  stars: THREE.Object3D[];
}

export interface WorldMapOptions {
  biomes: readonly BiomeDef[];
  save: SaveData;
  audio: AudioEngine;
  onEnter: (target: WorldTarget) => void;
}

/**
 * Where each biome's island sits.
 *
 * Biomes are authored independently, so their `mapPosition` hints routinely
 * collide — five authors cannot coordinate a layout they cannot each see. The
 * world map therefore treats `mapPosition` as a *nudge* and lays the islands
 * out along a serpentine route by `order`, which guarantees legible spacing
 * and reads as a journey from the first biome to the last.
 */
const ISLAND_SPACING = 14;
/** How far up the route the camera looks past the king. */
const ROUTE_LOOKAHEAD = 7;
const SERPENTINE_SWING = 6.5;

function archipelagoLayout(ordered: readonly BiomeDef[]): Map<string, Vec2> {
  const out = new Map<string, Vec2>();
  for (const [i, biome] of ordered.entries()) {
    const swing = (i % 2 === 0 ? -1 : 1) * SERPENTINE_SWING;
    // The authored hint still tilts the island a little off the rail, so each
    // map keeps some of its author's character without overlapping.
    const nudgeX = clamp(biome.mapPosition.x * 0.18, -4, 4);
    const nudgeZ = clamp(biome.mapPosition.z * 0.18, -4, 4);
    out.set(biome.id, {
      x: swing + nudgeX,
      z: -i * ISLAND_SPACING + nudgeZ,
    });
  }
  return out;
}

/** A floating chunk of land in the biome's own colours. */
function buildIsland(biome: BiomeDef | null, radius: number, seed: string): THREE.Group {
  const group = new THREE.Group();
  const rng = new Rng(seed);
  const top = biome?.palette.ground ?? '#b9a6d6';
  const side = biome?.palette.groundAccent ?? '#8a75b0';

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.82, 0.55, 12), toon(top));
  disc.castShadow = true;
  disc.receiveShadow = true;
  group.add(disc);

  // A ragged underside sells "floating island" far better than a flat disc.
  const under = cone(radius * 0.8, radius * 1.5, side, 7);
  under.rotation.x = Math.PI;
  under.position.y = -radius * 0.85;
  group.add(under);

  // A few landmarks so each island reads as its biome from across the map.
  const propKit = biome ? ['prop.tree', 'prop.rock', 'prop.bush'] : ['prop.totem'];
  for (let i = 0; i < 4; i++) {
    const kitId = propKit[i % propKit.length];
    const kit = getKit(kitId);
    if (!kit) continue;
    const parts = kit.build(
      makeContext(
        { kit: kitId, palette: [side, top, biome?.palette.path ?? '#cfc0e8', biome?.palette.rim ?? '#ffd9a0'] },
        radius * 0.28,
        0,
        `${seed}/${i}`,
      ),
    );
    const angle = rng.float(0, Math.PI * 2);
    const r = rng.float(0.2, 0.62) * radius;
    parts.body.position.set(Math.cos(angle) * r, 0.28, Math.sin(angle) * r);
    parts.body.rotation.y = rng.float(0, Math.PI * 2);
    group.add(parts.body);
  }

  outlineAll(group, 0.03);
  return group;
}

function buildStar(filled: boolean): THREE.Mesh {
  const shape = new THREE.Shape();
  const outer = 0.34;
  const inner = 0.15;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
  geo.center();
  return new THREE.Mesh(geo, flat(filled ? '#ffd23f' : '#5a5468'));
}

export class WorldMapScene {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;

  private readonly islands: Island[] = [];
  private readonly stones: THREE.Mesh[] = [];
  private readonly king: King;
  private readonly floaters: FloaterField;
  private readonly fx: { coins: ParticleField; puffs: ParticleField; sparks: ParticleField };
  private readonly audio: AudioEngine;
  private readonly onEnter: WorldMapOptions['onEnter'];
  private readonly cameraTarget = new THREE.Vector3();
  private time = 0;

  private centre: Vec2 = { x: 0, z: 0 };
  private walkingTo: Island | null = null;
  /** The overview framing holds until the player commits to a destination. */
  private hasInteracted = false;
  private distance = 26;

  constructor(opts: WorldMapOptions) {
    this.audio = opts.audio;
    this.onEnter = opts.onEnter;

    this.scene.background = new THREE.Color('#7fc4e8');
    this.scene.fog = new THREE.Fog(new THREE.Color('#bfe6f7'), 90, 320);

    this.scene.add(new THREE.HemisphereLight(0xcfeaff, 0x6a5d8a, 1.2));
    const sun = new THREE.DirectionalLight(0xfff3d0, 1.4);
    sun.position.set(-10, 24, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const cam = sun.shadow.camera;
    cam.left = -30; cam.right = 30; cam.top = 30; cam.bottom = -30; cam.far = 80;
    this.scene.add(sun, sun.target);

    // The sea: a big soft disc the islands hover over.
    const sea = new THREE.Mesh(new THREE.CircleGeometry(260, 48), toon('#4fa3d9'));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -7;
    this.scene.add(sea);

    const stars = totalStars(opts.save);
    const ordered = [...opts.biomes].sort((a, b) => a.order - b.order);
    const layout = archipelagoLayout(ordered);

    for (const biome of ordered) {
      const unlocked = isBiomeUnlocked(opts.save, biome);
      // Locked islands still show their own biome — the player should want to
      // go there. The lock is the dome over the top, not a grey box.
      const group = buildIsland(biome, 5.2, `island/${biome.id}`);
      const at = layout.get(biome.id)!;
      group.position.set(at.x, 0, at.z);
      this.scene.add(group);

      const island: Island = {
        target: { kind: 'biome', biome },
        position: { ...at },
        group,
        label: unlocked ? biome.name : `${biome.unlock.stars} stars`,
        locked: !unlocked,
        bob: Math.random() * Math.PI * 2,
        stars: [],
      };

      // Star rating floats over the island — the only "HUD" on the map.
      const earned = starsInBiome(opts.save, biome);
      const possible = maxStarsInBiome(biome);
      const shown = Math.min(5, Math.max(3, Math.round(possible / biome.levels.length)));
      const filled = Math.round((earned / Math.max(1, possible)) * shown);
      for (let i = 0; i < shown; i++) {
        const star = buildStar(i < filled);
        star.position.set((i - (shown - 1) / 2) * 0.78, 5.2, 0);
        group.add(star);
        island.stars.push(star);
      }

      if (!unlocked) {
        // A padlock cage rather than a greyed-out button.
        const dome = blob(5.4, '#1d1730', { x: 1, y: 0.5, z: 1 });
        dome.position.y = 0.9;
        const domeMat = (dome.material as THREE.MeshToonMaterial).clone();
        domeMat.transparent = true;
        domeMat.opacity = 0.5;
        domeMat.depthWrite = false;
        dome.material = domeMat;
        group.add(dome);
      }

      this.islands.push(island);
    }

    // Store and settings islands, tucked behind the starting biome.
    const lastOrder = Math.max(...[...layout.values()].map((v) => v.z), 0);
    for (const [i, extra] of (
      [
        { kind: 'store', label: 'Royal Store', at: { x: -14, z: lastOrder + 10 } },
        { kind: 'settings', label: 'Settings', at: { x: 14, z: lastOrder + 10 } },
      ] as const
    ).entries()) {
      const group = buildIsland(null, 3.6, `island/${extra.kind}`);
      group.position.set(extra.at.x, 0, extra.at.z);
      this.scene.add(group);
      this.islands.push({
        target: { kind: extra.kind },
        position: { ...extra.at },
        group,
        label: extra.label,
        locked: false,
        bob: i * 1.3,
        stars: [],
      });
    }

    // Stepping stones between consecutive biomes. Without these the map is
    // just islands in an empty sea and the player has no sense of a path.
    const route = this.islands.filter((i) => i.target.kind === 'biome');
    for (let i = 1; i < route.length; i++) {
      const from = route[i - 1].position;
      const to = route[i].position;
      const steps = 4;
      for (let s2 = 1; s2 < steps; s2++) {
        const t = s2 / steps;
        const stone = new THREE.Mesh(
          new THREE.CylinderGeometry(0.62, 0.5, 0.3, 7),
          toon(route[i].locked ? '#7a6f96' : '#cfc0e8'),
        );
        stone.position.set(
          from.x + (to.x - from.x) * t,
          -0.1,
          from.z + (to.z - from.z) * t,
        );
        stone.userData.bob = i * 1.1 + s2 * 0.6;
        outlineAll(stone, 0.05);
        this.scene.add(stone);
        this.stones.push(stone);
      }
    }

    this.floaters = new FloaterField(this.scene, 12);
    this.fx = createFxFields(this.scene);

    const start = this.islands[0]?.position ?? { x: 0, z: 0 };
    // ISLAND_TOP is the y of a 0.55-tall disc centred on 0, so he walks on the
    // surface rather than through it.
    this.king = new King(
      this.scene,
      { x: start.x, z: start.z + 2 },
      ['#f2d3c1', '#4a5ec8', '#ffd23f', '#c2452e'],
      ISLAND_TOP,
    );

    // The camera sits over the king and looks a little way up the route, so
    // the next two islands are always on screen. Fitting the whole chain would
    // render every island as a speck on a phone.
    this.centre = { x: start.x, z: start.z - ROUTE_LOOKAHEAD };

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 420);
    this.cameraTarget.set(this.centre.x, 0, this.centre.z);
    this.camera.position.set(
      this.centre.x,
      this.distance,
      this.centre.z + this.distance * 0.7,
    );
    this.camera.lookAt(this.cameraTarget);

    this.floaters.spawn(`${stars} stars`, start.x, 7, start.z, 'coin', 3);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    const portraitPull = clamp(height / Math.max(1, width), 1, 2.2);
    this.distance = 24 + portraitPull * 7;
    this.camera.updateProjectionMatrix();
  }

  tapAt(point: Vec2): void {
    this.hasInteracted = true;
    // Snap to the nearest island so a sloppy thumb still works.
    let best: Island | null = null;
    let bestD = 7;
    for (const island of this.islands) {
      const d = dist(point, island.position);
      if (d < bestD) {
        bestD = d;
        best = island;
      }
    }
    if (best) {
      if (best.locked) {
        this.floaters.spawn(best.label, best.position.x, 6, best.position.z, 'alert', 1.6);
        this.audio.tap(false);
        return;
      }
      this.walkingTo = best;
      // Stand just shy of the middle, so he is clearly on the island.
      this.king.walkTo({ x: best.position.x, z: best.position.z + 2 });
    } else {
      this.walkingTo = null;
      this.king.walkTo(point);
    }
    this.audio.tap(true);
  }

  update(dt: number): void {
    this.time += dt;

    for (const island of this.islands) {
      island.bob += dt;
      island.group.position.y = Math.sin(island.bob * 0.8) * 0.35;
      island.group.rotation.y += dt * 0.06;
      for (const [i, star] of island.stars.entries()) {
        star.rotation.y = Math.sin(this.time * 1.6 + i) * 0.5;
        star.position.y = 5.2 + Math.sin(this.time * 2 + i * 0.7) * 0.12;
      }
    }

    for (const stone of this.stones) {
      stone.position.y = -0.1 + Math.sin(this.time * 0.9 + (stone.userData.bob as number)) * 0.18;
    }

    this.king.update(dt, () => {
      const target = this.walkingTo;
      this.walkingTo = null;
      if (!target) return;
      this.floaters.spawn(target.label, target.position.x, 6.2, target.position.z, 'banner', 1.4);
      this.fx.puffs.burst(this.king.position.x, 0.5, this.king.position.z, 14, {
        speed: 4,
        up: 3,
        life: 0.6,
        curve: 'pop',
      });
      this.audio.fanfare(false);
      this.onEnter(target.target);
    });

    this.fx.coins.update(dt);
    this.fx.puffs.update(dt);
    this.fx.sparks.update(dt);
    this.floaters.update(dt);

    // Hold the archipelago overview until the player picks somewhere to go,
    // then ride along behind the king.
    const focusX = this.hasInteracted ? this.king.position.x : this.centre.x;
    const focusZ = (this.hasInteracted ? this.king.position.z : this.centre.z + ROUTE_LOOKAHEAD)
      - ROUTE_LOOKAHEAD;
    const height = this.distance;

    this.cameraTarget.x = damp(this.cameraTarget.x, focusX, 2.2, dt);
    this.cameraTarget.z = damp(this.cameraTarget.z, focusZ, 2.2, dt);
    this.camera.position.set(
      damp(this.camera.position.x, this.cameraTarget.x, 2.2, dt),
      damp(this.camera.position.y, height, 2.2, dt),
      damp(this.camera.position.z, this.cameraTarget.z + height * 0.7, 2.2, dt),
    );
    this.camera.lookAt(this.cameraTarget);
  }

  pickGround(ndcX: number, ndcY: number, raycaster: THREE.Raycaster): Vec2 | null {
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x, z: hit.z };
  }

  dispose(): void {
    this.floaters.clear();
    this.scene.clear();
  }
}
