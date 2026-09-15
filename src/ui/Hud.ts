/**
 * The heads-up display.
 *
 * Deliberately tiny: coins, the house's health, the wave counter, and a
 * "what's next" chain hint. Everything else the player needs to know is said
 * by the world itself — hungry guardians turn their eyes orange, the king
 * carries a preview of what he will plant, totems glow. No buttons.
 */
import type { SpeciesDef } from '@/content/schema';
import type { BattleHudState } from '@/render/battle/BattleScene';

const STYLE = `
.fc-hud{position:fixed;inset:0;pointer-events:none;font:600 16px/1.2 system-ui,-apple-system,sans-serif;color:#fffdf5;
  padding:calc(12px + env(safe-area-inset-top,0px)) 14px 14px;display:flex;flex-direction:column;gap:10px}
.fc-row{display:flex;align-items:center;gap:10px}
.fc-pill{background:rgba(24,18,40,.62);border-radius:999px;padding:7px 14px;display:flex;align-items:center;gap:7px;
  backdrop-filter:blur(6px);box-shadow:0 2px 0 rgba(0,0,0,.25)}
.fc-coins{font-size:22px;font-weight:800;color:#ffd23f;font-variant-numeric:tabular-nums}
.fc-coin-dot{width:16px;height:16px;border-radius:50%;background:#ffd23f;box-shadow:inset -3px -3px 0 rgba(0,0,0,.18)}
.fc-spacer{flex:1}
.fc-hp{flex:1;height:14px;border-radius:999px;background:rgba(24,18,40,.62);overflow:hidden;position:relative}
.fc-hp-fill{height:100%;background:linear-gradient(90deg,#69d94f,#b6e84a);transition:width .18s ease-out}
.fc-hp.low .fc-hp-fill{background:linear-gradient(90deg,#e8483a,#ff8a3a)}
.fc-hint{align-self:flex-start;font-size:13px;opacity:.92}
.fc-hint b{color:#ffd23f}
.fc-bottom{margin-top:auto;display:flex;flex-direction:column;gap:8px;align-items:center;
  padding-bottom:calc(6px + env(safe-area-inset-bottom,0px))}
.fc-holding{font-size:14px;opacity:.95}
.fc-toast{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%) scale(.8);opacity:0;
  font:900 34px/1.1 system-ui,sans-serif;text-align:center;text-shadow:0 3px 0 rgba(0,0,0,.35);
  transition:transform .25s cubic-bezier(.2,1.5,.4,1),opacity .25s;pointer-events:none;max-width:86vw}
.fc-toast.show{transform:translate(-50%,-50%) scale(1);opacity:1}
.fc-pop{animation:fcPop .32s cubic-bezier(.2,1.6,.4,1)}
@keyframes fcPop{0%{transform:scale(1)}40%{transform:scale(1.28)}100%{transform:scale(1)}}
`;

export class Hud {
  private readonly root: HTMLDivElement;
  private readonly coinsEl: HTMLSpanElement;
  private readonly hpEl: HTMLDivElement;
  private readonly hpFill: HTMLDivElement;
  private readonly waveEl: HTMLSpanElement;
  private readonly feralEl: HTMLSpanElement;
  private readonly holdingEl: HTMLDivElement;
  private readonly hintEl: HTMLDivElement;
  private readonly toastEl: HTMLDivElement;
  private lastCoins = -1;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(parent: HTMLElement = document.body) {
    if (!document.getElementById('fc-hud-style')) {
      const style = document.createElement('style');
      style.id = 'fc-hud-style';
      style.textContent = STYLE;
      document.head.appendChild(style);
    }

    this.root = el('div', 'fc-hud');
    const top = el('div', 'fc-row');

    const coinPill = el('div', 'fc-pill');
    coinPill.appendChild(el('div', 'fc-coin-dot'));
    this.coinsEl = el('span', 'fc-coins');
    this.coinsEl.textContent = '0';
    coinPill.appendChild(this.coinsEl);
    top.appendChild(coinPill);

    const wavePill = el('div', 'fc-pill');
    this.waveEl = el('span', '');
    this.waveEl.textContent = 'wave 1';
    wavePill.appendChild(this.waveEl);
    top.appendChild(wavePill);

    this.feralEl = el('span', '');
    const feralPill = el('div', 'fc-pill');
    feralPill.appendChild(this.feralEl);
    feralPill.style.display = 'none';
    top.appendChild(feralPill);

    this.root.appendChild(top);

    const hpRow = el('div', 'fc-row');
    this.hpEl = el('div', 'fc-hp');
    this.hpFill = el('div', 'fc-hp-fill');
    this.hpFill.style.width = '100%';
    this.hpEl.appendChild(this.hpFill);
    hpRow.appendChild(this.hpEl);
    this.root.appendChild(hpRow);

    this.hintEl = el('div', 'fc-hint');
    this.root.appendChild(this.hintEl);

    const bottom = el('div', 'fc-bottom');
    this.holdingEl = el('div', 'fc-holding');
    bottom.appendChild(this.holdingEl);
    this.root.appendChild(bottom);

    this.toastEl = el('div', 'fc-toast');
    parent.appendChild(this.root);
    parent.appendChild(this.toastEl);

    // Stash the pill so the feral counter can be shown and hidden.
    this.feralEl.dataset.pill = '1';
    (this.feralEl as unknown as { _pill: HTMLElement })._pill = feralPill;
  }

  update(state: BattleHudState): void {
    if (state.coins !== this.lastCoins) {
      this.coinsEl.textContent = String(Math.floor(state.coins));
      // Pop the counter whenever it grows — cheap, constant, satisfying.
      if (state.coins > this.lastCoins && this.lastCoins >= 0) {
        this.coinsEl.classList.remove('fc-pop');
        void this.coinsEl.offsetWidth;
        this.coinsEl.classList.add('fc-pop');
      }
      this.lastCoins = state.coins;
    }

    const frac = Math.max(0, state.houseHp / Math.max(1, state.houseMaxHp));
    this.hpFill.style.width = `${(frac * 100).toFixed(1)}%`;
    this.hpEl.classList.toggle('low', frac < 0.34);

    this.waveEl.textContent = `wave ${state.wave}/${state.totalWaves}`;

    const pill = (this.feralEl as unknown as { _pill: HTMLElement })._pill;
    pill.style.display = state.feral > 0 ? '' : 'none';
    if (state.feral > 0) this.feralEl.textContent = `${state.feral} feral!`;

    this.holdingEl.textContent = state.holding
      ? `tap the ground to plant a ${state.holding.name} (${state.holdingCost})`
      : 'collect coins to plant something';

    this.hintEl.innerHTML = state.hint
      ? `next you will need a <b>${escapeHtml(state.hint.name)}</b>`
      : '';
  }

  /** Big centre-screen message. Used for waves, betrayals, and results. */
  toast(text: string, color = '#fffdf5', ms = 1500): void {
    this.toastEl.textContent = text;
    this.toastEl.style.color = color;
    this.toastEl.classList.add('show');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? '' : 'none';
  }

  dispose(): void {
    this.root.remove();
    this.toastEl.remove();
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

export type { SpeciesDef };
