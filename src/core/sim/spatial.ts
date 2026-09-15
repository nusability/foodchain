/**
 * Uniform grid for neighbour queries.
 *
 * "Masses of enemies" is a design pillar, so the naive O(n^2) target search
 * is not an option. Cell size should be roughly the largest attack range in
 * play; queries then touch a 3x3 block of cells.
 */
import type { Vec2 } from '@/core/math';

export class SpatialHash<T> {
  private readonly cells = new Map<number, T[]>();

  constructor(
    private readonly cellSize: number,
    private readonly getPos: (item: T) => Vec2,
  ) {
    if (cellSize <= 0) throw new Error('SpatialHash: cellSize must be > 0');
  }

  private key(cx: number, cz: number): number {
    return ((cx + 0x8000) << 16) | ((cz + 0x8000) & 0xffff);
  }

  clear(): void {
    this.cells.clear();
  }

  insert(item: T): void {
    const p = this.getPos(item);
    const k = this.key(Math.floor(p.x / this.cellSize), Math.floor(p.z / this.cellSize));
    const bucket = this.cells.get(k);
    if (bucket) bucket.push(item);
    else this.cells.set(k, [item]);
  }

  rebuild(items: Iterable<T>): void {
    this.clear();
    for (const item of items) this.insert(item);
  }

  /** Everything in the cells overlapping the query disc (a superset of the disc). */
  queryNear(point: Vec2, radius: number, out: T[] = []): T[] {
    out.length = 0;
    const minX = Math.floor((point.x - radius) / this.cellSize);
    const maxX = Math.floor((point.x + radius) / this.cellSize);
    const minZ = Math.floor((point.z - radius) / this.cellSize);
    const maxZ = Math.floor((point.z + radius) / this.cellSize);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const bucket = this.cells.get(this.key(cx, cz));
        if (bucket) for (const item of bucket) out.push(item);
      }
    }
    return out;
  }

  get size(): number {
    let n = 0;
    for (const bucket of this.cells.values()) n += bucket.length;
    return n;
  }
}
