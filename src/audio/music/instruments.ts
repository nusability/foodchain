/**
 * Synth voices.
 *
 * Everything is built from oscillators, filtered noise and short impulse
 * responses at runtime — there are no samples to download. The trick to not
 * sounding like a 1998 MIDI card is all in here:
 *
 *   - no bare sine/square voices; every pitched patch is a *stack* of
 *     slightly detuned, slightly delayed oscillators,
 *   - every voice gets an amplitude AND a filter envelope,
 *   - velocity moves timbre (filter cutoff, FM index) and not just level,
 *   - a touch of per-note randomness so repeated notes are never identical,
 *   - plucked things are Karplus-Strong, which no MIDI bank ever managed.
 */
import type { InstrumentId } from './song';
import { midiToFreq } from './theory';

export interface VoiceContext {
  ctx: BaseAudioContext;
  /** Where the voice writes its audio. */
  dest: AudioNode;
  /** Absolute AudioContext time to start. */
  time: number;
  /** Seconds. */
  dur: number;
  /** MIDI note. */
  midi: number;
  vel: number;
  /** Deterministic 0..1 jitter for this note. */
  jitter: number;
  /** Glide time in seconds from the previous note, if any. */
  slide?: number;
  prevMidi?: number;
}

type Voice = (v: VoiceContext) => void;

// ------------------------------------------------------------- utilities

function env(
  ctx: BaseAudioContext,
  param: AudioParam,
  time: number,
  peak: number,
  attack: number,
  decay: number,
  sustain: number,
  release: number,
  dur: number,
): void {
  const hold = Math.max(0.01, dur);
  param.cancelScheduledValues(time);
  param.setValueAtTime(0.0001, time);
  param.exponentialRampToValueAtTime(Math.max(0.0001, peak), time + attack);
  param.exponentialRampToValueAtTime(Math.max(0.0001, peak * sustain), time + attack + decay);
  param.setValueAtTime(Math.max(0.0001, peak * sustain), time + hold);
  param.exponentialRampToValueAtTime(0.0001, time + hold + release);
  void ctx;
}

function osc(
  ctx: BaseAudioContext,
  type: OscillatorType,
  freq: number,
  time: number,
  stop: number,
  detuneCents = 0,
): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, time);
  o.detune.setValueAtTime(detuneCents, time);
  o.start(time);
  o.stop(stop);
  return o;
}

function gainNode(ctx: BaseAudioContext, value = 0): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

let noiseBuffer: AudioBuffer | null = null;
function noise(ctx: BaseAudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const len = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    // Slight lowpass on the noise source keeps hats from sounding like static.
    last = white * 0.6 + last * 0.4;
    data[i] = last;
  }
  noiseBuffer = buf;
  return buf;
}

function noiseSource(ctx: BaseAudioContext, time: number, stop: number, rate = 1): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  src.playbackRate.value = rate;
  src.loop = true;
  src.start(time, Math.random() * 1.5);
  src.stop(stop);
  return src;
}

/** Soft saturation — the single biggest "this is not MIDI" ingredient. */
const shaperCurves = new Map<number, Float32Array<ArrayBuffer>>();
function saturator(ctx: BaseAudioContext, amount = 2.5): WaveShaperNode {
  const key = Math.round(amount * 10);
  let curve = shaperCurves.get(key);
  if (!curve) {
    const n = 2048;
    curve = new Float32Array(new ArrayBuffer(n * 4));
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    shaperCurves.set(key, curve);
  }
  const shaper = ctx.createWaveShaper();
  shaper.curve = curve;
  shaper.oversample = '2x';
  return shaper;
}

function lowpass(ctx: BaseAudioContext, freq: number, q = 1): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function bandpass(ctx: BaseAudioContext, freq: number, q = 4): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function highpass(ctx: BaseAudioContext, freq: number): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = freq;
  return f;
}

// ------------------------------------------------------------- pitched

