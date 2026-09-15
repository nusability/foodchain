/**
 * Procedural sound effects.
 *
 * The design pillar is "constant reward", which means a *lot* of sounds — a
 * coin every few frames at peak. Samples would blow the download budget and
 * repeat audibly, so everything is synthesised with per-shot randomisation.
 * The coin blip in particular walks up a pentatonic scale as a combo builds,
 * which is the single most satisfying trick in the whole audio system.
 */
export interface SfxContext {
  ctx: AudioContext;
  dest: AudioNode;
  time: number;
}

function gain(ctx: BaseAudioContext, v = 0): GainNode {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
}

function osc(
  ctx: BaseAudioContext,
  type: OscillatorType,
  freq: number,
  t: number,
  stop: number,
): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.start(t);
  o.stop(stop);
  return o;
}

let noiseBuf: AudioBuffer | null = null;
function noise(ctx: BaseAudioContext, t: number, stop: number): AudioBufferSourceNode {
  if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) {
    const len = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  src.start(t, Math.random() * 0.8);
  src.stop(stop);
  return src;
}

function decay(param: AudioParam, t: number, peak: number, seconds: number, attack = 0.004): void {
  param.setValueAtTime(0.0001, t);
  param.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + attack);
  param.exponentialRampToValueAtTime(0.0001, t + attack + seconds);
}

/** Pentatonic ladder — a rising combo never sounds wrong on these degrees. */
const COIN_LADDER = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];

export function coin({ ctx, dest, time }: SfxContext, combo = 0): void {
  const semitone = COIN_LADDER[Math.min(combo, COIN_LADDER.length - 1)];
  const base = 880 * Math.pow(2, semitone / 12);
  const stop = time + 0.3;
  const g = gain(ctx);
  // Two partials a fifth apart with a tiny delay reads as "ding", not "beep".
  const a = osc(ctx, 'triangle', base, time, stop);
  const b = osc(ctx, 'sine', base * 1.5, time + 0.012, stop);
  a.connect(gain(ctx, 0.6)).connect(g);
  b.connect(gain(ctx, 0.35)).connect(g);
  decay(g.gain, time, 0.22, 0.18, 0.002);
  g.connect(dest);
}

export function chomp({ ctx, dest, time }: SfxContext, pitch = 220, big = false): void {
  const stop = time + 0.3;
  const g = gain(ctx);
  const o = osc(ctx, 'sawtooth', pitch * 2, time, stop);
  o.frequency.exponentialRampToValueAtTime(pitch * 0.5, time + 0.09);
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(big ? 1800 : 3000, time);
  filt.frequency.exponentialRampToValueAtTime(300, time + 0.12);
  filt.Q.value = 6;
  const n = noise(ctx, time, time + 0.06);
  const ng = gain(ctx, 0.25);
  decay(ng.gain, time, 0.25, 0.05, 0.002);
  n.connect(ng).connect(filt);
  o.connect(filt).connect(g);
  decay(g.gain, time, big ? 0.5 : 0.3, big ? 0.22 : 0.12, 0.003);
  g.connect(dest);
}

/** The placement "plop". Pitch drops as the creature settles — very squishy. */
export function squish({ ctx, dest, time }: SfxContext, pitch = 300): void {
  const stop = time + 0.4;
  const g = gain(ctx);
  const o = osc(ctx, 'sine', pitch * 3, time, stop);
  o.frequency.exponentialRampToValueAtTime(pitch * 0.7, time + 0.14);
  const wobble = osc(ctx, 'sine', 24, time, stop);
  const wg = gain(ctx, pitch * 0.6);
  wobble.connect(wg).connect(o.frequency);
  decay(g.gain, time, 0.34, 0.2, 0.006);
  o.connect(g).connect(dest);
}

export function poof({ ctx, dest, time }: SfxContext, pitch = 400): void {
  const stop = time + 0.4;
  const n = noise(ctx, time, stop);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(pitch * 3, time);
  bp.frequency.exponentialRampToValueAtTime(pitch * 0.6, time + 0.22);
  const g = gain(ctx);
  decay(g.gain, time, 0.22, 0.2, 0.004);
  n.connect(bp).connect(g).connect(dest);
}

export function thud({ ctx, dest, time }: SfxContext, force = 1): void {
  const stop = time + 0.6;
  const g = gain(ctx);
  const o = osc(ctx, 'sine', 140, time, stop);
  o.frequency.exponentialRampToValueAtTime(48, time + 0.16);
  const n = noise(ctx, time, time + 0.08);
  const ng = gain(ctx, 0.2 * force);
  decay(ng.gain, time, 0.2 * force, 0.07, 0.002);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  n.connect(lp).connect(ng).connect(dest);
  decay(g.gain, time, 0.45 * force, 0.3, 0.004);
  o.connect(g).connect(dest);
}

/** Rising ominous whoop — a guardian is about to betray you. */
export function warn({ ctx, dest, time }: SfxContext): void {
  const stop = time + 0.9;
  const g = gain(ctx);
  const o = osc(ctx, 'sawtooth', 180, time, stop);
  o.frequency.exponentialRampToValueAtTime(520, time + 0.55);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(700, time);
  lp.frequency.exponentialRampToValueAtTime(2600, time + 0.55);
  lp.Q.value = 9;
  decay(g.gain, time, 0.2, 0.6, 0.15);
  o.connect(lp).connect(g).connect(dest);
}

