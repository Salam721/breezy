import type { PlumeFile, Position, Ring } from '../types';
import { pointInPolygon } from './pointInPolygon';

export interface CompiledPlume {
  sensorId: number;
  pm25: number;
  rings: Ring[];
  bbox: [number, number, number, number]; // minLon, minLat, maxLon, maxLat
}

/** Precompute bounding boxes so most polygons are skipped with four comparisons. */
export function compilePlumes(file: PlumeFile): CompiledPlume[] {
  return file.features.map((f) => {
    const rings = f.geometry.coordinates;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of rings[0] ?? []) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return { sensorId: f.properties.sensor_id, pm25: f.properties.pm25, rings, bbox: [minX, minY, maxX, maxY] };
  });
}

/** Plumes containing the point. O(P) bbox checks + O(V) per candidate polygon. */
export function plumesContaining(p: Position, plumes: CompiledPlume[]): CompiledPlume[] {
  const [x, y] = p;
  return plumes.filter(
    (pl) =>
      x >= pl.bbox[0] && x <= pl.bbox[2] && y >= pl.bbox[1] && y <= pl.bbox[3] && pointInPolygon(p, pl.rings),
  );
}

export function isInsideAnyPlume(p: Position, file: PlumeFile): boolean {
  return plumesContaining(p, compilePlumes(file)).length > 0;
}
