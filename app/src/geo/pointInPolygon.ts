import type { Position, Ring } from '../types';

export type Location = 'inside' | 'boundary' | 'outside';

const EPS = 1e-12;

function onSegment(p: Position, a: Position, b: Position): boolean {
  const [x, y] = p;
  const cross = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
  if (Math.abs(cross) > EPS) return false;
  return (
    x >= Math.min(a[0], b[0]) - EPS &&
    x <= Math.max(a[0], b[0]) + EPS &&
    y >= Math.min(a[1], b[1]) - EPS &&
    y <= Math.max(a[1], b[1]) + EPS
  );
}

/** Ray casting on one ring. O(V) time, O(1) space. Points on the edge are 'boundary'. */
export function locateInRing(p: Position, ring: Ring): Location {
  const [x, y] = p;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (onSegment(p, a, b)) return 'boundary';
    const crosses = a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0];
    if (crosses) inside = !inside;
  }
  return inside ? 'inside' : 'outside';
}

/**
 * GeoJSON polygon = [outer, ...holes]. The boundary counts as inside, so a
 * borderline position never suppresses a warning (conservative for safety).
 */
export function pointInPolygon(p: Position, rings: Ring[]): boolean {
  if (rings.length === 0) return false;
  const outer = locateInRing(p, rings[0]);
  if (outer === 'outside') return false;
  if (outer === 'boundary') return true;
  for (let h = 1; h < rings.length; h++) {
    if (locateInRing(p, rings[h]) === 'inside') return false;
  }
  return true;
}
