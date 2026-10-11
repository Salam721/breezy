import { runCheck } from '../engine/checkEngine';
import type { CheckDeps } from '../engine/checkEngine';
import { MemoryStore, loadLastInPlume, savePlumeCache } from '../data/storage';
import type { PlumeFile, Ring } from '../types';

const ring: Ring = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
const NOW = new Date('2026-10-10T22:30:00Z');
const minsAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const file = (mins: number, withPlume = true): PlumeFile => ({
  type: 'FeatureCollection',
  generated_at: minsAgo(mins),
  features: withPlume
    ? [{ type: 'Feature', properties: { sensor_id: 1, location_id: 1, pm25: 60, observed_at: minsAgo(mins) }, geometry: { type: 'Polygon', coordinates: [ring] } }]
    : [],
});
const INSIDE: [number, number] = [5, 5];
const OUTSIDE: [number, number] = [50, 50];

function setup(over: Partial<CheckDeps> = {}) {
  const calls = { alert: 0, allClear: 0, audio: 0, logs: [] as string[] };
  const deps: CheckDeps = {
    store: new MemoryStore(),
    fetchImpl: async () => { throw new Error('offline'); },
    plumeUrl: '',
    fileOverride: file(1),
    notifyAlert: async () => { calls.alert++; },
    notifyAllClear: async () => { calls.allClear++; },
    playAudio: async () => { calls.audio++; },
    headphonesConnected: () => false,
    now: () => NOW,
    log: (m) => { calls.logs.push(m); },
    ...over,
  };
  return { deps, calls };
}

describe('runCheck', () => {
  it('entering a plume without headphones sends one notification', async () => {
    const { deps, calls } = setup();
    const r = await runCheck(INSIDE, deps);
    expect(r.event).toBe('ALERT');
    expect(r.delivered).toBe('notification');
    expect(calls).toMatchObject({ alert: 1, audio: 0 });
    // staying inside does not repeat the alert
    const r2 = await runCheck(INSIDE, deps);
    expect(r2.event).toBeNull();
    expect(calls.alert).toBe(1);
  });

  it('with headphones the audio plays INSTEAD of the visual alert (R4.2)', async () => {
    const { deps, calls } = setup({ headphonesConnected: () => true });
    const r = await runCheck(INSIDE, deps);
    expect(r.delivered).toBe('audio');
    expect(calls).toMatchObject({ audio: 1, alert: 0 });
  });

  it('audio failure falls back to the notification', async () => {
    const { deps, calls } = setup({ headphonesConnected: () => true, playAudio: async () => { throw new Error('no audio'); } });
    const r = await runCheck(INSIDE, deps);
    expect(r.delivered).toBe('notification');
    expect(calls.alert).toBe(1);
  });

  it('headphone detection error is treated as "not connected"', async () => {
    const { deps, calls } = setup({ headphonesConnected: () => { throw new Error('native module missing'); } });
    const r = await runCheck(INSIDE, deps);
    expect(r.delivered).toBe('notification');
    expect(calls.audio).toBe(0);
  });

  it('notification failure is logged and does not throw', async () => {
    const { deps, calls } = setup({ notifyAlert: async () => { throw new Error('denied'); } });
    const r = await runCheck(INSIDE, deps);
    expect(r.delivered).toBe('none');
    expect(calls.logs.some((l) => l.includes('alert notification failed'))).toBe(true);
  });

  it('leaving the plume on fresh data sends one All Clear', async () => {
    const { deps, calls } = setup();
    await runCheck(INSIDE, deps);
    const r = await runCheck(OUTSIDE, deps);
    expect(r.event).toBe('ALL_CLEAR');
    expect(calls.allClear).toBe(1);
    expect(await loadLastInPlume(deps.store)).toBe(false);
    expect((await runCheck(OUTSIDE, deps)).event).toBeNull();
  });

  it('no All Clear from stale data; it comes once fresh data confirms', async () => {
    const { deps, calls } = setup();
    await runCheck(INSIDE, deps);
    deps.fileOverride = file(30, false);
    const stale = await runCheck(OUTSIDE, deps);
    expect(stale.event).toBeNull();
    expect(stale.status.status).toBe('STALE');
    expect(calls.allClear).toBe(0);
    deps.fileOverride = file(1, false);
    expect((await runCheck(OUTSIDE, deps)).event).toBe('ALL_CLEAR');
  });

  it('wind shift (plume removed from the new file) sends All Clear', async () => {
    const { deps } = setup();
    await runCheck(INSIDE, deps);
    deps.fileOverride = file(0, false);
    expect((await runCheck(INSIDE, deps)).event).toBe('ALL_CLEAR');
  });

  it('downloads and caches when a URL is set, and falls back to the cache offline', async () => {
    const store = new MemoryStore();
    const f = file(1);
    const ok = async () => ({ ok: true, status: 200, json: async () => f });
    const a = setup({ store, plumeUrl: 'https://x/plumes.json', fileOverride: undefined, fetchImpl: ok });
    const r1 = await runCheck(INSIDE, a.deps);
    expect(r1.refreshed).toBe(true);
    expect(r1.event).toBe('ALERT');
    const b = setup({ store, plumeUrl: 'https://x/plumes.json', fileOverride: undefined });
    const r2 = await runCheck(INSIDE, b.deps);
    expect(r2.refreshed).toBe(false);
    expect(r2.file?.generated_at).toBe(f.generated_at);
  });

  it('nothing cached and no URL gives STALE and no alert', async () => {
    const { deps } = setup({ fileOverride: undefined });
    const r = await runCheck(INSIDE, deps);
    expect(r.status.status).toBe('STALE');
    expect(r.event).toBeNull();
  });

  it('uses the cache directly when no URL is configured', async () => {
    const store = new MemoryStore();
    await savePlumeCache(store, file(1));
    const { deps } = setup({ store, fileOverride: undefined });
    expect((await runCheck(INSIDE, deps)).event).toBe('ALERT');
  });
});