/** The betrayal sting: a detuned brass snarl plus a downward pitch smear. */
export function betrayal({ ctx, dest, time }: SfxContext): void {
  const stop = time + 1.4;
  const g = gain(ctx);
  for (const detune of [-14, 0, 13]) {
    const o = osc(ctx, 'sawtooth', 320, time, stop);
    o.detune.value = detune;
    o.frequency.setValueAtTime(320, time);
    o.frequency.exponentialRampToValueAtTime(90, time + 0.7);
    o.connect(gain(ctx, 0.33)).connect(g);
  }
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1400;
  lp.Q.value = 4;
  decay(g.gain, time, 0.42, 1.0, 0.01);
  g.connect(lp).connect(dest);
  // A gong underneath gives it weight.
  for (const mul of [1, 1.63, 2.29]) {
    const o = osc(ctx, 'sine', 110 * mul, time, stop);
    const og = gain(ctx);
    decay(og.gain, time, 0.1 / mul, 1.2, 0.02);
    o.connect(og).connect(dest);
  }
}

/** Short major fanfare for wave clears and level wins. */
export function fanfare({ ctx, dest, time }: SfxContext, root = 523.25, big = false): void {
  const degrees = big ? [0, 4, 7, 12, 16, 19] : [0, 4, 7];
  for (const [i, semis] of degrees.entries()) {
    const t = time + i * (big ? 0.075 : 0.06);
    const stop = t + 0.7;
    const freq = root * Math.pow(2, semis / 12);
    const g = gain(ctx);
    const o = osc(ctx, 'square', freq, t, stop);
    const o2 = osc(ctx, 'sawtooth', freq * 1.005, t, stop);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(4200, t + 0.04);
    o.connect(gain(ctx, 0.4)).connect(lp);
    o2.connect(gain(ctx, 0.3)).connect(lp);
    decay(g.gain, t, 0.2, big ? 0.5 : 0.3, 0.008);
    lp.connect(g).connect(dest);
  }
}

/** Descending sad trombone-ish slide for a lost level. */
export function failure({ ctx, dest, time }: SfxContext): void {
  for (const [i, semis] of [0, -1, -2, -5].entries()) {
    const t = time + i * 0.18;
    const stop = t + 0.5;
    const freq = 233.08 * Math.pow(2, semis / 12);
    const g = gain(ctx);
    const o = osc(ctx, 'sawtooth', freq, t, stop);
    o.frequency.setValueAtTime(freq * 1.06, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.1);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    decay(g.gain, t, 0.28, 0.38, 0.02);
    o.connect(lp).connect(g).connect(dest);
  }
}

/** Creature voices, driven by the species' `voice` block. */
export function critterVoice(
  { ctx, dest, time }: SfxContext,
  timbre = 'chirp',
  pitch = 600,
): void {
  const stop = time + 0.5;
  const g = gain(ctx);
  const jitter = 0.9 + Math.random() * 0.25;
  const f = pitch * jitter;

  switch (timbre) {
    case 'growl': {
      const o = osc(ctx, 'sawtooth', f * 0.5, time, stop);
      const lfo = osc(ctx, 'sine', 28, time, stop);
      lfo.connect(gain(ctx, f * 0.3)).connect(o.frequency);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      decay(g.gain, time, 0.16, 0.3, 0.02);
      o.connect(lp).connect(g);
      break;
    }
    case 'rumble': {
      const o = osc(ctx, 'sawtooth', f * 0.4, time, stop);
      o.frequency.exponentialRampToValueAtTime(f * 0.3, time + 0.4);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 400;
      decay(g.gain, time, 0.3, 0.5, 0.04);
      o.connect(lp).connect(g);
      break;
    }
    case 'honk': {
      const o = osc(ctx, 'square', f, time, stop);
      o.frequency.setValueAtTime(f * 0.8, time);
      o.frequency.linearRampToValueAtTime(f, time + 0.05);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f * 2;
      bp.Q.value = 3;
      decay(g.gain, time, 0.18, 0.22, 0.01);
      o.connect(bp).connect(g);
      break;
    }
    case 'squeak': {
      const o = osc(ctx, 'triangle', f * 1.6, time, stop);
      o.frequency.exponentialRampToValueAtTime(f * 2.4, time + 0.06);
      o.frequency.exponentialRampToValueAtTime(f * 1.2, time + 0.14);
      decay(g.gain, time, 0.12, 0.1, 0.003);
      o.connect(g);
      break;
    }
    default: {
      // chirp
      const o = osc(ctx, 'sine', f * 2, time, stop);
      o.frequency.exponentialRampToValueAtTime(f * 3.2, time + 0.04);
      o.frequency.exponentialRampToValueAtTime(f * 2.2, time + 0.1);
      decay(g.gain, time, 0.13, 0.09, 0.002);
      o.connect(g);
    }
  }
  g.connect(dest);
}

export function uiTap({ ctx, dest, time }: SfxContext, up = true): void {
  const stop = time + 0.2;
  const g = gain(ctx);
  const o = osc(ctx, 'sine', up ? 620 : 420, time, stop);
  o.frequency.exponentialRampToValueAtTime(up ? 980 : 260, time + 0.06);
  decay(g.gain, time, 0.16, 0.07, 0.002);
  o.connect(g).connect(dest);
}

/** Coin shower for totems and big payouts. */
export function coinShower(sfx: SfxContext, count = 12): void {
  for (let i = 0; i < count; i++) {
    coin({ ...sfx, time: sfx.time + i * 0.045 + Math.random() * 0.02 }, i);
  }
}
