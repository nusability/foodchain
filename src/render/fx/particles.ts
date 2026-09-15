/**
 * Pooled particle fields.
 *
 * One InstancedMesh per effect type, a fixed slot budget, and a free list.
 * Nothing is allocated after construction — at peak this game throws several
 * hundred coins a second and a per-particle Mesh would end the frame rate.
 */
import * as THREE from 'three';

interface Slot {
  life: number;
  maxLife: number;
  px: number; py: number; pz: number;
  vx: number; vy: number; vz: number;
  spin: number;
  rot: number;
  scale: number;
  /** Extra downward pull; coins arc, puffs float. */
  gravity: number;
  /** Scale curve: 'shrink' | 'pop' | 'grow'. */
  curve: number;
}

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

export class ParticleField {
  readonly mesh: THREE.InstancedMesh;
  private readonly slots: Slot[] = [];
  private readonly free: number[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly pos = new THREE.Vector3();
  private readonly scl = new THREE.Vector3();
  private readonly axis = new THREE.Vector3(0.3, 1, 0.2).normalize();

  constructor(geometry: THREE.BufferGeometry, material: THREE.Material, capacity: number) {
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = capacity;
    for (let i = 0; i < capacity; i++) {
      this.slots.push({
        life: 0, maxLife: 1,
        px: 0, py: 0, pz: 0,
        vx: 0, vy: 0, vz: 0,
        spin: 0, rot: 0, scale: 1, gravity: 0, curve: 0,
      });
      this.free.push(i);
      this.mesh.setMatrixAt(i, HIDDEN);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  get active(): number {
    return this.slots.length - this.free.length;
  }

  spawn(opts: {
    x: number; y: number; z: number;
    vx?: number; vy?: number; vz?: number;
    life?: number;
    scale?: number;
    spin?: number;
    gravity?: number;
    curve?: 'shrink' | 'pop' | 'grow';
  }): void {
    const index = this.free.pop();
    if (index === undefined) return; // budget exhausted — dropping is correct
    const s = this.slots[index];
    s.px = opts.x;
    s.py = opts.y;
    s.pz = opts.z;
    s.vx = opts.vx ?? 0;
    s.vy = opts.vy ?? 0;
    s.vz = opts.vz ?? 0;
    s.maxLife = s.life = opts.life ?? 0.8;
    s.scale = opts.scale ?? 1;
    s.spin = opts.spin ?? 0;
    s.rot = Math.random() * Math.PI * 2;
    s.gravity = opts.gravity ?? 0;
    s.curve = opts.curve === 'pop' ? 1 : opts.curve === 'grow' ? 2 : 0;
  }

  /** Burst helper — the shape most effects want. */
  burst(
    x: number,
    y: number,
    z: number,
    count: number,
    opts: {
      speed?: number;
      up?: number;
      life?: number;
      scale?: number;
      spin?: number;
      gravity?: number;
      curve?: 'shrink' | 'pop' | 'grow';
    } = {},
  ): void {
    const speed = opts.speed ?? 3;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = speed * (0.4 + Math.random() * 0.6);
      this.spawn({
        x, y, z,
        vx: Math.cos(a) * r,
        vy: (opts.up ?? 4) * (0.6 + Math.random() * 0.8),
        vz: Math.sin(a) * r,
        life: (opts.life ?? 0.8) * (0.7 + Math.random() * 0.6),
        scale: (opts.scale ?? 1) * (0.7 + Math.random() * 0.6),
        spin: opts.spin ?? 0,
        gravity: opts.gravity ?? 12,
        curve: opts.curve,
      });
    }
  }

  update(dt: number): void {
    let dirty = false;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) {
        this.mesh.setMatrixAt(i, HIDDEN);
        this.free.push(i);
        dirty = true;
        continue;
      }
      s.vy -= s.gravity * dt;
      s.px += s.vx * dt;
      s.py += s.vy * dt;
      s.pz += s.vz * dt;
      // Bounce off the ground once, at a fraction of the energy.
      if (s.py < 0.1 && s.vy < 0) {
        s.py = 0.1;
        s.vy *= -0.42;
        s.vx *= 0.7;
        s.vz *= 0.7;
      }
      s.rot += s.spin * dt;

      const t = 1 - s.life / s.maxLife;
      let scale = s.scale;
      if (s.curve === 0) scale *= 1 - t * t;                    // shrink away
      else if (s.curve === 1) scale *= Math.sin(t * Math.PI);   // pop in and out
      else scale *= 0.3 + t * 1.2;                              // grow

      this.pos.set(s.px, s.py, s.pz);
      this.quat.setFromAxisAngle(this.axis, s.rot);
      this.scl.setScalar(scale);
      this.matrix.compose(this.pos, this.quat, this.scl);
      this.mesh.setMatrixAt(i, this.matrix);
      dirty = true;
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** The three fields every battle uses, pre-configured. */
export function createFxFields(parent: THREE.Object3D): {
  coins: ParticleField;
  puffs: ParticleField;
  sparks: ParticleField;
} {
  const coinGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.045, 10);
  coinGeo.rotateX(Math.PI / 2);
  const coins = new ParticleField(
    coinGeo,
    new THREE.MeshBasicMaterial({ color: '#ffd23f' }),
    600,
  );

  const puffs = new ParticleField(
    new THREE.IcosahedronGeometry(0.22, 0),
    new THREE.MeshBasicMaterial({ color: '#fffdf5', transparent: true, opacity: 0.9 }),
    300,
  );

  const sparks = new ParticleField(
    new THREE.TetrahedronGeometry(0.14, 0),
    new THREE.MeshBasicMaterial({ color: '#ff6b4a' }),
    300,
  );

  parent.add(coins.mesh, puffs.mesh, sparks.mesh);
  return { coins, puffs, sparks };
}
