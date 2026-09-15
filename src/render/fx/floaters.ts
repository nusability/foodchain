/**
 * Floating text: "+12", "FERAL!", "WAVE 3".
 *
 * Text in a WebGL scene means a canvas texture per string. Strings repeat
 * constantly here (every coin value, every wave banner), so textures are
 * cached by content+style and sprites are pooled — a floating "+4" costs
 * nothing after the first one.
 */
import * as THREE from 'three';

export type FloaterStyle = 'coin' | 'damage' | 'alert' | 'banner';

interface StyleSpec {
  fill: string;
  stroke: string;
  font: string;
  padding: number;
  worldScale: number;
}

const STYLES: Record<FloaterStyle, StyleSpec> = {
  coin: { fill: '#ffd23f', stroke: '#4a2f0a', font: '700 64px system-ui, sans-serif', padding: 14, worldScale: 0.011 },
  damage: { fill: '#fffdf5', stroke: '#2b2340', font: '700 52px system-ui, sans-serif', padding: 12, worldScale: 0.008 },
  alert: { fill: '#ff5a48', stroke: '#2b1a14', font: '900 72px system-ui, sans-serif', padding: 16, worldScale: 0.013 },
  banner: { fill: '#fffdf5', stroke: '#2b2340', font: '900 96px system-ui, sans-serif', padding: 22, worldScale: 0.018 },
};

const textureCache = new Map<string, THREE.CanvasTexture>();

function textTexture(text: string, style: FloaterStyle): THREE.CanvasTexture {
  const key = `${style}|${text}`;
  const hit = textureCache.get(key);
  if (hit) return hit;

  const spec = STYLES[style];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = spec.font;
  const metrics = ctx.measureText(text);
  const w = Math.ceil(metrics.width) + spec.padding * 2;
  const h = Math.ceil(
    (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) || 72,
  ) + spec.padding * 2;
  canvas.width = w;
  canvas.height = h;

  // Re-set after resizing: changing canvas dimensions resets the 2D state.
  ctx.font = spec.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 10;
  ctx.strokeStyle = spec.stroke;
  ctx.strokeText(text, w / 2, h / 2);
  ctx.fillStyle = spec.fill;
  ctx.fillText(text, w / 2, h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  textureCache.set(key, tex);
  return tex;
}

interface Floater {
  sprite: THREE.Sprite;
  life: number;
  maxLife: number;
  vy: number;
  drift: number;
  baseScaleX: number;
  baseScaleY: number;
}

export class FloaterField {
  private readonly active: Floater[] = [];
  private readonly pool: THREE.Sprite[] = [];

  constructor(private readonly parent: THREE.Object3D, private readonly capacity = 48) {}

  spawn(
    text: string,
    x: number,
    y: number,
    z: number,
    style: FloaterStyle = 'coin',
    life = 1.1,
  ): void {
    if (this.active.length >= this.capacity) {
      // Recycle the oldest rather than dropping — the newest number matters most.
      const oldest = this.active.shift();
      if (oldest) this.retire(oldest);
    }
    const tex = textTexture(text, style);
    const sprite = this.pool.pop() ?? new THREE.Sprite();
    const mat = (sprite.material as THREE.SpriteMaterial | undefined) ?? new THREE.SpriteMaterial();
    mat.map = tex;
    mat.transparent = true;
    mat.depthTest = false;
    mat.opacity = 1;
    sprite.material = mat;
    sprite.renderOrder = 10;

    const spec = STYLES[style];
    const img = tex.image as HTMLCanvasElement;
    const sx = img.width * spec.worldScale;
    const sy = img.height * spec.worldScale;
    sprite.scale.set(sx, sy, 1);
    sprite.position.set(x, y, z);
    this.parent.add(sprite);

    this.active.push({
      sprite,
      life,
      maxLife: life,
      vy: 2.4 + Math.random() * 0.8,
      drift: (Math.random() - 0.5) * 1.2,
      baseScaleX: sx,
      baseScaleY: sy,
    });
  }

  private retire(f: Floater): void {
    f.sprite.removeFromParent();
    this.pool.push(f.sprite);
  }

  update(dt: number, cameraQuaternion?: THREE.Quaternion): void {
    void cameraQuaternion; // sprites always face the camera
    for (let i = this.active.length - 1; i >= 0; i--) {
      const f = this.active[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.retire(f);
        this.active.splice(i, 1);
        continue;
      }
      const t = 1 - f.life / f.maxLife;
      f.vy -= 2.2 * dt;
      f.sprite.position.y += f.vy * dt;
      f.sprite.position.x += f.drift * dt;
      // Overshoot on the way in, fade on the way out.
      const pop = t < 0.18 ? 0.6 + (t / 0.18) * 0.55 : 1.15 - (t - 0.18) * 0.18;
      f.sprite.scale.set(f.baseScaleX * pop, f.baseScaleY * pop, 1);
      (f.sprite.material as THREE.SpriteMaterial).opacity = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;
    }
  }

  clear(): void {
    for (const f of this.active) this.retire(f);
    this.active.length = 0;
  }
}
