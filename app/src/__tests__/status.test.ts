import { computeStatus, decideTransition, sensorDataAgeMs, STALE_AFTER_MS } from '../status/statusMachine';
import type { PlumeFile, Ring } from '../types';

const ring: Ring = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
const NOW = new Date('2026-10-10T22:30:00Z');
const mk = (generatedAt: string, withPlume = true): PlumeFile => ({
  type: 'FeatureCollection',
  generated_at: generatedAt,
  features: withPlume
    ? [{ type: 'Feature', properties: { sensor_id: 1, location_id: 1, pm25: 60, observed_at: generatedAt }, geometry: { type: 'Polygon', coordinates: [ring] } }]
    : [],
});
const minsAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

describe('computeStatus', () => {
  it('fresh and outside is SAFE', () => {
    expect(computeStatus(mk(minsAgo(1)), [50, 50], NOW).status).toBe('SAFE');
  });
  it('fresh and inside is IN_PLUME', () => {
    const r = computeStatus(mk(minsAgo(1)), [5, 5], NOW);
    expect(r.status).toBe('IN_PLUME');
    expect(r.inPlume).toBe(true);
  });
  it('9 minutes is fresh, exactly 10 is still fresh, 10 min 1 s is stale', () => {
    expect(computeStatus(mk(minsAgo(9)), [50, 50], NOW).status).toBe('SAFE');
    expect(computeStatus(mk(minsAgo(10)), [50, 50], NOW).status).toBe('SAFE');
    const justOver = new Date(NOW.getTime() - STALE_AFTER_MS - 1000).toISOString();
    expect(computeStatus(mk(justOver), [50, 50], NOW).status).toBe('STALE');
  });
  it('stale data never shows SAFE, even when the user is outside', () => {
    expect(computeStatus(mk(minsAgo(30)), [50, 50], NOW).status).toBe('STALE');
  });
  it('stale data does not suppress a warning: inside an old polygon, inPlume stays true', () => {
    const r = computeStatus(mk(minsAgo(30)), [5, 5], NOW);
    expect(r.status).toBe('STALE');
    expect(r.inPlume).toBe(true);
  });
  it('no file, bad timestamp, or no location', () => {
    expect(computeStatus(null, [5, 5], NOW)).toEqual({ status: 'STALE', inPlume: false, ageMs: null });
    expect(computeStatus(mk('not-a-date'), [5, 5], NOW).status).toBe('STALE');
    expect(computeStatus(mk(minsAgo(1)), null, NOW).status).toBe('SAFE');
  });
  it('an empty fresh file is SAFE (no active plumes)', () => {
    expect(computeStatus(mk(minsAgo(1), false), [5, 5], NOW).status).toBe('SAFE');
  });
});

describe('sensorDataAgeMs', () => {
  it('reports how old the newest sensor reading is, separate from the file age', () => {
    const f = { ...mk(minsAgo(1)), data_as_of: minsAgo(58) };
    expect(sensorDataAgeMs(f, NOW)).toBe(58 * 60_000);
  });
  it('is null when unknown or invalid', () => {
    expect(sensorDataAgeMs(null, NOW)).toBeNull();
    expect(sensorDataAgeMs(mk(minsAgo(1)), NOW)).toBeNull();
    expect(sensorDataAgeMs({ ...mk(minsAgo(1)), data_as_of: 'bad' }, NOW)).toBeNull();
  });
});

describe('decideTransition', () => {
  const fresh = (inPlume: boolean) => computeStatus(mk(minsAgo(1), inPlume), [5, 5], NOW);
  const stale = (withPlume: boolean) => computeStatus(mk(minsAgo(30), withPlume), [5, 5], NOW);

  it('ALERT once on entering', () => {
    expect(decideTransition(false, fresh(true))).toEqual({ event: 'ALERT', nextInPlume: true });
    expect(decideTransition(true, fresh(true))).toEqual({ event: null, nextInPlume: true });
  });
  it('ALL_CLEAR once on leaving, on fresh data', () => {
    expect(decideTransition(true, fresh(false))).toEqual({ event: 'ALL_CLEAR', nextInPlume: false });
    expect(decideTransition(false, fresh(false))).toEqual({ event: null, nextInPlume: false });
  });
  it('no ALL_CLEAR from stale data; the memory is kept so a later fresh check can clear', () => {
    expect(decideTransition(true, stale(false))).toEqual({ event: null, nextInPlume: true });
    expect(decideTransition(true, fresh(false)).event).toBe('ALL_CLEAR');
  });
  it('ALERT can come from a stale file (never suppress a warning)', () => {
    expect(decideTransition(false, stale(true)).event).toBe('ALERT');
  });
  it('wind shift: plumes disappear from the new file, so the user gets ALL_CLEAR', () => {
    expect(decideTransition(true, computeStatus(mk(minsAgo(0), false), [5, 5], NOW)).event).toBe('ALL_CLEAR');
  });
});
