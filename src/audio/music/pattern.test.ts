import { describe, expect, it } from 'vitest';
import { midiToNote, noteToMidi, toMidi } from './theory';
import {
  arp,
  bassline,
  chordTrack,
  euclid,
  melody,
  merge,
  pad,
  repeat,
  shiftBars,
  steps,
  transposeNotes,
  withVelocity,
} from './pattern';

const grid = { startBar: 0, bars: 2, beatsPerBar: 4, steps: 16 };

describe('pattern helpers', () => {
  describe('steps', () => {
    it('turns a step string into notes on the grid', () => {
      const notes = steps('x...x...x...x...', grid, 'C2');
      expect(notes).toHaveLength(8);
      expect(notes[0]).toMatchObject({ bar: 0, beat: 0, pitch: 'C2' });
      expect(notes[1].beat).toBe(1);
      expect(notes[4].bar).toBe(1);
    });

    it('treats . and - as rests', () => {
      expect(steps('x-.x', { ...grid, steps: 4, bars: 1 }, 60)).toHaveLength(2);
    });

    it('accents on X and ghosts on o', () => {
      const [accent, ghost] = steps('Xo', { ...grid, steps: 2, bars: 1 }, 60);
      expect(accent.vel).toBe(1);
      expect(ghost.vel).toBeLessThan(0.5);
    });

    it('loops a short pattern to fill the bars', () => {
      expect(steps('x.', { ...grid, steps: 16, bars: 4 }, 60)).toHaveLength(32);
    });

    it('returns nothing for an empty pattern', () => {
      expect(steps('', grid, 60)).toEqual([]);
    });
  });

  describe('euclid', () => {
    it('spreads hits evenly', () => {
      expect(euclid(4, 16)).toBe('...x...x...x...x');
      expect([...euclid(5, 16)].filter((c) => c === 'x')).toHaveLength(5);
    });

    it('rotates', () => {
      const base = euclid(4, 16);
      expect(euclid(4, 16, 3)).not.toBe(base);
      expect(euclid(4, 16, 3)).toHaveLength(16);
    });

    it('handles the degenerate cases', () => {
      expect(euclid(0, 8)).toBe('........');
      expect(euclid(8, 8)).toBe('xxxxxxxx');
    });
  });

  describe('arp', () => {
    it('fills every step of every bar', () => {
      const notes = arp(['Cmaj7'], { ...grid, bars: 2, steps: 8 });
      expect(notes).toHaveLength(16);
    });

    it('keeps notes at or above the floor', () => {
      const notes = arp(['Cmaj7'], { ...grid, low: 'C4' });
      for (const n of notes) expect(toMidi(n.pitch)).toBeGreaterThanOrEqual(noteToMidi('C4'));
    });

    it('follows the progression bar by bar', () => {
      const notes = arp(['C', 'G'], { ...grid, bars: 2, steps: 1, shape: 'up', octaves: 1 });
      expect(midiToNote(toMidi(notes[0].pitch))[0]).toBe('C');
      expect(midiToNote(toMidi(notes[1].pitch))[0]).toBe('G');
    });

    it('is deterministic even for the random shape', () => {
      const a = arp(['Cmaj7'], { ...grid, shape: 'random', seed: 4 });
      const b = arp(['Cmaj7'], { ...grid, shape: 'random', seed: 4 });
      expect(a).toEqual(b);
    });

    it('down is the reverse of up', () => {
      const opts = { ...grid, bars: 1, steps: 4, octaves: 1, shape: 'up' as const };
      const up = arp(['Cmaj7'], opts).map((n) => toMidi(n.pitch));
      const down = arp(['Cmaj7'], { ...opts, shape: 'down' }).map((n) => toMidi(n.pitch));
      expect(down).toEqual([...up].reverse());
    });
  });

  describe('pad', () => {
    it('lays one voicing per chord and holds it', () => {
      const notes = pad(['Cmaj7'], { startBar: 0, bars: 2, beatsPerBar: 4, hold: 2 });
      expect(new Set(notes.map((n) => n.bar))).toEqual(new Set([0]));
      expect(notes[0].dur).toBeCloseTo(7.9, 5);
    });

    it('keeps the voicing inside the requested span', () => {
      const notes = pad(['Cmaj9'], { startBar: 0, bars: 1, beatsPerBar: 4, low: 'C3', span: 12 });
      for (const n of notes) {
        expect(toMidi(n.pitch)).toBeGreaterThanOrEqual(noteToMidi('C3'));
        expect(toMidi(n.pitch)).toBeLessThanOrEqual(noteToMidi('C3') + 12);
      }
    });

    it('can double the bass an octave down', () => {
      const plain = pad(['C'], { startBar: 0, bars: 1, beatsPerBar: 4 });
      const doubled = pad(['C'], { startBar: 0, bars: 1, beatsPerBar: 4, doubleBass: true });
      expect(doubled.length).toBe(plain.length + 1);
    });
  });

  describe('bassline', () => {
    it('plays the root of each chord', () => {
      const notes = bassline(['C', 'G'], 'x', { ...grid, bars: 2, steps: 1, octave: 2 });
      expect(midiToNote(toMidi(notes[0].pitch))).toBe('C2');
      expect(midiToNote(toMidi(notes[1].pitch))).toBe('G2');
    });

    it('can alternate to the fifth', () => {
      const notes = bassline(['C'], 'x'.repeat(16), { ...grid, bars: 1, fifths: true });
      const pitches = new Set(notes.map((n) => toMidi(n.pitch)));
      expect(pitches.size).toBe(2);
    });
  });

  describe('melody', () => {
    it('writes scale degrees, so it retunes with the key', () => {
      const inC = melody([0, 2], { ...grid, bars: 1, steps: 2, key: 'C4', scale: 'major' });
      const inD = melody([0, 2], { ...grid, bars: 1, steps: 2, key: 'D4', scale: 'major' });
      expect(toMidi(inD[0].pitch) - toMidi(inC[0].pitch)).toBe(2);
    });

    it('treats null as a rest', () => {
      expect(melody([0, null, 2], { ...grid, bars: 1, steps: 3, key: 'C4', scale: 'major' })).toHaveLength(2);
    });

    it('shifts octaves', () => {
      const [low] = melody([0], { ...grid, bars: 1, steps: 1, key: 'C4', scale: 'major' });
      const [high] = melody([0], { ...grid, bars: 1, steps: 1, key: 'C4', scale: 'major', octaveOffset: 1 });
      expect(toMidi(high.pitch) - toMidi(low.pitch)).toBe(12);
    });
  });

  describe('block editing', () => {
    const block = steps('x...', { ...grid, bars: 1, steps: 4 }, 60);

    it('shifts bars', () => {
      expect(shiftBars(block, 4)[0].bar).toBe(4);
    });

    it('repeats without mutating the source', () => {
      const repeated = repeat(block, 3, 2);
      expect(repeated).toHaveLength(3);
      expect(repeated.map((n) => n.bar)).toEqual([0, 2, 4]);
      expect(block[0].bar).toBe(0);
    });

    it('transposes and rescales velocity, clamped', () => {
      expect(toMidi(transposeNotes(block, 7)[0].pitch)).toBe(67);
      expect(withVelocity(block, 100)[0].vel).toBe(1);
      expect(withVelocity(block, 0)[0].vel).toBe(0);
    });

    it('merges blocks', () => {
      expect(merge(block, block)).toHaveLength(2);
    });
  });

  it('chordTrack lays one chord per hold', () => {
    expect(chordTrack(['C', 'G'], 0, 4, 2)).toEqual([
      { bar: 0, beat: 0, chord: 'C' },
      { bar: 2, beat: 0, chord: 'G' },
    ]);
  });
});
