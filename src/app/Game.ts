/**
 * The game shell: renderer, loop, scene switching and meta progression.
 *
 * The simulation runs on a fixed 60 Hz step decoupled from rendering, so a
 * dropped frame changes how the game *looks* and never how it *plays*. The
 * accumulator is clamped so that returning from a backgrounded tab does not
 * fast-forward a whole wave.
 */
import * as THREE from 'three';
import { BIOMES, biomeById } from '@/content/registry';
import type { BiomeDef, LevelDef } from '@/content/schema';
import { Simulation } from '@/core/sim/simulation';
import { Wallet } from '@/core/economy/wallet';
import { autoPurchase, bonusesFor } from '@/core/economy/upgrades';
import { entitlementsFrom, LocalIapProvider, pendingGems } from '@/core/economy/iap';
import {
  applyLevelResult,
  availableGuardians,
  isLevelUnlocked,
  recordFor,
  totalStars,
  unlockSpecies,
} from '@/core/meta/progression';
import { BrowserStorage, loadSave, writeSave, type SaveData } from '@/core/meta/save';
import { AudioEngine } from '@/audio/engine';
import { songById } from '@/audio/music/songs';
import { BattleScene } from '@/render/battle/BattleScene';
import { WorldMapScene, type WorldTarget } from '@/render/world/WorldMapScene';
import { TouchController } from '@/input/TouchController';
import { Hud } from '@/ui/Hud';

const FIXED_DT = 1 / 60;
const MAX_CATCHUP = 0.25;