/** Seven detuned saws through a resonant filter. Big, warm, slightly rude. */
const supersaw: Voice = ({ ctx, dest, time, dur, midi, vel, jitter }) => {
  const freq = midiToFreq(midi);
  const stop = time + dur + 0.6;
  const amp = gainNode(ctx);
  const filt = lowpass(ctx, 400, 6);
  const sat = saturator(ctx, 1.6);

  const detunes = [-19, -11, -5, 0, 6, 12, 20];
  for (const [i, cents] of detunes.entries()) {
    const o = osc(ctx, 'sawtooth', freq, time, stop, cents + (jitter - 0.5) * 6);
    // A tiny per-oscillator delay is what separates "unison" from "chorus".
    const spread = gainNode(ctx, 1 / detunes.length);
    const panner = ctx.createStereoPanner();
    panner.pan.value = (i / (detunes.length - 1)) * 1.6 - 0.8;
    o.connect(spread).connect(panner).connect(filt);
  }

  const peak = 3200 + vel * 4800;
  filt.frequency.setValueAtTime(300, time);
  filt.frequency.exponentialRampToValueAtTime(peak, time + 0.06);
  filt.frequency.exponentialRampToValueAtTime(600 + vel * 900, time + dur + 0.2);

  env(ctx, amp.gain, time, vel * 0.32, 0.012, 0.12, 0.72, 0.28, dur);
  filt.connect(sat).connect(amp).connect(dest);
};

/** Karplus-Strong string. Genuinely physical, genuinely not a sample. */
function karplus(brightness: number, damping: number, burst: 'noise' | 'pulse'): Voice {
  return ({ ctx, dest, time, dur, midi, vel, jitter }) => {
    const freq = midiToFreq(midi);
    const delaySeconds = 1 / freq;

    const exciterGain = gainNode(ctx, 0);
    if (burst === 'noise') {
      noiseSource(ctx, time, time + 0.02).connect(exciterGain);
    } else {
      osc(ctx, 'square', freq * 2, time, time + 0.02).connect(exciterGain);
    }
    exciterGain.gain.setValueAtTime(vel * 0.9, time);
    exciterGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.02);

    const delay = ctx.createDelay(0.2);
    delay.delayTime.value = Math.min(0.19, delaySeconds);
    const feedback = gainNode(ctx, damping - jitter * 0.01);
    const loopFilter = lowpass(ctx, brightness * (0.6 + vel * 0.8), 0.7);

    exciterGain.connect(delay);
    delay.connect(loopFilter).connect(feedback).connect(delay);

    const body = bandpass(ctx, freq * 2.2, 1.2);
    const amp = gainNode(ctx, 0);
    env(ctx, amp.gain, time, vel * 0.55, 0.002, 0.08, 0.8, Math.min(1.1, dur * 0.8 + 0.25), dur);
    delay.connect(body).connect(amp).connect(dest);
    // Direct tap keeps the attack transient crisp.
    const click = gainNode(ctx, vel * 0.18);
    exciterGain.connect(click).connect(dest);
  };
}

/** Two-operator FM. The index tracks velocity, so hard notes get clangy. */
function fm(ratio: number, index: number, decay: number, carrier: OscillatorType = 'sine'): Voice {
  return ({ ctx, dest, time, dur, midi, vel, jitter }) => {
    const freq = midiToFreq(midi);
    const stop = time + dur + decay + 0.4;
    const car = osc(ctx, carrier, freq, time, stop, (jitter - 0.5) * 4);
    const mod = osc(ctx, 'sine', freq * ratio, time, stop);
    const modGain = gainNode(ctx, 0);
    const amp = gainNode(ctx, 0);

    const depth = freq * index * (0.35 + vel * 0.9);
    modGain.gain.setValueAtTime(depth, time);
    modGain.gain.exponentialRampToValueAtTime(Math.max(1, depth * 0.04), time + decay);
    mod.connect(modGain).connect(car.frequency);

    env(ctx, amp.gain, time, vel * 0.4, 0.004, decay, 0.25, decay * 1.5, dur);
    car.connect(amp).connect(dest);
  };
}

