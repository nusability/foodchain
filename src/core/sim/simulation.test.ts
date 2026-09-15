import { beforeEach, describe, expect, it } from 'vitest';
import { entry, lane, p, wave } from '@/content/helpers';
import { BUG, FROG, HAWK, HOUSE, run, testBiome, testLevel } from '../../../tests/fixtures';
import { Simulation } from './simulation';
import type { SimEvent } from './types';

function makeSim(levelOverrides = {}, simOverrides = {}) {
  const level = testLevel(levelOverrides);
  const biome = testBiome({ levels: [level] });
  return new Simulation({ biome, level, seed: 'test', ...simOverrides });
}

function eventsOfType<T extends SimEvent['type']>(
  events: SimEvent[],
  type: T,
): Extract<SimEvent, { type: T }>[] {
  return events.filter((e) => e.type === type) as Extract<SimEvent, { type: T }>[];
}

describe('Simulation', () => {
  describe('placement', () => {
    let sim: Simulation;
    beforeEach(() => {
      sim = makeSim();
    });

    it('plants a guardian and charges for it', () => {
      const before = sim.coins;
      const result = sim.place(FROG.id, p(0, 4));
      expect(result.ok).toBe(true);
      expect(sim.coins).toBe(before - FROG.guardian!.cost);
      expect(sim.guardians).toHaveLength(1);
    });

    it('prices each additional copy up the growth curve', () => {
      expect(sim.priceOf(FROG.id)).toBe(20);
      sim.place(FROG.id, p(0, 4));
      expect(sim.priceOf(FROG.id)).toBe(30);
    });

    it('refuses what the player cannot afford', () => {
      expect(sim.place(HAWK.id, p(0, 4)).reason).toBe('unaffordable');
      expect(sim.guardians).toHaveLength(0);
    });

    it('refuses a species still on cooldown', () => {
      sim.place(FROG.id, p(0, 4));
      expect(sim.place(FROG.id, p(3, 4)).reason).toBe('cooldown');
      run(sim, 1.1);
      expect(sim.place(FROG.id, p(3, 4)).ok).toBe(true);
    });

    it('refuses overlapping placements', () => {
      sim.place(FROG.id, p(0, 4));
      run(sim, 1.1);
      expect(sim.place(FROG.id, p(0.1, 4)).reason).toBe('occupied');
    });

    it('refuses to plant inside the house or off the map', () => {
      expect(sim.place(FROG.id, HOUSE).reason).toBe('occupied');
      expect(sim.place(FROG.id, p(500, 500)).reason).toBe('out-of-bounds');
    });

    it('refuses species the player has not unlocked', () => {
      const level = testLevel();
      const locked = new Simulation({
        biome: testBiome({ levels: [level] }),
        level,
        unlocked: new Set<string>(),
      });
      expect(locked.place(FROG.id, p(0, 4)).reason).toBe('not-placeable');
    });

    it('refuses to plant a pure critter', () => {
      expect(sim.place(BUG.id, p(0, 4)).reason).toBe('not-placeable');
    });

    it('charges nothing for a refused placement', () => {
      const before = sim.coins;
      sim.place(HAWK.id, p(0, 4));
      expect(sim.coins).toBe(before);
    });
  });

  describe('waves and combat', () => {
    it('spawns a wave and marches it at the house', () => {
      const sim = makeSim();
      sim.start();
      run(sim, 3);
      expect(sim.hostiles.length).toBeGreaterThan(0);
      const lead = sim.hostiles[0];
      const startZ = lead.pos.z;
      run(sim, 2);
      expect(lead.pos.z).toBeGreaterThan(startZ);
    });

    it('damages the house when critters arrive', () => {
      const sim = makeSim();
      sim.start();
      run(sim, 30);
      expect(sim.house.hp).toBeLessThan(sim.house.maxHp);
    });

    it('a guardian on the lane eats what it is meant to eat', () => {
      const sim = makeSim();
      sim.place(FROG.id, p(0, 2));
      sim.start();
      run(sim, 20);
      const guardian = sim.guardians[0];
      expect(guardian?.kills ?? 0).toBeGreaterThan(0);
      expect(sim.house.hp).toBe(sim.house.maxHp);
    });

    it('pays a bounty for every kill', () => {
      const sim = makeSim();
      sim.place(FROG.id, p(0, 2));
      sim.start();
      const bounties: number[] = [];
      for (let i = 0; i < 20 * 60; i++) {
        sim.step(1 / 60);
        for (const e of eventsOfType(sim.drainEvents(), 'coins')) {
          if (e.reason === 'bounty') bounties.push(e.amount);
        }
      }
      expect(bounties).toEqual([5, 5, 5]);
    });

    it('off-diet attacks land, but for much less', () => {
      // A bug chewing on a frog is not on its menu — it should barely scratch.
      const sim = makeSim();
      sim.place(FROG.id, p(0, 2));
      sim.start();
      run(sim, 6);
      const attacks = eventsOfType(sim.drainEvents(), 'attack');
      const offDiet = attacks.filter((a) => !a.onDiet);
      const onDiet = attacks.filter((a) => a.onDiet);
      if (offDiet.length && onDiet.length) {
        expect(Math.max(...offDiet.map((a) => a.damage))).toBeLessThan(
          Math.max(...onDiet.map((a) => a.damage)),
        );
      }
    });

    it('wins once every wave is cleared', () => {
      const sim = makeSim();
      sim.place(FROG.id, p(0, 2));
      sim.start();
      run(sim, 60);
      expect(sim.status).toBe('won');
    });

    it('loses when the house falls', () => {
      const sim = makeSim({
        house: { position: HOUSE, hp: 10 },
        waves: [wave([entry('t.bug', 8, { spacing: 0.2, lane: 'mid' })], { reward: 10, rest: 1 })],
      });
      sim.start();
      run(sim, 40);
      expect(sim.status).toBe('lost');
      expect(sim.stars()).toBe(0);
    });

    it('pays the wave reward exactly once', () => {
      const sim = makeSim();
      sim.place(FROG.id, p(0, 2));
      sim.start();
      const rewards: number[] = [];
      for (let i = 0; i < 3600; i++) {
        sim.step(1 / 60);
        for (const e of eventsOfType(sim.drainEvents(), 'waveCleared')) rewards.push(e.reward);
      }
      expect(rewards).toEqual([30]);
    });
  });

  describe('hunger and the feral turncoat — the core mechanic', () => {
    it('drains satiety over time', () => {
      const sim = makeSim();
      sim.place(FROG.id, p(-6, 2));
      const guardian = sim.guardians[0];
      expect(guardian.satiety).toBe(1);
      run(sim, 12); // past the opening grace period
      expect(guardian.satiety).toBeLessThan(1);
    });

    it('holds satiety during the opening grace period', () => {
      const sim = makeSim();
      sim.place(FROG.id, p(-6, 2));
      run(sim, 2);
      expect(sim.guardians[0].satiety).toBe(1);
    });

    it('warns before it turns', () => {
      const sim = makeSim();
      sim.place(FROG.id, p(-6, 2));
      let warned = false;
      for (let i = 0; i < 60 * 30 && !warned; i++) {
        sim.step(1 / 60);
        warned = eventsOfType(sim.drainEvents(), 'feralWarning').length > 0;
      }
      expect(warned).toBe(true);
    });

    it('turns feral, switches sides and gets stronger', () => {
      const sim = makeSim();
      sim.place(FROG.id, p(-6, 2));
      const guardian = sim.guardians[0];
      const baseDamage = guardian.damageMul;
      run(sim, 25);
      expect(guardian.feral).toBe(true);
      expect(guardian.faction).toBe('critter');
      expect(guardian.damageMul).toBeCloseTo(baseDamage * FROG.guardian!.feralScale, 5);
      expect(sim.feralCount).toBe(1);
    });

    it('a feral guardian goes for the house', () => {
      const sim = makeSim();
      sim.place(FROG.id, p(-6, 0));
      const guardian = sim.guardians[0];
      const startDist = Math.abs(guardian.pos.z - HOUSE.z);
      run(sim, 25);
      expect(guardian.feral).toBe(true);
      expect(Math.abs(guardian.pos.z - HOUSE.z)).toBeLessThan(startDist);
    });

    it('feeding a guardian resets the clock', () => {
      // Two identical frogs; only one is on the lane and gets to eat.
      const sim = makeSim({
        waves: [wave([entry('t.bug', 20, { spacing: 0.6, lane: 'mid' })], { reward: 10, rest: 2 })],
      });
      sim.place(FROG.id, p(0, 2));
      const fedFrog = sim.guardians[0];
      run(sim, 1.1);
      sim.place(FROG.id, p(-8, 2));
      const starvedFrog = sim.guardians[1];
      sim.start();
      run(sim, 18);
      expect(fedFrog.satiety).toBeGreaterThan(starvedFrog.satiety);
    });

    it('a higher-tier guardian eats the feral one — the escalation ladder', () => {
      const sim = makeSim({ startingCoins: 500 });
      sim.place(FROG.id, p(0, 2));
      run(sim, 1.1);
      sim.place(HAWK.id, p(1.6, 2));
      const frog = sim.units.get(sim.guardians[0].id)!;
      run(sim, 25);
      expect(frog.feral).toBe(true);
      // The hawk eats frogs, so the turncoat does not survive long.
      run(sim, 10);
      expect(sim.units.has(frog.id)).toBe(false);
    });
  });

  describe('economy', () => {
    it('trickles coins even with nothing happening', () => {
      const sim = makeSim();
      const before = sim.coins;
      run(sim, 10);
      expect(sim.coins).toBeGreaterThan(before);
    });

    it('emits a coin event for every award', () => {
      const sim = makeSim();
      sim.award(50, p(0, 0), 'totem');
      const events = eventsOfType(sim.drainEvents(), 'coins');
      expect(events).toHaveLength(1);
      expect(events[0].amount).toBe(50);
    });

    it('ignores non-positive awards', () => {
      const sim = makeSim();
      const before = sim.coins;
      sim.award(0, p(0, 0), 'totem');
      sim.award(-10, p(0, 0), 'totem');
      expect(sim.coins).toBe(before);
    });
  });

  describe('stars', () => {
    it('awards a star for clearing, and more for the goals', () => {
      const sim = makeSim({ starGoals: { houseHp: 1, coins: 0, noFeral: true } });
      sim.place(FROG.id, p(0, 2));
      sim.start();
      run(sim, 60);
      expect(sim.status).toBe('won');
      expect(sim.stars()).toBe(4);
    });

    it('withholds the no-feral star when something turned', () => {
      const sim = makeSim({
        starGoals: { houseHp: 0, coins: 0, noFeral: true },
        waves: [wave([entry('t.bug', 1, { spacing: 1, lane: 'mid' })], { reward: 10, rest: 1 })],
      });
      sim.place(FROG.id, p(-8, 2));
      sim.start();
      run(sim, 60);
      expect(sim.feralCount).toBeGreaterThan(0);
      expect(sim.stars()).toBeLessThan(4);
    });
  });

  it('is deterministic: the same seed produces the same run', () => {
    const outcomes = [0, 1].map(() => {
      const sim = makeSim({
        lanes: [lane('mid', [p(0, -10), p(0, 0), HOUSE], 1), lane('side', [p(4, -10), p(2, 0), HOUSE], 1)],
        waves: [wave([entry('t.bug', 12, { spacing: 0.3 })], { reward: 20, rest: 1 })],
      });
      sim.start();
      run(sim, 25);
      return sim.outcome();
    });
    expect(outcomes[0]).toEqual(outcomes[1]);
  });

  it('clamps points into the arena', () => {
    const sim = makeSim();
    expect(sim.clampToArena(p(999, -999))).toEqual({ x: 10, z: -15 });
  });
});
