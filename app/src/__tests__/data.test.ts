import { fetchPlumeFile, refreshPlumeCache, validatePlumeFile } from '../data/plumeClient';
import type { FetchLike } from '../data/plumeClient';
import {
  KEYS, MemoryStore, addImpactEvent, loadImpactEvents, loadLastInPlume, loadPlumeCache, loadProfile,
  saveLastInPlume, saveProfile, summarizeImpact,
} from '../data/storage';
import type { PlumeFile } from '../types';
import sample from './fixtures/plumes.sample.json';

const good = sample as unknown as PlumeFile;
const okFetch = (body: unknown): FetchLike => async () => ({ ok: true, status: 200, json: async () => body });
const badFetch: FetchLike = async () => ({ ok: false, status: 503, json: async () => ({}) });
const throwingFetch: FetchLike = async () => { throw new Error('offline'); };

describe('validatePlumeFile', () => {
  it('accepts a file made by the pipeline', () => {
    expect(validatePlumeFile(good)).not.toBeNull();
  });
  it('accepts an empty feature list', () => {
    expect(validatePlumeFile({ ...good, features: [] })).not.toBeNull();
  });
  it('rejects bad shapes', () => {
    expect(validatePlumeFile(null)).toBeNull();
    expect(validatePlumeFile({})).toBeNull();
    expect(validatePlumeFile({ ...good, type: 'Feature' })).toBeNull();
    expect(validatePlumeFile({ ...good, generated_at: 'nope' })).toBeNull();
    expect(validatePlumeFile({ ...good, features: 'x' })).toBeNull();
    const broken = JSON.parse(JSON.stringify(good));
    broken.features[0].geometry.coordinates[0][1] = ['a', 'b'];
    expect(validatePlumeFile(broken)).toBeNull();
    const tiny = JSON.parse(JSON.stringify(good));
    tiny.features[0].geometry.coordinates[0] = [[0, 0], [1, 1]];
    expect(validatePlumeFile(tiny)).toBeNull();
  });
});

describe('fetchPlumeFile', () => {
  it('returns a validated file', async () => {
    expect((await fetchPlumeFile('https://x', okFetch(good))).generated_at).toBe(good.generated_at);
  });
  it('throws on HTTP error and on a bad shape', async () => {
    await expect(fetchPlumeFile('https://x', badFetch)).rejects.toThrow('HTTP 503');
    await expect(fetchPlumeFile('https://x', okFetch({ nope: 1 }))).rejects.toThrow('unexpected shape');
  });
});

describe('refreshPlumeCache', () => {
  it('stores a fresh download', async () => {
    const store = new MemoryStore();
    const r = await refreshPlumeCache('https://x', store, okFetch(good));
    expect(r.refreshed).toBe(true);
    expect((await loadPlumeCache(store))?.generated_at).toBe(good.generated_at);
  });
  it('offline: keeps the previous cache unchanged', async () => {
    const store = new MemoryStore();
    await refreshPlumeCache('https://x', store, okFetch(good));
    const r = await refreshPlumeCache('https://x', store, throwingFetch);
    expect(r.refreshed).toBe(false);
    expect(r.file?.generated_at).toBe(good.generated_at);
  });
  it('invalid download does not overwrite a good cache', async () => {
    const store = new MemoryStore();
    await refreshPlumeCache('https://x', store, okFetch(good));
    const r = await refreshPlumeCache('https://x', store, okFetch({ junk: true }));
    expect(r.refreshed).toBe(false);
    expect((await loadPlumeCache(store))?.generated_at).toBe(good.generated_at);
  });
  it('ignores a downloaded file older than the cached one', async () => {
    const store = new MemoryStore();
    await refreshPlumeCache('https://x', store, okFetch(good));
    const older = { ...good, generated_at: '2026-10-10T20:00:00Z' };
    const r = await refreshPlumeCache('https://x', store, okFetch(older));
    expect(r.refreshed).toBe(false);
    expect(r.file?.generated_at).toBe(good.generated_at);
  });
  it('nothing cached and offline gives null (the app shows Stale/Unverified)', async () => {
    const r = await refreshPlumeCache('https://x', new MemoryStore(), throwingFetch);
    expect(r.file).toBeNull();
  });
});

describe('storage', () => {
  it('profile round trip', async () => {
    const s = new MemoryStore();
    expect(await loadProfile(s)).toBeNull();
    await saveProfile(s, { baselineSurvey: { nightSymptoms: true }, createdAt: '2026-10-10T00:00:00Z' });
    expect((await loadProfile(s))?.baselineSurvey.nightSymptoms).toBe(true);
  });
  it('corrupt stored value behaves as absent', async () => {
    const s = new MemoryStore();
    await s.setItem(KEYS.profile, '{not json');
    expect(await loadProfile(s)).toBeNull();
    await s.setItem(KEYS.impactEvents, 'garbage');
    expect(await loadImpactEvents(s)).toEqual([]);
  });
  it('impact events persist and summarize', async () => {
    const s = new MemoryStore();
    await addImpactEvent(s, 'inhaler', new Date('2026-10-10T10:00:00Z'));
    await addImpactEvent(s, 'inhaler', new Date('2026-10-10T11:00:00Z'));
    await addImpactEvent(s, 'closed_windows', new Date('2026-10-10T12:00:00Z'));
    await addImpactEvent(s, 'rerouted', new Date('2026-10-10T09:00:00Z'));
    const sum = summarizeImpact(await loadImpactEvents(s));
    expect(sum).toEqual({ inhaler: 2, closed_windows: 1, rerouted: 1, total: 4, lastAt: '2026-10-10T12:00:00.000Z' });
  });
  it('empty summary', () => {
    expect(summarizeImpact([])).toEqual({ inhaler: 0, closed_windows: 0, rerouted: 0, total: 0, lastAt: null });
  });
  it('lastInPlume defaults false and persists', async () => {
    const s = new MemoryStore();
    expect(await loadLastInPlume(s)).toBe(false);
    await saveLastInPlume(s, true);
    expect(await loadLastInPlume(s)).toBe(true);
  });
});
