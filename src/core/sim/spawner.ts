/**
 * Wave director.
 *
 * Owns "which critter appears when". It never touches units directly — it
 * emits spawn requests that the simulation turns into bodies, which keeps
 * wave pacing testable without standing up a whole battle.
 */
import type { LevelDef, WaveEntry } from '@/content/schema';
import type { Rng } from '@/core/rng';

export interface SpawnRequest {
  species: string;
  laneId: string;
  hpScale: number;
  speedScale: number;
  boss: boolean;
  waveIndex: number;
}

interface EntryCursor {
  entry: WaveEntry;
  spawned: number;
  nextAt: number;
}

export type WaveDirectorPhase = 'idle' | 'spawning' | 'clearing' | 'resting' | 'done';

export class WaveDirector {
  phase: WaveDirectorPhase = 'idle';
  waveIndex = -1;
  /** Seconds elapsed inside the current phase. */
  private clock = 0;
  private cursors: EntryCursor[] = [];
  private restRemaining = 0;
  /** Units still alive that this wave spawned. */
  private aliveFromWave = 0;
  private spawnedThisWave = 0;

  constructor(
    private readonly level: LevelDef,
    private readonly rng: Rng,
  ) {}

  get totalWaves(): number {
    return this.level.waves.length;
  }

  get currentWave() {
    return this.level.waves[this.waveIndex];
  }

  get isDone(): boolean {
    return this.phase === 'done';
  }

  /** Fraction of the current wave's spawns that have appeared (0..1). */
  get waveProgress(): number {
    const total = this.cursors.reduce((n, c) => n + c.entry.count, 0);
    return total === 0 ? 1 : this.spawnedThisWave / total;
  }

  get timeUntilNextWave(): number {
    return this.phase === 'resting' ? this.restRemaining : 0;
  }

  begin(): void {
    this.startWave(0);
  }

  private startWave(index: number): void {
    this.waveIndex = index;
    const wave = this.level.waves[index];
    if (!wave) {
      this.phase = 'done';
      return;
    }
    this.cursors = wave.entries.map((entry) => ({
      entry,
      spawned: 0,
      nextAt: entry.delay,
    }));
    this.clock = 0;
    this.aliveFromWave = 0;
    this.spawnedThisWave = 0;
    this.phase = 'spawning';
  }

  /** Tell the director one of its critters died or leaked. */
  notifyRemoved(): void {
    this.aliveFromWave = Math.max(0, this.aliveFromWave - 1);
  }

  private pickLane(entry: WaveEntry): string {
    if (entry.lane !== 'any') return entry.lane;
    return this.rng.weighted(this.level.lanes, (l) => l.weight).id;
  }

  /**
   * Advance by `dt` seconds. Returns the spawns due this step; the caller is
   * expected to create them and to call `notifyRemoved` as they die.
   */
  step(dt: number): SpawnRequest[] {
    const out: SpawnRequest[] = [];
    if (this.phase === 'done' || this.phase === 'idle') return out;

    this.clock += dt;

    if (this.phase === 'resting') {
      this.restRemaining -= dt;
      if (this.restRemaining <= 0) this.startWave(this.waveIndex + 1);
      return out;
    }

    if (this.phase === 'spawning') {
      let exhausted = true;
      for (const cursor of this.cursors) {
        while (cursor.spawned < cursor.entry.count && this.clock >= cursor.nextAt) {
          out.push({
            species: cursor.entry.species,
            laneId: this.pickLane(cursor.entry),
            hpScale: cursor.entry.hpScale ?? 1,
            speedScale: cursor.entry.speedScale ?? 1,
            boss: cursor.entry.boss ?? false,
            waveIndex: this.waveIndex,
          });
          cursor.spawned++;
          this.spawnedThisWave++;
          this.aliveFromWave++;
          cursor.nextAt += cursor.entry.spacing;
        }
        if (cursor.spawned < cursor.entry.count) exhausted = false;
      }
      if (exhausted) this.phase = 'clearing';
    }

    if (this.phase === 'clearing' && this.aliveFromWave <= 0) {
      const wave = this.level.waves[this.waveIndex];
      this.restRemaining = wave.restAfter;
      if (this.waveIndex + 1 >= this.level.waves.length) {
        this.phase = 'done';
      } else {
        this.phase = 'resting';
      }
    }

    return out;
  }

  /** Reward for the wave that just finished clearing, or 0. */
  rewardForWave(index: number): number {
    return this.level.waves[index]?.reward ?? 0;
  }
}
