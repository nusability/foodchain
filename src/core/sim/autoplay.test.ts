import { describe, expect, it } from 'vitest';
import { p } from '@/content/helpers';
import { BUG, FROG, HAWK, run, testBiome, testLevel } from '../../../tests/fixtures';
import { Simulation } from './simulation';
import { autoPick, nextRung, threatsNear } from './autoplay';

function makeSim(overrides = {}) {
  const level = testLevel(overrides);
  return new Simulation({ biome: testBiome({ levels: [level] }), level, seed: 'auto' });
}

describe('auto-placement — the "no menus" brain', () => {
  it('picks the cheapest thing that eats the nearest threat', () => {
    const sim = makeSim();
    sim.start();
    run(sim, 3);
    const pick = autoPick(sim, p(0, 0));
    expect(pick?.species.id).toBe(FROG.id);
    expect(pick?.answersThreat).toBe(BUG.id);
  });

  it('will not pick something the player cannot afford', () => {
    const sim = makeSim({ startingCoins: 5 });
    sim.start();
    run(sim, 3);
    expect(autoPick(sim, p(0, 0))).toBeNull();
  });

  it('prioritises a feral turncoat over ordinary critters', () => {
    const sim = makeSim({ startingCoins: 1000 });
    sim.place(FROG.id, p(-8, 0));
    sim.start();
    run(sim, 25);
    const feral = sim.hostiles.find((u) => u.feral);
    expect(feral).toBeDefined();

    const threats = threatsNear(sim, p(-8, 0));
    expect(threats[0].unit.feral).toBe(true);
    // And the answer to a feral frog is the thing that eats frogs.
    expect(autoPick(sim, p(-8, 0))?.species.id).toBe(HAWK.id);
  });

  it('falls back to the cheapest guardian when nothing is on screen', () => {
    const sim = makeSim();
    const pick = autoPick(sim, p(0, 0));
    expect(pick?.species.id).toBe(FROG.id);
    expect(pick?.answersThreat).toBeNull();
  });

  it('ignores threats outside the search radius', () => {
    const sim = makeSim();
    sim.start();
    run(sim, 1);
    expect(threatsNear(sim, p(0, 9), { radius: 2 })).toHaveLength(0);
  });

  it('reports the next rung the player will need', () => {
    const sim = makeSim({ startingCoins: 1000 });
    expect(nextRung(sim)).toBeNull();
    sim.start();
    run(sim, 3);
    expect(nextRung(sim)?.id).toBe(FROG.id);
  });
});
