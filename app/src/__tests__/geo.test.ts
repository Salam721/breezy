import { pointInPolygon, locateInRing } from '../geo/pointInPolygon';
import { compilePlumes, isInsideAnyPlume, plumesContaining } from '../geo/plumeCheck';
import type { PlumeFile, Position, Ring } from '../types';
import sample from './fixtures/plumes.sample.json';

const square: Ring = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
// concave "C" shape opening to the right
const cShape: Ring = [[0, 0], [10, 0], [10, 3], [3, 3], [3, 7], [10, 7], [10, 10], [0, 10], [0, 0]];

describe('pointInPolygon', () => {
  it('inside and outside a square', () => {
    expect(pointInPolygon([5, 5], [square])).toBe(true);
    expect(pointInPolygon([11, 5], [square])).toBe(false);
    expect(pointInPolygon([-1, 5], [square])).toBe(false);
    expect(pointInPolygon([5, 11], [square])).toBe(false);
  });
  it('counts the boundary and vertices as inside (conservative)', () => {
    expect(locateInRing([10, 5], square)).toBe('boundary');
    expect(pointInPolygon([10, 5], [square])).toBe(true);
    expect(pointInPolygon([0, 0], [square])).toBe(true);
    expect(pointInPolygon([5, 0], [square])).toBe(true);
  });
  it('handles a concave polygon', () => {
    expect(pointInPolygon([1, 5], [cShape])).toBe(true); // spine of the C
    expect(pointInPolygon([6, 5], [cShape])).toBe(false); // inside the notch
    expect(pointInPolygon([6, 1], [cShape])).toBe(true); // lower arm
  });
  it('respects holes', () => {
    const hole: Ring = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]];
    expect(pointInPolygon([5, 5], [square, hole])).toBe(false);
    expect(pointInPolygon([2, 2], [square, hole])).toBe(true);
    expect(pointInPolygon([4, 5], [square, hole])).toBe(true); // hole edge counts as inside
  });
  it('empty rings are never inside', () => {
    expect(pointInPolygon([0, 0], [])).toBe(false);
  });
});

const M = 111_320; // metres per degree (same flat approximation as the pipeline)
const east = (m: number, lat = 33.75, lon = -84.4): Position => [lon + m / (M * Math.cos((lat * Math.PI) / 180)), lat];

describe('plume check against a file made by the Python pipeline', () => {
  const file = sample as unknown as PlumeFile;
  it('west wind: downwind (east) of the sensor is inside, upwind is outside', () => {
    expect(isInsideAnyPlume(east(1000), file)).toBe(true);
    expect(isInsideAnyPlume(east(-1000), file)).toBe(false);
  });
  it('reach matches the generated cone length (5 m/s x 600 s = 3000 m)', () => {
    expect(isInsideAnyPlume(east(2900), file)).toBe(true);
    expect(isInsideAnyPlume(east(3100), file)).toBe(false);
  });
  it('a point far from every sensor is outside', () => {
    expect(isInsideAnyPlume([-85.5, 34.5], file)).toBe(false);
  });
  it('an empty file contains nothing', () => {
    expect(isInsideAnyPlume([0, 0], { ...file, features: [] })).toBe(false);
  });
  it('reports which plumes contain the point', () => {
    const hits = plumesContaining(east(500), compilePlumes(file));
    expect(hits.map((h) => h.sensorId)).toEqual([11]);
  });
});

describe('speed (target <50 ms, measured, not assumed)', () => {
  it('1000 polygons of 10 vertices', () => {
    const features = Array.from({ length: 1000 }, (_, i) => ({
      type: 'Feature' as const,
      properties: { sensor_id: i, location_id: i, pm25: 50, observed_at: '2026-10-10T22:30:00Z' },
      geometry: { type: 'Polygon' as const, coordinates: [[[i, 0], [i + 1, 0], [i + 1.5, 0.5], [i + 1, 1], [i, 1], [i - 0.5, 0.5], [i, 0]] as Ring] },
    }));
    const file: PlumeFile = { type: 'FeatureCollection', generated_at: '2026-10-10T22:30:00Z', features };
    const t0 = Date.now();
    const compiled = compilePlumes(file);
    plumesContaining([500.5, 0.5], compiled);
    const ms = Date.now() - t0;
    console.log(`1000-polygon compile+check took ${ms} ms on this machine`);
    expect(ms).toBeLessThan(50);
  });
});