/** Additive drawbar organ with a slow Leslie wobble. */
const organ: Voice = ({ ctx, dest, time, dur, midi, vel }) => {
  const freq = midiToFreq(midi);
  const stop = time + dur + 0.3;
  const amp = gainNode(ctx);
  const drawbars = [
    { mul: 0.5, g: 0.28 },
    { mul: 1, g: 1 },
    { mul: 1.5, g: 0.3 },
    { mul: 2, g: 0.55 },
    { mul: 3, g: 0.18 },
    { mul: 4, g: 0.22 },
    { mul: 8, g: 0.08 },
  ];
  const leslie = ctx.createStereoPanner();
  const lfo = osc(ctx, 'sine', 5.6, time, stop);
  const lfoGain = gainNode(ctx, 0.5);
  lfo.connect(lfoGain).connect(leslie.pan);

  for (const bar of drawbars) {
    const o = osc(ctx, 'sine', freq * bar.mul, time, stop, (Math.random() - 0.5) * 3);
    o.connect(gainNode(ctx, bar.g / 3)).connect(amp);
  }
  env(ctx, amp.gain, time, vel * 0.3, 0.02, 0.05, 0.95, 0.12, dur);
  amp.connect(saturator(ctx, 1.3)).connect(leslie).connect(dest);
};

/** Breathy formant pad. Three filters roughly on "ah" vowel formants. */
const choirpad: Voice = ({ ctx, dest, time, dur, midi, vel, jitter }) => {
  const freq = midiToFreq(midi);
  const stop = time + dur + 1.4;
  const amp = gainNode(ctx);
  const src = gainNode(ctx, 1);

  for (const cents of [-14, -6, 0, 7, 15]) {
    osc(ctx, 'sawtooth', freq, time, stop, cents + (jitter - 0.5) * 8)
      .connect(gainNode(ctx, 0.2))
      .connect(src);
  }
  const breath = noiseSource(ctx, time, stop);
  breath.connect(highpass(ctx, 2200)).connect(gainNode(ctx, 0.03)).connect(src);

  const formants = [
    { f: 730, q: 9, g: 1 },
    { f: 1090, q: 11, g: 0.55 },
    { f: 2440, q: 13, g: 0.28 },
  ];
  for (const fm2 of formants) {
    const bp = bandpass(ctx, fm2.f, fm2.q);
    src.connect(bp).connect(gainNode(ctx, fm2.g)).connect(amp);
  }
  src.connect(lowpass(ctx, 900, 0.7)).connect(gainNode(ctx, 0.35)).connect(amp);

  env(ctx, amp.gain, time, vel * 0.3, 0.45, 0.4, 0.85, 1.1, dur);
  amp.connect(dest);
};

/** Fat filtered detuned bass with a slow LFO — the "reese". */
const reese: Voice = ({ ctx, dest, time, dur, midi, vel }) => {
  const freq = midiToFreq(midi);
  const stop = time + dur + 0.35;
  const amp = gainNode(ctx);
  const filt = lowpass(ctx, 200, 8);

  for (const cents of [-16, -6, 5, 17]) {
    osc(ctx, 'sawtooth', freq, time, stop, cents).connect(gainNode(ctx, 0.25)).connect(filt);
  }
  const lfo = osc(ctx, 'sine', 0.9, time, stop);
  lfo.connect(gainNode(ctx, 180)).connect(filt.frequency);

  filt.frequency.setValueAtTime(180, time);
  filt.frequency.exponentialRampToValueAtTime(420 + vel * 900, time + 0.1);
  env(ctx, amp.gain, time, vel * 0.42, 0.015, 0.14, 0.8, 0.2, dur);
  filt.connect(saturator(ctx, 3)).connect(amp).connect(dest);
};

