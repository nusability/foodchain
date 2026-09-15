import { describe, expect, it } from 'vitest';
import {
  beatsToSeconds,
  chordNotes,
  keyDistance,
  midiToFreq,
  midiToNote,
  noteToMidi,
  parseChord,
  scaleDegree,
  transpose,
  voiceChord,
} from './theory';

describe('theory', () => {
  it('converts note names to MIDI', () => {
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C#4')).toBe(61);
    expect(noteToMidi('Db4')).toBe(61);
    expect(noteToMidi('C-1')).toBe(0);
  });

  it('round-trips through note names', () => {
    for (const midi of [0, 21, 60, 69, 108]) {
      expect(noteToMidi(midiToNote(midi))).toBe(midi);
    }
  });

  it('rejects nonsense note names', () => {
    expect(() => noteToMidi('H4')).toThrow();
    expect(() => noteToMidi('C')).toThrow();
  });

  it('tunes A4 to 440', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 6);
    expect(midiToFreq(81)).toBeCloseTo(880, 6);
  });

  describe('scales', () => {
    it('walks degrees within an octave', () => {
      expect(midiToNote(scaleDegree('C4', 'major', 0))).toBe('C4');
      expect(midiToNote(scaleDegree('C4', 'major', 4))).toBe('G4');
    });

    it('wraps into higher and lower octaves', () => {
      expect(scaleDegree('C4', 'major', 7)).toBe(noteToMidi('C5'));
      expect(scaleDegree('C4', 'major', -7)).toBe(noteToMidi('C3'));
    });

    it('accepts a bare tonic, as a section key would give it', () => {
      expect(scaleDegree('G', 'major', 0)).toBe(scaleDegree('G3', 'major', 0));
    });

    it('supports the wacky scales the biome themes lean on', () => {
      expect(scaleDegree('C4', 'hungarian', 3) - 60).toBe(6);
      expect(scaleDegree('C4', 'octatonic', 1) - 60).toBe(2);
    });
  });

  describe('chords', () => {
    it('parses triads, sevenths and extensions', () => {
      expect(chordNotes('C', 4).map(midiToNote)).toEqual(['C4', 'E4', 'G4']);
      expect(chordNotes('Cm7', 4).map(midiToNote)).toEqual(['C4', 'D#4', 'G4', 'A#4']);
      expect(parseChord('Cmaj9').intervals).toEqual([0, 4, 7, 11, 14]);
    });

    it('parses altered dominants', () => {
      expect(parseChord('G7#9').intervals).toEqual([0, 4, 7, 10, 15]);
      expect(parseChord('G7b9').intervals).toEqual([0, 4, 7, 10, 13]);
    });

    it('puts a slash bass underneath', () => {
      const notes = chordNotes('Cmaj7/E', 3);
      expect(midiToNote(notes[0])).toBe('E2');
      expect(notes).toHaveLength(5);
    });

    it('rejects unknown qualities rather than guessing', () => {
      expect(() => parseChord('Cwobble')).toThrow(/unknown chord quality/);
      expect(() => parseChord('Hm7')).toThrow();
    });

    it('voices a chord into a target register', () => {
      const voiced = voiceChord('Cmaj7', 'C4', 12);
      for (const n of voiced) {
        expect(n).toBeGreaterThanOrEqual(noteToMidi('C4'));
        expect(n).toBeLessThanOrEqual(noteToMidi('C4') + 12);
      }
      expect(new Set(voiced).size).toBe(voiced.length);
    });
  });

  it('measures key distance the short way round the circle', () => {
    expect(keyDistance('C', 'G')).toBe(-5);
    expect(keyDistance('C', 'D')).toBe(2);
    expect(keyDistance('C', 'C')).toBe(0);
  });

  it('transposes', () => {
    expect(transpose([60, 64], 12)).toEqual([72, 76]);
  });

  it('converts beats to seconds', () => {
    expect(beatsToSeconds(4, 120)).toBe(2);
  });
});
