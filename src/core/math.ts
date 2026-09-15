export interface Vec2 {
  x: number;
  z: number;
}

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const clamp01 = (v: number): number => clamp(v, 0, 1);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const invLerp = (a: number, b: number, v: number): number =>
  a === b ? 0 : clamp01((v - a) / (b - a));

/** Frame-rate independent exponential smoothing. */
export const damp = (a: number, b: number, lambda: number, dt: number): number =>
  lerp(a, b, 1 - Math.exp(-lambda * dt));

export const dist2 = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
};

export const dist = (a: Vec2, b: Vec2): number => Math.sqrt(dist2(a, b));

export const v2 = (x = 0, z = 0): Vec2 => ({ x, z });

export function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.z);
  return len < 1e-6 ? { x: 0, z: 0 } : { x: v.x / len, z: v.z / len };
}

export function towards(from: Vec2, to: Vec2): Vec2 {
  return normalize({ x: to.x - from.x, z: to.z - from.z });
}

/** Total length of a polyline. */
export function pathLength(points: readonly Vec2[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
}

/**
 * Point at `distance` along a polyline, clamped to the ends.
 * Used by the lane walker — every crawling animal is just a distance-along-path.
 */
export function pointAtDistance(points: readonly Vec2[], distance: number): Vec2 {
  if (points.length === 0) return v2();
  if (points.length === 1 || distance <= 0) return { ...points[0] };
  let remaining = distance;
  for (let i = 1; i < points.length; i++) {
    const seg = dist(points[i - 1], points[i]);
    if (remaining <= seg) {
      const t = seg === 0 ? 0 : remaining / seg;
      return {
        x: lerp(points[i - 1].x, points[i].x, t),
        z: lerp(points[i - 1].z, points[i].z, t),
      };
    }
    remaining -= seg;
  }
  return { ...points[points.length - 1] };
}

/** Shortest signed angular difference, in radians. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
