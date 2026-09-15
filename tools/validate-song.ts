/**
 * Validates a single song file.
 *
 * Usage: npx tsx tools/validate-song.ts src/audio/music/songs/jungle.ts
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { SongDef } from '../src/audio/music/song';
import { sectionAtBar, songLengthBars } from '../src/audio/music/song';
import { formatSongIssues, validateSong } from '../src/audio/music/validate';

const target = process.argv[2];
if (!target) {
  console.error('usage: npx tsx tools/validate-song.ts <path-to-song.ts>');
  process.exit(2);
}

const mod: Record<string, unknown> = await import(pathToFileURL(resolve(target)).href);
const song = Object.values(mod).find(
  (v): v is SongDef =>
    !!v && typeof v === 'object' && 'tracks' in (v as object) && 'sections' in (v as object),
);

if (!song) {
  console.error(`no SongDef exported from ${target}`);
  process.exit(2);
}

const result = validateSong(song);
console.log(formatSongIssues(result));

const s = result.stats;
console.log(
  `\n"${song.title}" — ${s.bars} bars @ ${song.bpm}bpm ${song.beatsPerBar}/4, ` +
    `${s.durationSeconds.toFixed(1)}s, ${s.tracks} tracks, ${s.notes} notes, ` +
    `${s.distinctChords} distinct chords, ${s.keyChanges} key change(s)`,
);

console.log('\narrangement');
for (const section of [...song.sections].sort((a, b) => a.startBar - b.startBar)) {
  const bar = `bars ${String(section.startBar).padStart(3)}-${String(section.startBar + section.bars - 1).padStart(3)}`;
  console.log(`  ${bar}  ${section.name.padEnd(8)} ${section.key} ${section.mode}`);
}

console.log('\ntrack density (notes per bar)');
const bars = songLengthBars(song);
for (const track of song.tracks) {
  const perBar = new Array(bars).fill(0);
  for (const n of track.notes) perBar[n.bar] = (perBar[n.bar] ?? 0) + 1;
  const spark = perBar
    .map((n) => (n === 0 ? '.' : n < 3 ? '▁' : n < 6 ? '▃' : n < 12 ? '▅' : '▇'))
    .join('');
  console.log(`  ${track.name.padEnd(12)} ${track.instrument.padEnd(10)} ${spark}`);
}

// Catch notes that sit outside the harmony of their own section.
let offKey = 0;
for (const track of song.tracks) {
  for (const n of track.notes) {
    const section = sectionAtBar(song, n.bar);
    if (!section) offKey++;
  }
}
if (offKey) console.log(`\n${offKey} note(s) outside any section`);

process.exit(result.errors.length > 0 ? 1 : 0);