/** Round sub with a click of attack so it cuts through on a phone speaker. */
const subbass: Voice = ({ ctx, dest, time, dur, midi, vel }) => {
  const freq = midiToFreq(midi);
  const stop = time + dur + 0.3;
  const amp = gainNode(ctx);
  const o = osc(ctx, 'sine', freq, time, stop);
  const harm = osc(ctx, 'triangle', freq * 2, time, stop);
  o.connect(gainNode(ctx, 1)).connect(amp);
  harm.connect(gainNode(ctx, 0.22)).connect(amp);
  // Phones cannot reproduce 40 Hz; the octave-up keeps the line audible.
  const ghost = osc(ctx, 'sine', freq * 4, time, time + 0.09);
  ghost.connect(gainNode(ctx, 0.08)).connect(amp);
  env(ctx, amp.gain, time, vel * 0.55, 0.008, 0.1, 0.85, 0.16, dur);
  amp.connect(saturator(ctx, 2)).connect(dest);
};

/** 303-ish acid line with slide and screaming resonance. */
const squelch: Voice = ({ ctx, dest, time, dur, midi, vel, slide, prevMidi }) => {
  const freq = midiToFreq(midi);
  const stop = time + dur + 0.25;
  const o = osc(ctx, 'sawtooth', freq, time, stop);
  if (slide && prevMidi !== undefined) {
    o.frequency.setValueAtTime(midiToFreq(prevMidi), time);
    o.frequency.exponentialRampToValueAtTime(freq, time + slide);
  }
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.Q.value = 14;
  const cutoff = 260 + vel * 2600;
  filt.frequency.setValueAtTime(cutoff, time);
  filt.frequency.exponentialRampToValueAtTime(180, time + dur * 0.9 + 0.08);
  const amp = gainNode(ctx);
  env(ctx, amp.gain, time, vel * 0.34, 0.004, 0.06, 0.6, 0.1, dur);
  o.connect(filt).connect(saturator(ctx, 4)).connect(amp).connect(dest);
};

/** Bright glassy bell stack — FM plus a shimmering ring. */
const glass: Voice = ({ ctx, dest, time, dur, midi, vel, jitter }) => {
  const freq = midiToFreq(midi);
  const stop = time + dur + 1.6;
  const amp = gainNode(ctx);
  for (const [mul, g, det] of [
    [1, 1, 0],
    [2.01, 0.4, 4],
    [3.02, 0.2, -6],
    [4.97, 0.12, 9],
    [7.03, 0.06, -3],
  ] as const) {
    const o = osc(ctx, 'sine', freq * mul, time, stop, det + (jitter - 0.5) * 5);
    const g2 = gainNode(ctx, 0);
    env(ctx, g2.gain, time, g * vel * 0.3, 0.003, 0.3 + mul * 0.12, 0.05, 1.0 + mul * 0.1, dur * 0.4);
    o.connect(g2).connect(amp);
  }
  amp.connect(dest);
};

/** Buzzy brass with a filter sweep and vibrato that arrives late. */
const brass: Voice = ({ ctx, dest, time, dur, midi, vel }) => {
  const freq = midiToFreq(midi);
  const stop = time + dur + 0.4;
  const amp = gainNode(ctx);
  const filt = lowpass(ctx, 500, 3);
  for (const cents of [-7, 0, 8]) {
    const o = osc(ctx, 'sawtooth', freq, time, stop, cents);
    const vib = osc(ctx, 'sine', 5.2, time, stop);
    const vibGain = gainNode(ctx, 0);
    vibGain.gain.setValueAtTime(0.0001, time);
    vibGain.gain.linearRampToValueAtTime(freq * 0.012, time + Math.min(0.5, dur));
    vib.connect(vibGain).connect(o.frequency);
    o.connect(gainNode(ctx, 0.33)).connect(filt);
  }
  filt.frequency.setValueAtTime(420, time);
  filt.frequency.linearRampToValueAtTime(1600 + vel * 3200, time + 0.09);
  filt.frequency.linearRampToValueAtTime(900 + vel * 1200, time + dur + 0.1);
  env(ctx, amp.gain, time, vel * 0.3, 0.035, 0.1, 0.85, 0.2, dur);
  filt.connect(saturator(ctx, 2.2)).connect(amp).connect(dest);
};

