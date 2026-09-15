/**
 * The king — the player's entire input surface.
 *
 * There are no menus in this game. The player taps the ground, the king walks
 * there, and whatever should happen at that spot happens when he arrives:
 * planting an animal, triggering a totem, collecting a pile of coins. He also
 * carries a floating preview of what he is about to plant, which is the only
 * "UI" inside the arena.
 */
import * as THREE from 'three';
import type { SpeciesDef } from '@/content/schema';
import { dist, damp, type Vec2 } from '@/core/math';
import { makeContext, outlineAll } from '../models/kit';
import { getKit } from '../models/registry';
import { CreatureView } from '../models/creatureView';

export type KingArrival = (at: Vec2) => void;

export class King {
  readonly group = new THREE.Group();
  readonly position: Vec2 = { x: 0, z: 0 };
  private readonly parts;
  private readonly marker: THREE.Mesh;
  private readonly previewAnchor = new THREE.Group();
  private preview: CreatureView | null = null;
  private previewSpecies: SpeciesDef | null = null;
  private goal: Vec2 | null = null;
  private facing = 0;
  private phase = 0;
  private bounce = 0;
  private speed = 7.5;

  /**
   * `groundY` lifts him onto a raised surface — the world map's islands sit
   * above y=0, and a king standing at zero is a king buried in an island.
   */
  constructor(parent: THREE.Object3D, start: Vec2, palette: string[], private readonly groundY = 0) {
    const kit = getKit('prop.king');
    if (!kit) throw new Error('prop.king kit is not registered');
    this.parts = kit.build(makeContext({ kit: 'prop.king', palette }, 0.55, 0, 'king'));
    this.group.add(this.parts.body);
    outlineAll(this.group, 0.05);

    this.previewAnchor.position.y = 2.1;
    this.group.add(this.previewAnchor);

    this.position.x = start.x;
    this.position.z = start.z;
    this.group.position.set(start.x, this.groundY, start.z);
    parent.add(this.group);

    // The destination marker doubles as the placement footprint preview.
    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.78, 20),
      new THREE.MeshBasicMaterial({ color: '#fffdf5', transparent: true, opacity: 0.8 }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.y = this.groundY + 0.05;
    this.marker.visible = false;
    parent.add(this.marker);
  }

  get isWalking(): boolean {
    return this.goal !== null;
  }

  walkTo(target: Vec2): void {
    this.goal = { ...target };
    this.marker.position.set(target.x, this.groundY + 0.05, target.z);
    this.marker.visible = true;
    this.bounce = 1;
  }

  stop(): void {
    this.goal = null;
    this.marker.visible = false;
  }

  /** Shows what will be planted when he arrives. Pass null to clear it. */
  setPreview(species: SpeciesDef | null): void {
    if (species?.id === this.previewSpecies?.id) return;
    this.previewSpecies = species;
    if (this.preview) {
      this.preview.dispose();
      this.preview = null;
    }
    if (!species) return;
    this.preview = new CreatureView(species, '#preview');
    // Shrunk to a charm dangling over his head.
    this.preview.group.scale.setScalar(0.55 / Math.max(0.35, species.stats.radius));
    this.previewAnchor.add(this.preview.group);
  }

  /** Returns true on the frame he reaches his destination. */
  update(dt: number, onArrive?: KingArrival): boolean {
    this.phase += dt;
    let arrived = false;

    if (this.goal) {
      const d = dist(this.position, this.goal);
      if (d < 0.18) {
        this.position.x = this.goal.x;
        this.position.z = this.goal.z;
        const at = { ...this.goal };
        this.goal = null;
        this.marker.visible = false;
        this.bounce = 1;
        arrived = true;
        onArrive?.(at);
      } else {
        const step = Math.min(d, this.speed * dt);
        const nx = (this.goal.x - this.position.x) / d;
        const nz = (this.goal.z - this.position.z) / d;
        this.position.x += nx * step;
        this.position.z += nz * step;
        this.facing = Math.atan2(nx, nz);
      }
    }

    const walking = this.goal !== null;
    this.group.position.x = this.position.x;
    this.group.position.z = this.position.z;

    // A little hop on every step, and a squash when he lands.
    this.bounce = damp(this.bounce, 0, 7, dt);
    const hop = walking ? Math.abs(Math.sin(this.phase * 11)) * 0.22 : 0;
    this.group.position.y = this.groundY + hop;
    const squash = 1 - this.bounce * 0.25 - (walking ? hop * 0.3 : 0);
    this.parts.body.scale.set(1 / Math.max(0.5, squash), squash, 1 / Math.max(0.5, squash));

    let delta = this.facing - this.group.rotation.y;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.group.rotation.y += delta * Math.min(1, dt * 12);

    if (this.parts.legs) {
      for (const [i, leg] of this.parts.legs.entries()) {
        leg.rotation.x = walking ? Math.sin(this.phase * 11 + i * Math.PI) * 0.7 : 0;
      }
    }
    if (this.parts.accents) {
      for (const [i, accent] of this.parts.accents.entries()) {
        accent.rotation.x = Math.sin(this.phase * (walking ? 8 : 2) + i) * 0.14;
      }
    }

    // The carried preview bobs and spins so it reads as a hologram, not a hat.
    this.previewAnchor.rotation.y += dt * 1.6;
    this.previewAnchor.position.y = 2.1 + Math.sin(this.phase * 2.5) * 0.12;
    this.preview?.update(dt, {
      moving: false,
      attacking: false,
      squish: 0,
      satiety: 1,
      feral: false,
      facing: 0,
      scale: 0.55 / Math.max(0.35, this.previewSpecies?.stats.radius ?? 0.5),
    });

    // Pulse the destination marker so it reads at a glance while walking.
    if (this.marker.visible) {
      const p = 0.9 + Math.sin(this.phase * 9) * 0.12;
      this.marker.scale.set(p, p, p);
    }

    return arrived;
  }

  celebrate(): void {
    this.bounce = 1;
  }
}
