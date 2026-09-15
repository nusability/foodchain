import { describe, expect, it } from 'vitest';
import {
  angleDelta,
  clamp,
  clamp01,
  damp,
  dist,
  invLerp,
  lerp,
  normalize,
  pathLength,
  pointAtDistance,
  towards,
  v2,
} from './math';

describe('math', () => {
  it('clamps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
  });

  it('lerps and inverse-lerps', () => {
    expect(lerp(0, 10, 0.25)).toBe(2.5);
    expect(invLerp(0, 10, 2.5)).toBe(0.25);
    expect(invLerp(5, 5, 5)).toBe(0);
  });

  it('damp converges without overshooting', () => {
    let v = 0;
    for (let i = 0; i < 200; i++) v = damp(v, 10, 8, 1 / 60);
    expect(v).toBeGreaterThan(9.9);
    expect(v).toBeLessThanOrEqual(10);
  });

  it('damp is stable at large dt', () => {
    expect(damp(0, 10, 8, 10)).toBeLessThanOrEqual(10);
  });

  it('normalizes, including the degenerate case', () => {
    expect(normalize(v2(3, 4))).toEqual({ x: 0.6, z: 0.8 });
    expect(normalize(v2(0, 0))).toEqual({ x: 0, z: 0 });
  });

  it('towards points from a to b', () => {
    expect(towards(v2(0, 0), v2(0, 5))).toEqual({ x: 0, z: 1 });
  });

  describe('polyline walking', () => {
    const path = [v2(0, 0), v2(0, 10), v2(10, 10)];

    it('measures total length', () => {
      expect(pathLength(path)).toBe(20);
    });

    it('walks the path', () => {
      expect(pointAtDistance(path, 0)).toEqual({ x: 0, z: 0 });
      expect(pointAtDistance(path, 5)).toEqual({ x: 0, z: 5 });
      expect(pointAtDistance(path, 15)).toEqual({ x: 5, z: 10 });
    });

    it('clamps past both ends rather than extrapolating', () => {
      expect(pointAtDistance(path, -3)).toEqual({ x: 0, z: 0 });
      expect(pointAtDistance(path, 999)).toEqual({ x: 10, z: 10 });
    });

    it('handles degenerate paths', () => {
      expect(pointAtDistance([], 4)).toEqual({ x: 0, z: 0 });
      expect(pointAtDistance([v2(2, 2)], 4)).toEqual({ x: 2, z: 2 });
      expect(pathLength([v2(1, 1), v2(1, 1)])).toBe(0);
    });

    it('never jumps: stepping along is continuous', () => {
      const total = pathLength(path);
      let prev = pointAtDistance(path, 0);
      for (let d = 0.25; d <= total; d += 0.25) {
        const next = pointAtDistance(path, d);
        expect(dist(prev, next)).toBeLessThan(0.3);
        prev = next;
      }
    });
  });

  it('angleDelta takes the short way round', () => {
    expect(angleDelta(0, Math.PI * 1.9)).toBeCloseTo(-Math.PI * 0.1, 5);
    expect(angleDelta(Math.PI * 1.9, 0)).toBeCloseTo(Math.PI * 0.1, 5);
  });
});
