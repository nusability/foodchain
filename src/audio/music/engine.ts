/**
 * The music player.
 *
 * A lookahead scheduler: a timer wakes every 25 ms and schedules every note
 * that falls inside the next 200 ms, sample-accurately, on the AudioContext
 * clock. Nothing is triggered from a UI callback, so the groove does not
 * stutter when the renderer hitches.
 *
 * Each song gets its own effects rack (reverb / ping-pong delay / chorus)
 * built from the mix block, and tracks send into it. Crossfading between
 * biome themes is a gain ramp on two racks.
 */
import { PERCUSSION, playVoice } from './instruments';
import { beatsToSeconds, toMidi } from './theory';
import type { NoteEvent, SongDef, TrackDef } from './song';
import { songLengthBars } from './song';

const LOOKAHEAD_SECONDS = 0.25;
const TICK_MS = 25;

/** Procedural impulse response — a decaying noise tail with early reflections. */
function makeReverbIR(ctx: BaseAudioContext, seconds: number, decay = 2.4): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const ir = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // Slightly different noise per channel gives a wide stereo tail.
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
    // Early reflections make a small IR sound like a real room.
    for (const [delayMs, gain] of [[11, 0.5], [19, 0.36], [29, 0.24], [41, 0.16]] as const) {
      const idx = Math.floor((delayMs / 1000) * rate) + ch * 13;
      if (idx < len) data[idx] += gain;
    }
  }
  return ir;
}

export interface MusicRack {
  input: GainNode;
  master: GainNode;
  reverbSend: GainNode;
  delaySend: GainNode;
  chorusSend: GainNode;
  dispose(): void;
}

function buildRack(ctx: AudioContext, dest: AudioNode, song: SongDef): MusicRack {
  const mix = song.mix ?? {};
  const master = ctx.createGain();
  master.gain.value = mix.masterGain ?? 0.85;
  master.connect(dest);

  const input = ctx.createGain();
  input.connect(master);

  // Reverb
  const convolver = ctx.createConvolver();
  convolver.buffer = makeReverbIR(ctx, mix.reverb ?? 2.2);
  const reverbSend = ctx.createGain();
  reverbSend.gain.value = 1;
  const reverbReturn = ctx.createGain();
  reverbReturn.gain.value = 0.9;
  reverbSend.connect(convolver).connect(reverbReturn).connect(master);

  // Ping-pong delay, timed in beats so it always locks to the groove.
  const delayTime = beatsToSeconds(mix.delayBeats ?? 0.75, song.bpm);
  const delaySend = ctx.createGain();
  const delayL = ctx.createDelay(2);
  const delayR = ctx.createDelay(2);
  delayL.delayTime.value = delayTime;
  delayR.delayTime.value = delayTime;
  const fb = ctx.createGain();
  fb.gain.value = Math.min(0.8, mix.delayFeedback ?? 0.35);
  const panL = ctx.createStereoPanner();
  panL.pan.value = -0.85;
  const panR = ctx.createStereoPanner();
  panR.pan.value = 0.85;
  const delayReturn = ctx.createGain();
  delayReturn.gain.value = 0.55;
  delaySend.connect(delayL);
  delayL.connect(panL).connect(delayReturn);
  delayL.connect(delayR);
  delayR.connect(panR).connect(delayReturn);
  delayR.connect(fb).connect(delayL);
  delayReturn.connect(master);

  // Chorus — two modulated delay lines, opposite phase.
  const chorusSend = ctx.createGain();
  const chorusReturn = ctx.createGain();
  chorusReturn.gain.value = 0.5;
  for (const [i, sign] of [-1, 1].entries()) {
    const d = ctx.createDelay(0.1);
    d.delayTime.value = 0.012 + i * 0.006;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.4 + i * 0.23;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.0035;
    lfo.connect(lfoGain).connect(d.delayTime);
    lfo.start();
    const p = ctx.createStereoPanner();
    p.pan.value = sign * 0.7;
    chorusSend.connect(d).connect(p).connect(chorusReturn);
  }
  chorusReturn.connect(master);

  return {
    input,
    master,
    reverbSend,
    delaySend,
    chorusSend,
    dispose() {
      master.disconnect();
      input.disconnect();
      reverbSend.disconnect();
      delaySend.disconnect();
      chorusSend.disconnect();
    },
  };
}

interface TrackChannel {
  track: TrackDef;
  gain: GainNode;
  /** Notes sorted by absolute beat, with a cursor into them. */
  notes: Array<NoteEvent & { absBeat: number; midi: number }>;
  cursor: number;
  prevMidi?: number;
  /** How many times this channel has wrapped around the loop. */
  loopCount: number;
}

export interface MusicPlayerOptions {
  /** Skip tracks flagged `optional` — for low-end devices. */
  lowQuality?: boolean;
}

