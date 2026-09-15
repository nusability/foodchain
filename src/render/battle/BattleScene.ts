/**
 * The battle scene: everything the player sees while defending the house.
 *
 * This is the seam between the pure simulation and the world. It owns no game
 * rules — it mirrors `sim.units` into creature views, turns the simulation's
 * event queue into particles and sounds, and feeds taps back in as king
 * movement. All of the actual decision-making (what to plant, what it costs,
 * when something goes feral) happens in `src/core/`.
 */
import * as THREE from 'three';
import type { BiomeDef, LevelDef, SpeciesDef } from '@/content/schema';
import { autoPick, nextRung } from '@/core/sim/autoplay';
import type { Simulation } from '@/core/sim/simulation';
import type { SimEvent, Unit, UnitId } from '@/core/sim/types';
import { clamp, dist, damp, type Vec2 } from '@/core/math';
import type { AudioEngine } from '@/audio/engine';
import { CreaturePool, CreatureView } from '../models/creatureView';
import { createFxFields, type ParticleField } from '../fx/particles';
import { FloaterField } from '../fx/floaters';
import { buildArena, type Arena } from './arena';
import { King } from './king';

export interface BattleSceneOptions {
  biome: BiomeDef;
  level: LevelDef;
  sim: Simulation;
  audio: AudioEngine;
  /** Screen shake and floating numbers can be turned down for accessibility. */
  reducedMotion?: boolean;
}

export interface BattleHudState {
  coins: number;
  houseHp: number;
  houseMaxHp: number;
  wave: number;
  totalWaves: number;
  /** What the king is about to plant, if anything. */
  holding: SpeciesDef | null;
  holdingCost: number;
  /** The rung the player will need next — drives the chain hint. */
  hint: SpeciesDef | null;
  hostiles: number;
  feral: number;
}

const TMP_VEC = new THREE.Vector3();

export class BattleScene {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;

  private readonly arena: Arena;
  private readonly pool: CreaturePool;
  private readonly units = new THREE.Group();
  private readonly views = new Map<UnitId, CreatureView>();
  /** Parallel to `views` — the pool needs the species to file a view back. */
  private readonly viewSpecies = new Map<UnitId, SpeciesDef>();
  private readonly fx: { coins: ParticleField; puffs: ParticleField; sparks: ParticleField };
  private readonly floaters: FloaterField;
  private readonly king: King;
  private readonly sim: Simulation;
  private readonly audio: AudioEngine;
  private readonly biome: BiomeDef;
  private readonly level: LevelDef;
  private readonly reducedMotion: boolean;

  private readonly cameraTarget = new THREE.Vector3();
  private readonly cameraHome = new THREE.Vector3();
  /** Resting z for the camera's look-at; drift is applied around it. */
  private readonly baseTargetZ: number;
  private shake = 0;
  private shakeTime = 0;
  private baseDistance: number;
  private holding: SpeciesDef | null = null;
  private holdingCost = 0;
  private hint: SpeciesDef | null = null;
  private pendingPlacement: Vec2 | null = null;

