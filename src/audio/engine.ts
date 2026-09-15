/**
 * The audio front end.
 *
 * Owns the AudioContext, the master bus, the music player and every sound
 * effect. Two things here matter more than they look:
 *
 *  1. **Voice budget.** At peak the sim emits dozens of events per frame. Every
 *     effect goes through a per-category rate limiter, so a hundred coins in
 *     one frame becomes a satisfying cascade rather than a clipped roar.
 *  2. **Music ducking.** Big moments (a betrayal sting, a boss) briefly pull
 *     the music down so the sting lands.
 */
import { MusicPlayer } from './music/engine';
import type { SongDef } from './music/song';
import * as sfx from './sfx/synth';

export interface AudioSettings {
  musicVolume: number;
  sfxVolume: number;
}

type Category = 'coin' | 'chomp' | 'voice' | 'impact' | 'ui';

/** Maximum starts per second, per category. Coins get the loosest budget. */
const RATE_LIMIT: Record<Category, number> = {
  coin: 22,
  chomp: 14,
  voice: 6,
  impact: 10,
  ui: 12,
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private player: MusicPlayer | null = null;
  private settings: AudioSettings = { musicVolume: 0.7, sfxVolume: 0.9 };
  private budget: Record<Category, number> = { coin: 0, chomp: 0, voice: 0, impact: 0, ui: 0 };
  private lastBudgetTick = 0;
  private comboCount = 0;
  private comboExpires = 0;
  private duckUntil = 0;
  private pendingSong: SongDef | null = null;

  get unlocked(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  /**
   * Browsers will not start audio without a gesture, so this is called from
   * the first touch. Safe to call repeatedly.
   */
  async unlock(): Promise<void> {
    if (!this.ctx) {
      const Ctor = globalThis.AudioContext ?? (globalThis as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor({ latencyHint: 'interactive' });

      this.master = this.ctx.createGain();
      this.master.gain.value = 1;

      // A gentle limiter keeps a coin avalanche from distorting.
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -8;
      limiter.knee.value = 6;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.18;
      this.master.connect(limiter).connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.settings.musicVolume;
      this.musicBus.connect(this.master);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.settings.sfxVolume;
      this.sfxBus.connect(this.master);

      this.player = new MusicPlayer(this.ctx, this.musicBus);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (this.pendingSong && this.player) {
      const song = this.pendingSong;
      this.pendingSong = null;
      this.player.play(song);
    }
  }

  applySettings(settings: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...settings };
    if (this.musicBus) this.musicBus.gain.value = this.settings.musicVolume;
    if (this.sfxBus) this.sfxBus.gain.value = this.settings.sfxVolume;
  }

  /** Starts (or crossfades to) a biome theme. */
  playMusic(song: SongDef | null): void {
    if (!song) {
      this.player?.stop(0.6);
      return;
    }
    if (!this.player) {
      this.pendingSong = song;
      return;
    }
    if (this.player.current?.id === song.id) return;
    this.player.stop(0.5);
    // Let the old rack fade before the new one starts, so the transition is a
    // crossfade rather than a pile-up.
    setTimeout(() => this.player?.play(song, 0.9), 260);
  }

  stopMusic(): void {
    this.player?.stop(0.8);
  }

  get currentSongId(): string | null {
    return this.player?.current?.id ?? null;
  }

  /** Call once per frame. Refills the per-category voice budgets. */
  update(now: number): void {
    if (!this.ctx) return;
    const dt = Math.min(0.25, now - this.lastBudgetTick);
    this.lastBudgetTick = now;
    for (const key of Object.keys(this.budget) as Category[]) {
      this.budget[key] = Math.max(0, this.budget[key] - RATE_LIMIT[key] * dt);
    }
    if (now > this.comboExpires) this.comboCount = 0;

    if (this.musicBus) {
      const ducked = this.ctx.currentTime < this.duckUntil;
      const target = this.settings.musicVolume * (ducked ? 0.42 : 1);
      this.musicBus.gain.value += (target - this.musicBus.gain.value) * Math.min(1, dt * 6);
    }
  }

  private take(category: Category): SfxSlot | null {
    if (!this.ctx || !this.sfxBus) return null;
    if (this.budget[category] >= RATE_LIMIT[category]) return null;
    this.budget[category] += 1;
    // Stagger simultaneous starts by a hair so they read as separate hits.
    return {
      ctx: this.ctx,
      dest: this.sfxBus,
      time: this.ctx.currentTime + 0.005 + Math.random() * 0.012,
    };
  }

  /** Pulls the music down for `seconds` so a sting can land. */
  duck(seconds = 0.9): void {
    if (!this.ctx) return;
    this.duckUntil = Math.max(this.duckUntil, this.ctx.currentTime + seconds);
  }

  // ------------------------------------------------------------ one-shots

  coin(): void {
    const slot = this.take('coin');
    if (!slot) return;
    const now = performance.now() / 1000;
    // The combo ladder resets after a short gap, so a steady stream of kills
    // climbs and a lull starts again from the bottom.
    this.comboCount = now < this.comboExpires ? this.comboCount + 1 : 0;
    this.comboExpires = now + 0.65;
    sfx.coin(slot, this.comboCount);
  }

  chomp(pitch: number, big = false): void {
    const slot = this.take('chomp');
    if (slot) sfx.chomp(slot, pitch, big);
  }

  squish(pitch: number): void {
    const slot = this.take('impact');
    if (slot) sfx.squish(slot, pitch);
  }

  poof(pitch: number): void {
    const slot = this.take('impact');
    if (slot) sfx.poof(slot, pitch);
  }

  thud(force = 1): void {
    const slot = this.take('impact');
    if (slot) sfx.thud(slot, force);
  }

  voice(timbre: string, pitch: number): void {
    const slot = this.take('voice');
    if (slot) sfx.critterVoice(slot, timbre, pitch);
  }

  warn(): void {
    const slot = this.take('impact');
    if (slot) sfx.warn(slot);
  }

  betrayal(): void {
    const slot = this.take('impact');
    if (!slot) return;
    this.duck(1.2);
    sfx.betrayal(slot);
  }

  fanfare(big = false): void {
    const slot = this.take('ui');
    if (!slot) return;
    if (big) this.duck(1.0);
    sfx.fanfare(slot, 523.25, big);
  }

  failure(): void {
    const slot = this.take('ui');
    if (!slot) return;
    this.duck(1.6);
    sfx.failure(slot);
  }

  tap(up = true): void {
    const slot = this.take('ui');
    if (slot) sfx.uiTap(slot, up);
  }

  coinShower(count = 12): void {
    if (!this.ctx || !this.sfxBus) return;
    sfx.coinShower({ ctx: this.ctx, dest: this.sfxBus, time: this.ctx.currentTime + 0.01 }, count);
  }
}

interface SfxSlot {
  ctx: AudioContext;
  dest: AudioNode;
  time: number;
}
