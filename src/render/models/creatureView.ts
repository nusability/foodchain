/**
 * A built creature plus the animation that makes it feel alive.
 *
 * Kits describe *shape*; this describes *motion*. Every kit returns the same
 * named rig (body/head/jaw/legs/tail/eyes/accents), so one animator drives all
 * of them — which is why adding a species costs one line of data and no
 * animation work at all.
 *
 * The squash-and-stretch here is the whole "squishy and satisfying" pillar:
 * everything overshoots, nothing moves linearly, and every hit pops.
 */
import * as THREE from 'three';
import type { SpeciesDef } from '@/content/schema';
import { clamp01, damp } from '@/core/math';
import { makeContext, outlineAll, type KitParts } from './kit';
import { getKit } from './registry';

export interface CreatureState {
  moving: boolean;
  attacking: boolean;
  /** 0..1 impulse, set by the sim on hits and decayed here. */
  squish: number;
  /** 1 = stuffed, 0 = about to turn feral. */
  satiety: number;
  feral: boolean;
  facing: number;
  /** Extra uniform scale, e.g. bosses. */
  scale: number;
}

/**
 * Purely cosmetic size bump. The simulation sizes bodies from `stats.radius`
 * for packing and reach; on a phone those numbers read a touch too small, and
 * scaling here rather than in the stats keeps balance untouched.
 */
const VISUAL_SCALE = 1.25;

const FERAL_EYE = new THREE.Color('#ff3b30');
const WARN_EYE = new THREE.Color('#ffb02e');
const CALM_EYE = new THREE.Color('#fffdf5');

export class CreatureView {
  readonly group = new THREE.Group();
  readonly parts: KitParts;
  private readonly baseBodyScale = new THREE.Vector3();
  private readonly legPhaseOffsets: number[] = [];
  private readonly accentPhase: number[] = [];
  private phase = Math.random() * Math.PI * 2;
  private squish = 0;
  private blink = Math.random() * 4;
  private renderedFacing = 0;
  private jawOpen = 0;
  private lastAttack = 0;
  private time = 0;
  private eyeMaterials: THREE.MeshBasicMaterial[] = [];