/** Cartoon voice blip. Formant-swept pulse — deeply silly, very on-brand. */
const vox: Voice = ({ ctx, dest, time, dur, midi, vel, jitter }) => {
  const freq = midiToFreq(midi);
  const stop = time + dur + 0.2;
  const o = osc(ctx, 'square', freq, time, stop);
  o.frequency.setValueAtTime(freq * (0.85 + jitter * 0.1), time);
  o.frequency.linearRampToValueAtTime(freq, time + 0.05);
  const f1 = bandpass(ctx, 500, 6);
  const f2 = bandpass(ctx, 1500, 8);
  f1.frequency.setValueAtTime(400 + jitter * 300, time);
  f1.frequency.linearRampToValueAtTime(800, time + dur);
  f2.frequency.setValueAtTime(2200, time);
  f2.frequency.linearRampToValueAtTime(1200, time + dur);
  const amp = gainNode(ctx);
  env(ctx, amp.gain, time, vel * 0.26, 0.01, 0.06, 0.7, 0.12, dur);
  o.connect(f1).connect(amp);
  o.connect(f2).connect(gainNode(ctx, 0.5)).connect(amp);
  amp.connect(dest);
};

/** Wide, parpy low brass. */
const tuba: Voice = ({ ctx, dest, time, dur, midi, vel }) => {
  const freq = midiToFreq(midi);
  const stop = time + dur + 0.3;
  const amp = gainNode(ctx);
  const filt = lowpass(ctx, 700, 2);
  osc(ctx, 'sawtooth', freq, time, stop, -5).connect(gainNode(ctx, 0.5)).connect(filt);
  osc(ctx, 'square', freq, time, stop, 6).connect(gainNode(ctx, 0.25)).connect(filt);
  osc(ctx, 'sine', freq * 0.5, time, stop).connect(gainNode(ctx, 0.35)).connect(filt);
  filt.frequency.setValueAtTime(300, time);
  filt.frequency.linearRampToValueAtTime(900 + vel * 700, time + 0.12);
  env(ctx, amp.gain, time, vel * 0.4, 0.05, 0.12, 0.8, 0.22, dur);
  filt.connect(saturator(ctx, 2.6)).connect(amp).connect(dest);
};

/** Breathy whistle with a scoop into pitch. */
const whistle: Voice = ({ ctx, dest, time, dur, midi, vel, jitter }) => {
  const freq = midiToFreq(midi);
  const stop = time + dur + 0.3;
  const o = osc(ctx, 'sine', freq, time, stop);
  o.frequency.setValueAtTime(freq * 0.94, time);
  o.frequency.exponentialRampToValueAtTime(freq, time + 0.07);
  const vib = osc(ctx, 'sine', 5.8 + jitter, time, stop);
  const vibGain = gainNode(ctx, 0);
  vibGain.gain.setValueAtTime(0.0001, time);
  vibGain.gain.linearRampToValueAtTime(freq * 0.018, time + 0.25);
  vib.connect(vibGain).connect(o.frequency);
  const air = noiseSource(ctx, time, stop);
  const airBp = bandpass(ctx, freq * 2, 6);
  const airGain = gainNode(ctx, vel * 0.03);
  air.connect(airBp).connect(airGain);
  const amp = gainNode(ctx);
  env(ctx, amp.gain, time, vel * 0.22, 0.03, 0.08, 0.9, 0.16, dur);
  o.connect(amp);
  airGain.connect(amp);
  amp.connect(dest);
};

// ---------------------------------------------------------- percussion

