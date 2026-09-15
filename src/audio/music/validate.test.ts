import { describe, expect, it } from 'vitest';
import { BIOMES } from '@/content/registry';
import { SONGS, songById } from './songs';
import { keyChangeCount, songLengthBars, type SongDef } from './song';
import { formatSongIssues, MIN_BARS, validateSong } from './validate';
import { INSTRUMENTS } from './instruments';

function minimalSong(overrides: Partial<SongDef> = {}): SongDef {
  return {
    id: 'test',
    title: 'Test',
    bpm: 120,
    beatsPerBar: 4,
    sections: [
      { name: 'A', startBar: 0, bars: 20, key: 'C', mode: 'major' },
      { name: 'B', startBar: 20, bars: 20, key: 'Eb', mode: 'minor' },
    ],
    chords: [
      { bar: 0, beat: 0, chord: 'Cmaj7' },
      { bar: 4, beat: 0, chord: 'Am9' },
      { bar: 8, beat: 0, chord: 'Fmaj7' },
      { bar: 12, beat: 0, chord: 'G7' },
    ],
    tracks: [
      {
        name: 'kick',
        instrument: 'kick',
        gain: 0.8,
        notes: Array.from({ length: 40 }, (_, bar) => ({
          bar, beat: 0, dur: 0.5, pitch: 'C2', vel: 0.9,
        })),
      },
    ],
    ...overrides,
  };
}

describe('song validator', () => {
  it('accepts a minimal but legal song', () => {
    const result = validateSong(minimalSong());
    expect(result.errors, formatSongIssues(result)).toEqual([]);
  });

  it('rejects a song under the bar minimum', () => {
    const short = minimalSong({
      sections: [
        { name: 'A', startBar: 0, bars: 5, key: 'C', mode: 'major' },
        { name: 'B', startBar: 5, bars: 5, key: 'F', mode: 'major' },
      ],
      tracks: [
        {
          name: 'kick', instrument: 'kick', gain: 0.8,
          notes: Array.from({ length: 10 }, (_, bar) => ({ bar, beat: 0, dur: 1, pitch: 'C2', vel: 1 })),
        },
      ],
    });
    expect(validateSong(short).errors.some((e) => new RegExp(`${MIN_BARS}`).test(e.message))).toBe(true);
  });

  it('rejects a song that never modulates', () => {
    const flat = minimalSong({
      sections: [
        { name: 'A', startBar: 0, bars: 20, key: 'C', mode: 'major' },
        { name: 'B', startBar: 20, bars: 20, key: 'C', mode: 'major' },
      ],
    });
    expect(validateSong(flat).errors.some((e) => /no key change/.test(e.message))).toBe(true);
  });

  it('rejects sections with a gap between them', () => {
    const gappy = minimalSong({
      sections: [
        { name: 'A', startBar: 0, bars: 10, key: 'C', mode: 'major' },
        { name: 'B', startBar: 20, bars: 20, key: 'F', mode: 'major' },
      ],
    });
    expect(validateSong(gappy).errors.some((e) => /but "B" starts at/.test(e.message))).toBe(true);
  });

  it('rejects sections that do not start at bar 0', () => {
    const late = minimalSong({
      sections: [
        { name: 'A', startBar: 4, bars: 18, key: 'C', mode: 'major' },
        { name: 'B', startBar: 22, bars: 18, key: 'F', mode: 'major' },
      ],
    });
    expect(validateSong(late).errors.some((e) => /expected 0/.test(e.message))).toBe(true);
  });

  it('rejects unparseable chords and bad keys', () => {
    const bad = minimalSong({
      chords: [{ bar: 0, beat: 0, chord: 'Hwobble' }],
      sections: [
        { name: 'A', startBar: 0, bars: 20, key: 'H', mode: 'major' },
        { name: 'B', startBar: 20, bars: 20, key: 'F', mode: 'major' },
      ],
    });
    const messages = validateSong(bad).errors.map((e) => e.message).join('\n');
    expect(messages).toMatch(/not a valid key name/);
  });

  it('rejects notes outside the bar or the playable range', () => {
    const bad = minimalSong({
      tracks: [
        {
          name: 'oops', instrument: 'pluck', gain: 0.5,
          notes: [
            { bar: 0, beat: 9, dur: 1, pitch: 'C4', vel: 0.5 },
            { bar: 1, beat: 0, dur: 1, pitch: 'C-1', vel: 0.5 },
            { bar: 2, beat: 0, dur: 0, pitch: 'C4', vel: 0.5 },
            { bar: 3, beat: 0, dur: 1, pitch: 'C4', vel: 4 },
          ],
        },
      ],
    });
    const messages = validateSong(bad).errors.map((e) => e.message).join('\n');
    expect(messages).toMatch(/outside a 4-beat bar/);
    expect(messages).toMatch(/outside the playable range/);
    expect(messages).toMatch(/dur must be > 0/);
    expect(messages).toMatch(/vel must be 0..1/);
  });

  it('reports useful stats', () => {
    const stats = validateSong(minimalSong()).stats;
    expect(stats.bars).toBe(40);
    expect(stats.keyChanges).toBe(1);
    expect(stats.durationSeconds).toBeCloseTo(80, 5);
  });
});

describe('shipped songs', () => {
  it('there is one per biome', () => {
    for (const biome of BIOMES) {
      expect(songById(biome.music), `${biome.id} wants song "${biome.music}"`).toBeDefined();
    }
  });

  it('song ids are unique', () => {
    expect(new Set(SONGS.map((s) => s.id)).size).toBe(SONGS.length);
  });

  for (const song of SONGS) {
    describe(`${song.id} — "${song.title}"`, () => {
      const result = validateSong(song);

      it('validates cleanly', () => {
        expect(result.errors, formatSongIssues(result)).toEqual([]);
      });

      it(`is at least ${MIN_BARS} bars`, () => {
        expect(songLengthBars(song)).toBeGreaterThanOrEqual(MIN_BARS);
      });

      it('changes key at least once', () => {
        expect(keyChangeCount(song)).toBeGreaterThanOrEqual(1);
      });

      it('has real harmony, not three triads', () => {
        expect(result.stats.distinctChords).toBeGreaterThanOrEqual(4);
        const extended = new Set(song.chords.map((c) => c.chord)).size;
        expect(extended).toBeGreaterThanOrEqual(4);
      });

      it('has a full arrangement', () => {
        expect(song.tracks.length).toBeGreaterThanOrEqual(5);
        expect(result.stats.notes).toBeGreaterThan(songLengthBars(song) * 6);
      });

      it('only uses instruments that exist', () => {
        for (const track of song.tracks) {
          expect(INSTRUMENTS[track.instrument], track.instrument).toBeDefined();
        }
      });

      it('loops from somewhere inside itself', () => {
        const from = song.loopFromBar ?? 0;
        expect(from).toBeGreaterThanOrEqual(0);
        expect(from).toBeLessThan(songLengthBars(song));
      });

      it('has no silent bars', () => {
        const busy = new Set<number>();
        for (const track of song.tracks) for (const n of track.notes) busy.add(n.bar);
        const silent: number[] = [];
        for (let b = 0; b < songLengthBars(song); b++) if (!busy.has(b)) silent.push(b);
        expect(silent, `silent bars in ${song.id}`).toEqual([]);
      });
    });
  }
});