  constructor(opts: BattleSceneOptions) {
    this.sim = opts.sim;
    this.audio = opts.audio;
    this.biome = opts.biome;
    this.level = opts.level;
    this.reducedMotion = opts.reducedMotion ?? false;
    this.baseTargetZ = opts.level.house.position.z - opts.level.arena.depth * 0.26;

    this.scene.background = new THREE.Color(opts.biome.palette.sky);
    this.scene.fog = new THREE.Fog(
      new THREE.Color(opts.biome.palette.fog),
      opts.level.arena.depth * 0.8,
      opts.level.arena.depth * 2.1,
    );

    this.arena = buildArena(opts.biome, opts.level);
    this.scene.add(this.arena.root);
    this.scene.add(this.units);

    this.pool = new CreaturePool(this.units);
    this.fx = createFxFields(this.scene);
    this.floaters = new FloaterField(this.scene);

    this.king = new King(
      this.scene,
      { x: 0, z: opts.level.house.position.z - 4 },
      ['#f2d3c1', '#4a5ec8', '#ffd23f', '#c2452e'],
    );

    // Framed so the whole arena fits in portrait without pinch-zooming: the
    // camera sits behind and well above the house, looking back down the
    // lanes at a steep angle. The steepness matters — a shallower camera puts
    // the horizon on screen and wastes half the display on sky.
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.5, 260);
    this.baseDistance = opts.level.arena.depth * 0.8;
    this.cameraTarget.set(0, 0, opts.level.house.position.z - opts.level.arena.depth * 0.26);
    this.updateCameraHome();
    this.camera.position.copy(this.cameraHome);
    this.camera.lookAt(this.cameraTarget);
  }

  private updateCameraHome(): void {
    this.cameraHome.set(
      this.cameraTarget.x * 0.3,
      this.baseDistance,
      this.cameraTarget.z + this.baseDistance * 0.5,
    );
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    // Portrait phones need to pull back or the lanes run off the top.
    const portraitPull = clamp(height / Math.max(1, width), 1, 2.2);
    this.baseDistance = this.level.arena.depth * (0.62 + portraitPull * 0.16);
    this.updateCameraHome();
    this.camera.updateProjectionMatrix();
  }

  // --------------------------------------------------------------- input

  /**
   * A tap at a world position. The king walks there; what happens on arrival
   * is decided when he gets there, not now, so the player can redirect.
   */
  tapAt(point: Vec2): void {
    const target = this.sim.clampToArena(point);
    this.pendingPlacement = target;
    this.king.walkTo(target);
    this.audio.tap(true);
    this.refreshHolding(target);
  }

  /** Recomputes what the king is carrying for a prospective spot. */
  private refreshHolding(at: Vec2): void {
    const pick = autoPick(this.sim, at);
    this.holding = pick?.species ?? null;
    this.holdingCost = pick?.cost ?? 0;
    this.king.setPreview(this.holding);
  }

  private onKingArrived(at: Vec2): void {
    // A totem underfoot wins over planting — walking onto one IS the button.
    const totem = (this.level.totems ?? []).find((t) => dist(t.position, at) < 1.7);
    if (totem) {
      this.triggerTotem(totem.kind, at);
      this.pendingPlacement = null;
      return;
    }

    const pick = autoPick(this.sim, at);
    if (!pick) {
      this.floaters.spawn('keep collecting!', at.x, 1.8, at.z, 'damage', 1.1);
      this.audio.tap(false);
      return;
    }
    const result = this.sim.place(pick.species.id, at);
    if (!result.ok) {
      // Nudge off the blocked spot rather than failing silently.
      const jitter = { x: at.x + (Math.random() - 0.5) * 1.6, z: at.z + (Math.random() - 0.5) * 1.6 };
      const retry = this.sim.place(pick.species.id, this.sim.clampToArena(jitter));
      if (!retry.ok) {
        this.floaters.spawn('no room!', at.x, 1.8, at.z, 'damage', 0.9);
        this.audio.tap(false);
      }
    }
    this.pendingPlacement = null;
    this.refreshHolding(at);
  }

  private triggerTotem(kind: string, at: Vec2): void {
    switch (kind) {
      case 'coinfall': {
        // A guaranteed payday; the whole point is the noise it makes.
        const amount = 40 + this.sim.director.waveIndex * 25;
        this.sim.award(amount, at, 'totem');
        this.fx.coins.burst(at.x, 1.4, at.z, 26, { speed: 4.5, up: 7, life: 1.3, spin: 9 });
        this.audio.coinShower(14);
        this.king.celebrate();
        break;
      }
      case 'roar': {
        // Free food for everything nearby: buys the player time on hunger.
        let fed = 0;
        for (const unit of this.sim.units.values()) {
          if (unit.faction !== 'guardian' || !unit.species.guardian) continue;
          if (dist(unit.pos, at) > 9) continue;
          unit.satiety = Math.min(1, unit.satiety + 0.45);
          unit.squish = 1;
          fed++;
        }
        this.floaters.spawn(fed > 0 ? `FED ${fed}!` : 'nobody is hungry', at.x, 2.2, at.z, 'alert', 1.3);
        this.fx.puffs.burst(at.x, 1, at.z, 20, { speed: 7, up: 3, life: 0.8, curve: 'pop' });
        this.audio.fanfare(false);
        break;
      }
      default:
        this.audio.tap(true);
    }
  }

  // ---------------------------------------------------------------- frame

  update(dt: number): void {
    this.consumeEvents();
    this.syncUnits(dt);

    this.king.update(dt, (at) => this.onKingArrived(at));
    // While walking, keep the preview honest — prices move as coins come in.
    if (this.pendingPlacement && this.king.isWalking) {
      this.refreshHolding(this.pendingPlacement);
    }
    this.hint = nextRung(this.sim);

    this.arena.update(dt);
    this.fx.coins.update(dt);
    this.fx.puffs.update(dt);
    this.fx.sparks.update(dt);
    this.floaters.update(dt);
    this.updateCamera(dt);
  }

  private syncUnits(dt: number): void {
    // Add views for new units.
    for (const unit of this.sim.units.values()) {
      let view = this.views.get(unit.id);
      if (!view) {
        view = this.pool.acquire(unit.species);
        this.views.set(unit.id, view);
        this.viewSpecies.set(unit.id, unit.species);
      }
      // Floaters (fish, birds, jellies) sit above the ground; the kits build
      // themselves that way, so nothing special is needed here beyond y=0.
      view.setPosition(unit.pos.x, 0, unit.pos.z);
      view.update(dt, {
        moving: unit.state === 'walking',
        attacking: unit.state === 'attacking',
        squish: unit.squish,
        satiety: unit.faction === 'guardian' ? unit.satiety : 1,
        feral: unit.feral,
        facing: unit.facing,
        scale: unit.scale,
      });
      unit.squish = Math.max(0, unit.squish - dt * 4);
    }

    // Retire views whose units are gone, back into the pool rather than to
    // the garbage collector — respawns are constant.
    for (const [id, view] of this.views) {
      if (this.sim.units.has(id)) continue;
      const species = this.viewSpecies.get(id);
      this.views.delete(id);
      this.viewSpecies.delete(id);
      if (species) this.pool.release(species, view);
      else view.dispose();
    }
  }

  private consumeEvents(): void {
    for (const event of this.sim.drainEvents()) this.handleEvent(event);
  }

  private handleEvent(event: SimEvent): void {
    switch (event.type) {
      case 'spawn': {
        const u = event.unit;
        if (u.boss) {
          this.floaters.spawn(u.species.name.toUpperCase(), u.pos.x, 3.4, u.pos.z, 'banner', 2.2);
          this.addShake(0.35);
          this.audio.duck(1.2);
        }
        // Not every critter announces itself, or the mix turns to mush.
        if (u.boss || Math.random() < 0.12) {
          this.audio.voice(u.species.voice?.timbre ?? 'chirp', u.species.voice?.pitch ?? 600);
        }
        break;
      }
      case 'placed': {
        const u = event.unit;
        this.audio.squish(360 / Math.max(0.4, u.species.stats.radius * 2));
        this.fx.puffs.burst(u.pos.x, 0.4, u.pos.z, 12, { speed: 4, up: 2.5, life: 0.5, curve: 'pop' });
        this.floaters.spawn(`-${event.cost}`, u.pos.x, 1.6, u.pos.z, 'damage', 0.8);
        this.floaters.spawn(u.species.name, u.pos.x, 2.4, u.pos.z, 'coin', 1.2);
        this.king.celebrate();
        break;
      }
      case 'attack': {
        this.fx.sparks.burst(event.pos.x, 0.6, event.pos.z, event.onDiet ? 4 : 2, {
          speed: 3,
          up: 2,
          life: 0.32,
        });
        if (Math.random() < 0.45) {
          const attacker = this.sim.units.get(event.attacker);
          this.audio.chomp(
            attacker?.species.voice?.pitch ?? 260,
            (attacker?.species.stats.mass ?? 1) > 3,
          );
        }
        break;
      }
      case 'death': {
        const u = event.unit;
        this.fx.puffs.burst(u.pos.x, 0.5, u.pos.z, 8, { speed: 5, up: 3.5, life: 0.55, curve: 'pop' });
        if (event.bounty > 0) {
          const coins = Math.min(18, 3 + Math.floor(event.bounty / 6));
          this.fx.coins.burst(u.pos.x, 0.7, u.pos.z, coins, { speed: 3.4, up: 6, life: 1.1, spin: 11 });
        }
        this.audio.poof(u.species.voice?.pitch ?? 400);
        if (u.boss) {
          this.addShake(0.5);
          this.audio.fanfare(true);
        }
        break;
      }
      case 'coins': {
        // Only the chunky payouts get a number; the trickle just jingles.
        if (event.reason === 'bounty' || event.reason === 'wave' || event.reason === 'totem') {
          this.floaters.spawn(`+${event.amount}`, event.pos.x, 1.5, event.pos.z, 'coin', 0.95);
          this.audio.coin();
        }
        break;
      }
      case 'fed': {
        const u = event.unit;
        this.fx.puffs.burst(u.pos.x, 1.2, u.pos.z, 4, { speed: 2, up: 2, life: 0.4, curve: 'pop' });
        break;
      }
      case 'feralWarning': {
        const u = event.unit;
        this.floaters.spawn('HUNGRY!', u.pos.x, 2.2, u.pos.z, 'alert', 1.3);
        this.audio.warn();
        break;
      }
      case 'feral': {
        const u = event.unit;
        this.floaters.spawn('FERAL!', u.pos.x, 2.6, u.pos.z, 'banner', 1.8);
        this.fx.sparks.burst(u.pos.x, 1, u.pos.z, 24, { speed: 8, up: 5, life: 0.9 });
        this.addShake(0.4);
        this.audio.betrayal();
        break;
      }
      case 'houseHit': {
        this.arena.shake(0.25);
        this.addShake(0.12);
        this.audio.thud(0.7);
        break;
      }
      case 'waveStart': {
        const title = event.title ?? `WAVE ${event.index + 1}`;
        this.floaters.spawn(
          title,
          this.level.house.position.x,
          4.2,
          this.level.house.position.z - 6,
          'banner',
          2.1,
        );
        this.audio.fanfare(false);
        break;
      }
      case 'waveCleared': {
        this.fx.coins.burst(
          this.level.house.position.x,
          2,
          this.level.house.position.z - 2,
          22,
          { speed: 5, up: 8, life: 1.4, spin: 10 },
        );
        this.audio.coinShower(10);
        this.king.celebrate();
        break;
      }
      case 'levelEnd': {
        if (event.status === 'won') {
          this.audio.fanfare(true);
          this.fx.coins.burst(this.king.position.x, 2, this.king.position.z, 40, {
            speed: 6,
            up: 10,
            life: 2,
            spin: 12,
          });
        } else {
          this.audio.failure();
          this.addShake(0.6);
        }
        break;
      }
    }
  }

  private addShake(amount: number): void {
    if (this.reducedMotion) return;
    this.shake = Math.min(0.7, this.shake + amount);
  }

  private updateCamera(dt: number): void {
    // Drift the framing toward wherever the fight actually is, gently, so the
    // player never loses the king but the action stays in frame.
    const focus = this.frameFocus();
    this.cameraTarget.x = damp(this.cameraTarget.x, focus.x * 0.35, 1.8, dt);
    this.cameraTarget.z = damp(this.cameraTarget.z, this.baseTargetZ + focus.z * 0.18, 1.8, dt);
    this.updateCameraHome();

    this.shakeTime += dt;
    this.shake = Math.max(0, this.shake - dt * 1.9);
    TMP_VEC.copy(this.cameraHome);
    if (this.shake > 0.001) {
      TMP_VEC.x += Math.sin(this.shakeTime * 53) * this.shake * 0.8;
      TMP_VEC.y += Math.sin(this.shakeTime * 61) * this.shake * 0.5;
    }
    this.camera.position.lerp(TMP_VEC, Math.min(1, dt * 6));
    this.camera.lookAt(this.cameraTarget);
  }

  private frameFocus(): Vec2 {
    // Midpoint between the king and the front line of the attack.
    let sumX = this.king.position.x;
    let sumZ = this.king.position.z;
    let n = 1;
    let leader: Unit | null = null;
    for (const unit of this.sim.units.values()) {
      if (unit.faction !== 'critter') continue;
      if (!leader || unit.pos.z > leader.pos.z) leader = unit;
    }
    if (leader) {
      sumX += leader.pos.x;
      sumZ += leader.pos.z;
      n++;
    }
    return { x: sumX / n, z: sumZ / n };
  }

  hud(): BattleHudState {
    let feral = 0;
    for (const unit of this.sim.units.values()) if (unit.feral) feral++;
    return {
      coins: this.sim.coins,
      houseHp: this.sim.house.hp,
      houseMaxHp: this.sim.house.maxHp,
      wave: Math.max(0, this.sim.director.waveIndex) + 1,
      totalWaves: this.sim.director.totalWaves,
      holding: this.holding,
      holdingCost: this.holdingCost,
      hint: this.hint,
      hostiles: this.sim.hostiles.length,
      feral,
    };
  }

  /** Ground-plane intersection for a normalised device coordinate. */
  pickGround(ndcX: number, ndcY: number, raycaster: THREE.Raycaster): Vec2 | null {
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x, z: hit.z };
  }

  get biomeId(): string {
    return this.biome.id;
  }

  dispose(): void {
    for (const view of this.views.values()) view.dispose();
    this.views.clear();
    this.viewSpecies.clear();
    this.floaters.clear();
    this.arena.dispose();
    this.scene.clear();
  }
}