const kick: Voice = ({ ctx, dest, time, midi, vel }) => {
  const base = midiToFreq(midi);
  const stop = time + 0.7;
  const o = osc(ctx, 'sine', base * 6, time, stop);
  o.frequency.exponentialRampToValueAtTime(base * 0.75, time + 0.055);
  const amp = gainNode(ctx, 0);
  amp.gain.setValueAtTime(vel * 0.95, time);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.42);
  // Click layer — this is what makes it audible on a phone speaker.
  const click = noiseSource(ctx, time, time + 0.02);
  const clickG = gainNode(ctx, vel * 0.25);
  clickG.gain.exponentialRampToValueAtTime(0.0001, time + 0.02);
  click.connect(highpass(ctx, 1200)).connect(clickG).connect(dest);
  o.connect(amp).connect(saturator(ctx, 3)).connect(dest);
};

const snare: Voice = ({ ctx, dest, time, midi, vel, jitter }) => {
  const stop = time + 0.45;
  const n = noiseSource(ctx, time, stop, 1 + jitter * 0.2);
  const bp = bandpass(ctx, 1900, 0.9);
  const ng = gainNode(ctx, vel * 0.55);
  ng.gain.exponentialRampToValueAtTime(0.0001, time + 0.16 + vel * 0.08);
  n.connect(bp).connect(ng).connect(dest);

  const body = osc(ctx, 'triangle', midiToFreq(midi), time, time + 0.2);
  body.frequency.exponentialRampToValueAtTime(midiToFreq(midi) * 0.6, time + 0.1);
  const bg = gainNode(ctx, vel * 0.35);
  bg.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
  body.connect(bg).connect(dest);
};

const clap: Voice = ({ ctx, dest, time, vel }) => {
  // Three offset noise bursts — a real clap is never one hit.
  for (const [i, offset] of [0, 0.011, 0.023, 0.04].entries()) {
    const t = time + offset;
    const n = noiseSource(ctx, t, t + 0.12);
    const bp = bandpass(ctx, 1500 + i * 180, 1.4);
    const g = gainNode(ctx, vel * (i === 3 ? 0.5 : 0.28));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (i === 3 ? 0.16 : 0.035));
    n.connect(bp).connect(g).connect(dest);
  }
};