type Mode = 'map' | 'battle';

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly raycaster = new THREE.Raycaster();
  private readonly audio = new AudioEngine();
  private readonly hud: Hud;
  private readonly input: TouchController;
  private readonly storage = new BrowserStorage();
  private readonly iap = new LocalIapProvider();

  private save: SaveData;
  private wallet: Wallet;
  private mode: Mode = 'map';
  private map: WorldMapScene | null = null;
  private battle: BattleScene | null = null;
  private sim: Simulation | null = null;
  private activeBiome: BiomeDef | null = null;
  private activeLevel: LevelDef | null = null;
  /**
   * Scene switches are deferred to the top of the next frame. They are
   * triggered from inside a scene's own update (the king walking onto an
   * island), and tearing that scene down while it is still on the stack left
   * the loop rendering a disposed scene.
   */
  private pending: (() => void) | null = null;
  private accumulator = 0;
  private lastFrame = 0;
  private running = false;
  private resultShownAt = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: window.devicePixelRatio < 2,
      powerPreference: 'high-performance',
    });
    // Capping DPR at 2 is the single biggest win on a phone; beyond that the
    // extra pixels are invisible and the GPU cost is not.
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.save = loadSave(this.storage);
    this.wallet = new Wallet(this.save.wallet);
    this.audio.applySettings({
      musicVolume: this.save.settings.musicVolume,
      sfxVolume: this.save.settings.sfxVolume,
    });

    this.hud = new Hud();
    this.hud.setVisible(false);
    this.input = new TouchController(canvas);

    // Audio needs a gesture; the first tap anywhere unlocks it.
    const unlock = () => {
      void this.audio.unlock().then(() => this.refreshMusic());
    };
    canvas.addEventListener('pointerdown', unlock, { once: true });

    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      // Never let a backgrounded tab bank up simulation time.
      if (!document.hidden) this.lastFrame = performance.now();
    });

    this.openMap();
    this.resize();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  stop(): void {
    this.running = false;
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.map?.resize(width, height);
    this.battle?.resize(width, height);
  }

  // ------------------------------------------------------------- the loop

  private frame(now: number): void {
    if (!this.running) return;
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    if (this.pending) {
      const transition = this.pending;
      this.pending = null;
      transition();
    }

    this.audio.update(now / 1000);

    if (this.mode === 'battle' && this.sim && this.battle) {
      this.accumulator = Math.min(MAX_CATCHUP, this.accumulator + dt);
      while (this.accumulator >= FIXED_DT) {
        this.sim.step(FIXED_DT);
        this.accumulator -= FIXED_DT;
      }
      this.battle.update(dt);
      this.hud.update(this.battle.hud());
      this.renderer.render(this.battle.scene, this.battle.camera);
      if (this.sim.status !== 'running') this.finishLevel();
    } else if (this.map) {
      this.map.update(dt);
      this.renderer.render(this.map.scene, this.map.camera);
    }

    requestAnimationFrame((t) => this.frame(t));
  }

  // ------------------------------------------------------------ world map

  private openMap(): void {
    this.battle?.dispose();
    this.battle = null;
    this.sim = null;
    this.activeBiome = null;
    this.activeLevel = null;
    this.mode = 'map';
    this.hud.setVisible(false);

    this.map = new WorldMapScene({
      biomes: BIOMES,
      save: this.save,
      audio: this.audio,
      onEnter: (target) => this.enter(target),
    });
    this.map.resize(window.innerWidth, window.innerHeight);
    this.input.setTarget({
      onTap: (x, y) => {
        const point = this.map?.pickGround(x, y, this.raycaster);
        if (point) this.map?.tapAt(point);
      },
    });
    this.refreshMusic();
  }

  private enter(target: WorldTarget): void {
    switch (target.kind) {
      case 'biome': {
        const level = this.firstOpenLevel(target.biome);
        if (level) this.pending = () => this.startLevel(target.biome, level);
        break;
      }
      case 'store':
        void this.openStore();
        break;
      case 'settings':
        this.toggleSettings();
        break;
    }
  }

  private firstOpenLevel(biome: BiomeDef): LevelDef | null {
    for (const level of biome.levels) {
      if (!isLevelUnlocked(this.save, biome, level)) break;
      if (!recordFor(this.save, biome.id, level.id).cleared) return level;
    }
    // Everything cleared — replay the last one for coins.
    return biome.levels[biome.levels.length - 1] ?? null;
  }

  // -------------------------------------------------------------- battles

  private startLevel(biome: BiomeDef, level: LevelDef): void {
    this.map?.dispose();
    this.map = null;

    const entitlements = entitlementsFrom(this.save.purchases);
    const bonuses = bonusesFor(this.save.upgrades);
    const unlocked = new Set(availableGuardians(this.save, biome));

    this.sim = new Simulation({
      biome,
      level,
      seed: `${biome.id}/${level.id}`,
      unlocked,
      bonuses: {
        guardianDamage: bonuses.guardianDamage + (entitlements.bonuses.guardianDamage ?? 0),
        guardianHp: bonuses.guardianHp + (entitlements.bonuses.guardianHp ?? 0),
        coinRate: bonuses.coinRate + (entitlements.bonuses.coinRate ?? 0),
        houseHp: bonuses.houseHp + (entitlements.bonuses.houseHp ?? 0),
      },
    });
    // Meta upgrades top up the starting purse.
    this.sim.coins += Math.round(bonuses.startingCoins);
    this.sim.start();

    // Meeting a species is what unlocks it as a guardian — so the biome opens
    // up as the player plays it, with no unlock screen anywhere.
    this.save = unlockSpecies(
      this.save,
      level.waves.flatMap((w) => w.entries.map((e) => e.species)),
    );

    this.battle = new BattleScene({
      biome,
      level,
      sim: this.sim,
      audio: this.audio,
    });
    this.battle.resize(window.innerWidth, window.innerHeight);
    this.activeBiome = biome;
    this.activeLevel = level;
    this.mode = 'battle';
    this.accumulator = 0;
    this.resultShownAt = 0;
    this.hud.setVisible(true);
    this.hud.toast(level.name, '#ffd23f', 1800);

    this.input.setTarget({
      onTap: (x, y) => {
        const point = this.battle?.pickGround(x, y, this.raycaster);
        if (point) this.battle?.tapAt(point);
      },
    });
    this.refreshMusic();
  }

  private finishLevel(): void {
    if (!this.sim || !this.activeBiome || !this.activeLevel) return;
    if (this.resultShownAt === 0) {
      const outcome = this.sim.outcome();
      const won = outcome.status === 'won';

      this.save = applyLevelResult(this.save, {
        biomeId: this.activeBiome.id,
        levelId: this.activeLevel.id,
        stars: outcome.stars,
        coins: outcome.coinsCollected,
        cleared: won,
      });

      // Coins earned in the level are banked, then spent automatically — the
      // player never sees an upgrade screen unless they go looking for one.
      this.wallet.earn('coins', outcome.coinsCollected, 'level');
      const bought = this.save.settings.autoUpgrade
        ? autoPurchase(
            (amount) => this.wallet.spend('coins', amount, 'auto-upgrade'),
            this.wallet.coins,
            this.save.upgrades,
            { reserve: 150 },
          )
        : [];

      this.save = { ...this.save, wallet: this.wallet.snapshot() };
      writeSave(this.storage, this.save);

      const stars = '★'.repeat(outcome.stars) + '☆'.repeat(Math.max(0, 3 - outcome.stars));
      if (won) {
        const extra = bought.length ? `\n${bought.length} upgrades bought!` : '';
        this.hud.toast(`${stars}\n+${outcome.coinsCollected} coins${extra}`, '#ffd23f', 2600);
      } else {
        this.hud.toast('the house fell!\ntry again', '#ff6b5a', 2600);
      }
      this.resultShownAt = performance.now();
    }

    // Let the celebration land before dropping back to the map.
    if (performance.now() - this.resultShownAt > 2800 && !this.pending) {
      this.pending = () => this.openMap();
    }
  }

  // ----------------------------------------------------------------- meta

  private refreshMusic(): void {
    const id = this.mode === 'battle' ? this.activeBiome?.music : 'meadow';
    const song = id ? songById(id) : null;
    this.audio.playMusic(song ?? null);
  }

  /**
   * The store is a stub on purpose: the IAP framework is real (products,
   * entitlements, receipts, restore), but there is no store to talk to yet, so
   * this exercises the flow against the local provider.
   */
  private async openStore(): Promise<void> {
    const products = await this.iap.listProducts();
    const restored = await this.iap.restore();
    const { gems, creditedIds } = pendingGems(
      [...this.save.purchases, ...restored],
      new Set(this.save.creditedPurchases),
    );
    if (gems > 0) {
      this.wallet.earn('gems', gems, 'iap');
      this.save = {
        ...this.save,
        wallet: this.wallet.snapshot(),
        creditedPurchases: [...this.save.creditedPurchases, ...creditedIds],
      };
      writeSave(this.storage, this.save);
    }
    this.hud.toast(
      `royal store\n${products.length} things to buy\n(coming soon)`,
      '#ffd23f',
      2200,
    );
    this.audio.coinShower(6);
  }

  private toggleSettings(): void {
    // One tap cycles the sound between full, quiet and off — the whole
    // settings screen, for now, is one totem you can walk onto repeatedly.
    const levels = [1, 0.5, 0];
    const current = this.save.settings.musicVolume;
    const next = levels[(levels.findIndex((l) => Math.abs(l - current) < 0.01) + 1) % levels.length];
    this.save = {
      ...this.save,
      settings: { ...this.save.settings, musicVolume: next, sfxVolume: next === 0 ? 0 : 0.9 },
    };
    this.audio.applySettings({ musicVolume: next, sfxVolume: next === 0 ? 0 : 0.9 });
    writeSave(this.storage, this.save);
    this.hud.toast(
      next === 0 ? 'sound off' : next < 1 ? 'sound quiet' : 'sound on',
      '#fffdf5',
      1400,
    );
  }

  get stars(): number {
    return totalStars(this.save);
  }

  get biomeCount(): number {
    return BIOMES.length;
  }

  /** Used by the dev overlay and by tests that drive the shell headlessly. */
  debugState(): { mode: Mode; biome: string | null; level: string | null; stars: number } {
    return {
      mode: this.mode,
      biome: this.activeBiome?.id ?? null,
      level: this.activeLevel?.id ?? null,
      stars: this.stars,
    };
  }

  dispose(): void {
    this.stop();
    this.input.dispose();
    this.hud.dispose();
    this.battle?.dispose();
    this.map?.dispose();
    this.renderer.dispose();
  }
}

export { biomeById };