export class MusicPlayer {
  private rack: MusicRack | null = null;
  private channels: TrackChannel[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;
  private loopBeats = 0;
  private secondsPerBeat = 0;
  private loopFromBeat = 0;
  private song: SongDef | null = null;
  private jitterSeed = 1;

  constructor(
    private readonly ctx: AudioContext,
    private readonly dest: AudioNode,
    private readonly opts: MusicPlayerOptions = {},
  ) {}

  get current(): SongDef | null {
    return this.song;
  }

  get isPlaying(): boolean {
    return this.timer !== null;
  }

  /** Fades this song's output. Used for ducking and for crossfades. */
  setVolume(value: number, rampSeconds = 0.4): void {
    if (!this.rack) return;
    const g = this.rack.master.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, g.value), now);
    g.linearRampToValueAtTime(Math.max(0.0001, value), now + rampSeconds);
  }

  play(song: SongDef, fadeInSeconds = 0.8): void {
    this.stop();
    this.song = song;
    this.rack = buildRack(this.ctx, this.dest, song);

    const beatsPerBar = song.beatsPerBar;
    this.secondsPerBeat = 60 / song.bpm;
    const bars = songLengthBars(song);
    this.loopBeats = bars * beatsPerBar;
    this.loopFromBeat = (song.loopFromBar ?? 0) * beatsPerBar;

    this.channels = song.tracks
      .filter((t) => !(this.opts.lowQuality && t.optional))
      .map((track) => {
        const gain = this.ctx.createGain();
        gain.gain.value = track.gain;
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = track.pan ?? 0;
        gain.connect(panner);
        panner.connect(this.rack!.input);
        const send = track.send ?? {};
        for (const [target, node] of [
          [send.reverb, this.rack!.reverbSend],
          [send.delay, this.rack!.delaySend],
          [send.chorus, this.rack!.chorusSend],
        ] as const) {
          if (!target) continue;
          const s = this.ctx.createGain();
          s.gain.value = target;
          panner.connect(s).connect(node);
        }
        const notes = track.notes
          .map((n) => ({
            ...n,
            absBeat: n.bar * beatsPerBar + n.beat,
            midi: toMidi(n.pitch),
          }))
          .sort((a, b) => a.absBeat - b.absBeat);
        return { track, gain, notes, cursor: 0, loopCount: 0 };
      });

    const master = this.rack.master.gain;
    const target = master.value;
    master.setValueAtTime(0.0001, this.ctx.currentTime);
    master.linearRampToValueAtTime(target, this.ctx.currentTime + fadeInSeconds);

    this.startTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  stop(fadeSeconds = 0): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const rack = this.rack;
    if (rack) {
      if (fadeSeconds > 0) {
        this.setVolume(0.0001, fadeSeconds);
        setTimeout(() => rack.dispose(), fadeSeconds * 1000 + 200);
      } else {
        rack.dispose();
      }
    }
    this.rack = null;
    this.channels = [];
    this.song = null;
  }

  /** Beats elapsed since the song started, wrapped into the loop. */
  get positionBeats(): number {
    if (!this.song) return 0;
    const elapsed = (this.ctx.currentTime - this.startTime) / this.secondsPerBeat;
    return elapsed;
  }

  get currentBar(): number {
    if (!this.song) return 0;
    const loopLen = this.loopBeats - this.loopFromBeat;
    let beats = this.positionBeats;
    if (beats > this.loopBeats) beats = this.loopFromBeat + ((beats - this.loopFromBeat) % loopLen);
    return Math.floor(beats / this.song.beatsPerBar);
  }

  private nextJitter(): number {
    this.jitterSeed = (this.jitterSeed * 1664525 + 1013904223) >>> 0;
    return this.jitterSeed / 4294967296;
  }

  /** Swing pushes off-eighths later in the bar. */
  private swingOffset(absBeat: number): number {
    const swing = this.song?.swing ?? 0;
    if (swing <= 0) return 0;
    const pos = absBeat % 1;
    // Only the "and" of each beat moves.
    if (Math.abs(pos - 0.5) < 0.01) return swing * 0.5 * this.secondsPerBeat;
    return 0;
  }

  private tick(): void {
    const song = this.song;
    const rack = this.rack;
    if (!song || !rack) return;

    const now = this.ctx.currentTime;
    const horizon = now + LOOKAHEAD_SECONDS;
    const loopLen = this.loopBeats - this.loopFromBeat;

    for (const channel of this.channels) {
      if (channel.notes.length === 0) continue;

      // Schedule forward, wrapping around the loop as many times as needed.
      let guard = 0;
      while (guard++ < 512) {
        if (channel.cursor >= channel.notes.length) {
          channel.cursor = channel.notes.findIndex((n) => n.absBeat >= this.loopFromBeat);
          if (channel.cursor < 0) channel.cursor = 0;
          channel.loopCount += 1;
        }
        const note = channel.notes[channel.cursor];
        const loops = channel.loopCount;
        const absBeat = note.absBeat + loops * loopLen;
        const when = this.startTime + absBeat * this.secondsPerBeat + this.swingOffset(note.absBeat);
        if (when > horizon) break;
        if (when >= now - 0.05) {
          const isPerc = PERCUSSION.has(channel.track.instrument);
          playVoice(channel.track.instrument, {
            ctx: this.ctx,
            dest: channel.gain,
            time: when,
            dur: note.dur * this.secondsPerBeat,
            midi: note.midi,
            vel: note.vel,
            jitter: this.nextJitter(),
            slide: note.slide ? note.slide * this.secondsPerBeat : undefined,
            prevMidi: isPerc ? undefined : channel.prevMidi,
          });
          if (!isPerc) channel.prevMidi = note.midi;
        }
        channel.cursor++;
      }
    }
  }
}