function hatVoice(decay: number): Voice {
  return ({ ctx, dest, time, vel, jitter }) => {
    const stop = time + decay + 0.05;
    const n = noiseSource(ctx, time, stop, 1.4 + jitter * 0.3);
    const hp = highpass(ctx, 7000);
    const bp = bandpass(ctx, 11000, 0.6);
    const g = gainNode(ctx, vel * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    n.connect(hp).connect(bp).connect(g).connect(dest);
  };
}

const tom: Voice = ({ ctx, dest, time, midi, vel }) => {
  const f = midiToFreq(midi);
  const stop = time + 0.5;
  const o = osc(ctx, 'sine', f * 1.6, time, stop);
  o.frequency.exponentialRampToValueAtTime(f * 0.8, time + 0.12);
  const g = gainNode(ctx, vel * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.35);
  const n = noiseSource(ctx, time, time + 0.05);
  const ng = gainNode(ctx, vel * 0.1);
  ng.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
  n.connect(bandpass(ctx, f * 3, 2)).connect(ng).connect(dest);
  o.connect(g).connect(saturator(ctx, 2)).connect(dest);
};

const rim: Voice = ({ ctx, dest, time, midi, vel }) => {
  const f = midiToFreq(midi) * 4;
  const stop = time + 0.12;
  const o = osc(ctx, 'square', f, time, stop);
  const o2 = osc(ctx, 'square', f * 1.47, time, stop);
  const g = gainNode(ctx, vel * 0.22);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
  o.connect(g);
  o2.connect(gainNode(ctx, 0.5)).connect(g);
  g.connect(bandpass(ctx, 2400, 3)).connect(dest);
};

const shaker: Voice = ({ ctx, dest, time, vel, jitter }) => {
  const stop = time + 0.14;
  const n = noiseSource(ctx, time, stop, 1.8 + jitter * 0.4);
  const g = gainNode(ctx, 0);
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(vel * 0.2, time + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
  n.connect(highpass(ctx, 5500)).connect(g).connect(dest);
};

const crash: Voice = ({ ctx, dest, time, vel }) => {
  const stop = time + 2.2;
  const n = noiseSource(ctx, time, stop, 0.85);
  const g = gainNode(ctx, vel * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 1.9);
  n.connect(highpass(ctx, 4000)).connect(g).connect(dest);
  // Metallic partials on top of the noise wash.
  for (const mul of [1, 1.41, 1.93, 2.71]) {
    const o = osc(ctx, 'square', 620 * mul, time, stop);
    const og = gainNode(ctx, vel * 0.02);
    og.gain.exponentialRampToValueAtTime(0.0001, time + 1.2);
    o.connect(bandpass(ctx, 620 * mul, 20)).connect(og).connect(dest);
  }
};

const woodblock: Voice = ({ ctx, dest, time, midi, vel }) => {
  const f = midiToFreq(midi) * 2;
  const stop = time + 0.14;
  const o = osc(ctx, 'sine', f, time, stop);
  o.frequency.exponentialRampToValueAtTime(f * 0.85, time + 0.04);
  const g = gainNode(ctx, vel * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
  const n = noiseSource(ctx, time, time + 0.015);
  n.connect(bandpass(ctx, f * 2.5, 6)).connect(gainNode(ctx, vel * 0.12)).connect(dest);
  o.connect(bandpass(ctx, f, 6)).connect(g).connect(dest);
};

const cowbell: Voice = ({ ctx, dest, time, midi, vel }) => {
  const f = midiToFreq(midi) * 2;
  const stop = time + 0.4;
  const g = gainNode(ctx, vel * 0.22);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
  osc(ctx, 'square', f, time, stop).connect(g);
  osc(ctx, 'square', f * 1.5, time, stop).connect(gainNode(ctx, 0.6)).connect(g);
  g.connect(bandpass(ctx, f * 1.3, 2.5)).connect(dest);
};

const gong: Voice = ({ ctx, dest, time, midi, vel }) => {
  const f = midiToFreq(midi);
  const stop = time + 4;
  const amp = gainNode(ctx, 0);
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.linearRampToValueAtTime(vel * 0.3, time + 0.06);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + 3.6);
  for (const mul of [1, 1.62, 2.31, 3.17, 4.41, 5.73]) {
    const o = osc(ctx, 'sine', f * mul, time, stop, (Math.random() - 0.5) * 20);
    o.connect(gainNode(ctx, 0.18 / mul)).connect(amp);
  }
  const n = noiseSource(ctx, time, time + 0.3);
  n.connect(bandpass(ctx, f * 6, 1)).connect(gainNode(ctx, vel * 0.08)).connect(amp);
  amp.connect(saturator(ctx, 1.8)).connect(dest);
};

export const INSTRUMENTS: Record<InstrumentId, Voice> = {
  supersaw,
  pluck: karplus(2600, 0.965, 'noise'),
  kalimba: karplus(1500, 0.93, 'pulse'),
  banjo: karplus(4200, 0.955, 'pulse'),
  fmbell: fm(3.51, 2.4, 0.9),
  marimba: fm(4.02, 1.1, 0.28, 'triangle'),
  subbass,
  reese,
  choirpad,
  organ,
  brass,
  squelch,
  glass,
  vox,
  tuba,
  whistle,
  kick,
  snare,
  clap,
  hat: hatVoice(0.055),
  openhat: hatVoice(0.34),
  tom,
  rim,
  shaker,
  crash,
  woodblock,
  cowbell,
  gong,
};

/** Percussion voices ignore harmony — the scheduler skips transposing them. */
export const PERCUSSION: ReadonlySet<InstrumentId> = new Set<InstrumentId>([
  'kick', 'snare', 'clap', 'hat', 'openhat', 'tom', 'rim', 'shaker', 'crash', 'woodblock', 'cowbell', 'gong',
]);

export function playVoice(instrument: InstrumentId, v: VoiceContext): void {
  const voice = INSTRUMENTS[instrument];
  if (!voice) return;
  voice(v);
}