  constructor(species: SpeciesDef, seedSuffix = '') {
    const kit = getKit(species.model.kit);
    if (!kit) throw new Error(`unknown model kit "${species.model.kit}" for ${species.id}`);
    const ctx = makeContext(
      species.model,
      species.stats.radius,
      species.tier,
      `${species.id}${seedSuffix}`,
    );
    this.parts = kit.build(ctx);
    this.group.add(this.parts.body);
    outlineAll(this.group, 0.055);

    this.baseBodyScale.copy(this.parts.body.scale);
    for (let i = 0; i < (this.parts.legs?.length ?? 0); i++) {
      // Alternating gait: opposite legs swing out of phase.
      this.legPhaseOffsets.push((i % 2 === 0 ? 0 : Math.PI) + Math.floor(i / 2) * 0.35);
    }
    for (let i = 0; i < (this.parts.accents?.length ?? 0); i++) {
      this.accentPhase.push(i * 1.7);
    }

    // Eyes get recoloured when a guardian is about to turn, so the player
    // sees the betrayal coming without reading a single number.
    this.parts.eyes?.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.name !== 'pupil' && !mesh.userData.isOutline) {
        const mat = (mesh.material as THREE.MeshBasicMaterial).clone();
        mesh.material = mat;
        this.eyeMaterials.push(mat);
      }
    });

    this.group.scale.setScalar((species.model.scale ?? 1) * VISUAL_SCALE);
  }

  /** Call once per rendered frame. `dt` is real time, not sim time. */
  update(dt: number, state: CreatureState): void {
    this.time += dt;
    const parts = this.parts;

    // --- squash & stretch -------------------------------------------------
    // Impulses come in as 0..1 and decay fast; the body squashes on Y and
    // bulges on XZ so volume looks preserved.
    this.squish = Math.max(this.squish, state.squish);
    this.squish = damp(this.squish, 0, 9, dt);
    const idleBreath = Math.sin(this.time * 2.4 + this.phase) * 0.035;
    const squashY = 1 - this.squish * 0.35 + idleBreath;
    const bulge = 1 + this.squish * 0.28 - idleBreath * 0.6;
    parts.body.scale.set(
      this.baseBodyScale.x * bulge,
      this.baseBodyScale.y * squashY,
      this.baseBodyScale.z * bulge,
    );

    // --- facing -----------------------------------------------------------
    // Turning is damped and deliberately overshoots a touch.
    let delta = state.facing - this.renderedFacing;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.renderedFacing += delta * Math.min(1, dt * 14);
    this.group.rotation.y = this.renderedFacing;
    this.group.scale.setScalar(state.scale * VISUAL_SCALE);

    // --- gait -------------------------------------------------------------
    const gaitSpeed = state.moving ? 9 : state.attacking ? 5 : 1.6;
    this.phase += dt * gaitSpeed;
    const swing = state.moving ? 0.55 : 0.12;
    if (parts.legs) {
      for (const [i, leg] of parts.legs.entries()) {
        leg.rotation.x = Math.sin(this.phase + this.legPhaseOffsets[i]) * swing;
      }
    }
    // A walking body bobs at twice the leg frequency — that is what sells it.
    const bob = state.moving ? Math.abs(Math.sin(this.phase)) * 0.06 : 0;
    parts.body.position.y = bob * this.baseBodyScale.y;

    // --- head, jaw, tail --------------------------------------------------
    if (parts.head) {
      parts.head.rotation.x = Math.sin(this.phase * 0.5) * 0.08 + (state.attacking ? -0.12 : 0);
      parts.head.rotation.z = Math.sin(this.time * 1.3 + this.phase) * 0.05;
    }
    if (parts.jaw) {
      // Snap open on an attack impulse, close slowly.
      if (state.squish > 0.2 && this.time - this.lastAttack > 0.12) {
        this.jawOpen = 1;
        this.lastAttack = this.time;
      }
      this.jawOpen = damp(this.jawOpen, 0, 8, dt);
      parts.jaw.rotation.x = this.jawOpen * 0.7;
    }
    if (parts.tail) {
      const wag = state.attacking ? 7 : state.moving ? 4 : 1.8;
      parts.tail.rotation.y = Math.sin(this.time * wag + this.phase) * (state.attacking ? 0.5 : 0.25);
    }
    if (parts.accents) {
      for (const [i, accent] of parts.accents.entries()) {
        const p = this.time * (state.moving ? 6 : 2.2) + this.accentPhase[i];
        accent.rotation.x = Math.sin(p) * 0.16;
        accent.rotation.z = Math.cos(p * 0.8) * 0.1;
      }
    }

    // --- eyes -------------------------------------------------------------
    this.blink -= dt;
    if (parts.eyes) {
      const blinking = this.blink < 0 && this.blink > -0.09;
      parts.eyes.scale.y = blinking ? 0.12 : 1;
      if (this.blink < -0.09) this.blink = 1.8 + Math.random() * 3.5;
    }
    if (this.eyeMaterials.length) {
      const hunger = clamp01(state.satiety);
      const target = state.feral ? FERAL_EYE : hunger < 0.35 ? WARN_EYE : CALM_EYE;
      for (const mat of this.eyeMaterials) mat.color.lerp(target, Math.min(1, dt * 6));
    }
  }

  /** Pops the whole creature — used on spawn and on placement. */
  pop(strength = 1): void {
    this.squish = Math.max(this.squish, strength);
  }

  setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
  }

  dispose(): void {
    this.group.removeFromParent();
  }
}

/**
 * Per-species view pool.
 *
 * Building a creature means walking a kit and allocating a few dozen objects.
 * With hundreds of spawns a minute that is a stutter machine, so dead views go
 * back in the bucket instead of to the garbage collector.
 */
export class CreaturePool {
  private readonly buckets = new Map<string, CreatureView[]>();
  private counter = 0;

  constructor(private readonly parent: THREE.Object3D) {}

  acquire(species: SpeciesDef): CreatureView {
    const bucket = this.buckets.get(species.id);
    const reused = bucket?.pop();
    if (reused) {
      reused.group.visible = true;
      this.parent.add(reused.group);
      reused.pop(0.8);
      return reused;
    }
    const view = new CreatureView(species, `#${this.counter++}`);
    this.parent.add(view.group);
    view.pop(0.8);
    return view;
  }

  release(species: SpeciesDef, view: CreatureView): void {
    view.group.visible = false;
    view.group.removeFromParent();
    const bucket = this.buckets.get(species.id);
    if (bucket) bucket.push(view);
    else this.buckets.set(species.id, [view]);
  }

  get pooled(): number {
    let n = 0;
    for (const b of this.buckets.values()) n += b.length;
    return n;
  }
}
