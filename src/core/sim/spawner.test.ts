import { describe, expect, it } from 'vitest';
import { entry, lane, p, wave } from '@/content/helpers';
import { Rng } from '@/core/rng';
import { testLevel } from '../../../tests/fixtures';
import { WaveDirector } from './spawner';

function drive(director: WaveDirector, seconds: number, dt = 1 / 60) {
  const spawns = [];
  for (let i = 0; i < Math.round(seconds / dt); i++) spawns.push(...director.step(dt));
  return spawns;
}

describe('WaveDirector', () => {
  const level = testLevel({
    waves: [
      wave([entry('t.bug', 3, { spacing: 1, delay: 0, lane: 'mid' })], { reward: 30, rest: 2 }),
      wave([entry('t.bug', 2, { spacing: 0.5, delay: 1, lane: 'mid' })], { reward: 50, rest: 3 }),
    ],
  });

  it('does nothing until it is started', () => {
    const d = new WaveDirector(level, new Rng(1));
    expect(drive(d, 5)).toHaveLength(0);
    expect(d.phase).toBe('idle');
  });

  it('spawns exactly the requested count', () => {
    const d = new WaveDirector(level, new Rng(1));
    d.begin();
    expect(drive(d, 10)).toHaveLength(3);
  });

  it('honours delay and spacing', () => {
    const d = new WaveDirector(
      testLevel({ waves: [wave([entry('t.bug', 2, { spacing: 2, delay: 3, lane: 'mid' })])] }),
      new Rng(1),
    );
    d.begin();
    expect(drive(d, 2.9)).toHaveLength(0);
    expect(drive(d, 0.2)).toHaveLength(1);
    expect(drive(d, 1.5)).toHaveLength(0);
    expect(drive(d, 0.7)).toHaveLength(1);
  });

  it('waits for the field to clear before resting', () => {
    const d = new WaveDirector(level, new Rng(1));
    d.begin();
    drive(d, 10);
    expect(d.phase).toBe('clearing');
    // Nothing advances while the player still has critters to deal with.
    drive(d, 30);
    expect(d.phase).toBe('clearing');
  });

  it('rests, then starts the next wave', () => {
    const d = new WaveDirector(level, new Rng(1));
    d.begin();
    drive(d, 10);
    for (let i = 0; i < 3; i++) d.notifyRemoved();
    drive(d, 0.02);
    expect(d.phase).toBe('resting');
    expect(d.timeUntilNextWave).toBeGreaterThan(0);
    drive(d, 2.1);
    expect(d.waveIndex).toBe(1);
    expect(d.phase).toBe('spawning');
  });

  it('finishes after the last wave', () => {
    const d = new WaveDirector(level, new Rng(1));
    d.begin();
    drive(d, 10);
    for (let i = 0; i < 3; i++) d.notifyRemoved();
    drive(d, 3);
    drive(d, 10);
    for (let i = 0; i < 2; i++) d.notifyRemoved();
    drive(d, 0.1);
    expect(d.isDone).toBe(true);
    expect(drive(d, 10)).toHaveLength(0);
  });

  it('rolls lanes by weight when an entry says "any"', () => {
    const weighted = testLevel({
      lanes: [
        lane('left', [p(-5, -10), p(0, 10)], 0),
        lane('right', [p(5, -10), p(0, 10)], 1),
      ],
      waves: [wave([entry('t.bug', 20, { spacing: 0.1, lane: 'any' })])],
    });
    const d = new WaveDirector(weighted, new Rng(9));
    d.begin();
    const spawns = drive(d, 10);
    expect(spawns).toHaveLength(20);
    expect(spawns.every((s) => s.laneId === 'right')).toBe(true);
  });

  it('carries wave scaling onto each spawn', () => {
    const d = new WaveDirector(
      testLevel({
        waves: [wave([entry('t.bug', 1, { lane: 'mid', hpScale: 3, speedScale: 0.5, boss: true })])],
      }),
      new Rng(1),
    );
    d.begin();
    const [spawn] = drive(d, 1);
    expect(spawn).toMatchObject({ hpScale: 3, speedScale: 0.5, boss: true, waveIndex: 0 });
  });

  it('reports progress through the wave', () => {
    const d = new WaveDirector(level, new Rng(1));
    d.begin();
    expect(d.waveProgress).toBe(0);
    drive(d, 0.02);
    expect(d.waveProgress).toBeCloseTo(1 / 3, 5);
    drive(d, 10);
    expect(d.waveProgress).toBe(1);
  });

  it('never drops below zero alive when over-notified', () => {
    const d = new WaveDirector(level, new Rng(1));
    d.begin();
    drive(d, 10);
    for (let i = 0; i < 20; i++) d.notifyRemoved();
    drive(d, 0.02);
    expect(d.phase).toBe('resting');
  });
});
