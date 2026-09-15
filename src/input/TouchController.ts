/**
 * Touch and mouse input.
 *
 * The entire game is one gesture: tap a spot. Everything else (what to plant,
 * what it costs, whether a totem fires) is decided by the game. Drags pan the
 * camera on the world map and are ignored in battle, so a thumb resting on the
 * screen never accidentally plants something.
 */
export interface PointerTarget {
  /** Normalised device coordinates, -1..1, y up. */
  onTap(ndcX: number, ndcY: number): void;
  onDrag?(dxNdc: number, dyNdc: number): void;
}

const TAP_MAX_MOVE = 0.045;
const TAP_MAX_TIME = 450;

export class TouchController {
  private active: { id: number; startX: number; startY: number; x: number; y: number; at: number } | null = null;
  private target: PointerTarget | null = null;
  private detach: Array<() => void> = [];

  constructor(private readonly element: HTMLElement) {
    const opts = { passive: false } as const;

    const down = (e: PointerEvent) => {
      if (this.active) return;
      this.element.setPointerCapture?.(e.pointerId);
      const p = this.toNdc(e);
      this.active = { id: e.pointerId, startX: p.x, startY: p.y, x: p.x, y: p.y, at: performance.now() };
    };

    const move = (e: PointerEvent) => {
      if (!this.active || this.active.id !== e.pointerId) return;
      const p = this.toNdc(e);
      const dx = p.x - this.active.x;
      const dy = p.y - this.active.y;
      this.active.x = p.x;
      this.active.y = p.y;
      this.target?.onDrag?.(dx, dy);
    };

    const up = (e: PointerEvent) => {
      if (!this.active || this.active.id !== e.pointerId) return;
      const moved = Math.hypot(this.active.x - this.active.startX, this.active.y - this.active.startY);
      const elapsed = performance.now() - this.active.at;
      const wasTap = moved < TAP_MAX_MOVE && elapsed < TAP_MAX_TIME;
      const { x, y } = this.active;
      this.active = null;
      if (wasTap) this.target?.onTap(x, y);
    };

    const cancel = () => {
      this.active = null;
    };

    // preventDefault on touchstart stops the browser's 300 ms tap delay and
    // double-tap zoom, both of which make a game like this feel broken.
    const block = (e: Event) => e.preventDefault();

    element.addEventListener('pointerdown', down, opts);
    element.addEventListener('pointermove', move, opts);
    element.addEventListener('pointerup', up, opts);
    element.addEventListener('pointercancel', cancel, opts);
    element.addEventListener('touchstart', block, opts);
    element.addEventListener('contextmenu', block);

    this.detach = [
      () => element.removeEventListener('pointerdown', down),
      () => element.removeEventListener('pointermove', move),
      () => element.removeEventListener('pointerup', up),
      () => element.removeEventListener('pointercancel', cancel),
      () => element.removeEventListener('touchstart', block),
      () => element.removeEventListener('contextmenu', block),
    ];
  }

  setTarget(target: PointerTarget | null): void {
    this.target = target;
    this.active = null;
  }

  private toNdc(e: PointerEvent): { x: number; y: number } {
    const rect = this.element.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((e.clientY - rect.top) / rect.height) * 2 - 1),
    };
  }

  dispose(): void {
    for (const off of this.detach) off();
    this.detach = [];
  }
}
