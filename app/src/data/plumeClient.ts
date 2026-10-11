/** Download, validate and cache plumes.json (R3.3, R3.5). The user's location is never sent. */
import type { PlumeFile } from '../types';
import type { KeyValueStore } from './storage';
import { loadPlumeCache, savePlumeCache } from './storage';

export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

function isPosition(v: unknown): boolean {
  return Array.isArray(v) && v.length >= 2 && typeof v[0] === 'number' && typeof v[1] === 'number'
    && Number.isFinite(v[0]) && Number.isFinite(v[1]);
}

/** Returns the file if it has the shape we depend on, otherwise null. */
export function validatePlumeFile(raw: unknown): PlumeFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Record<string, unknown>;
  if (f.type !== 'FeatureCollection') return null;
  if (typeof f.generated_at !== 'string' || Number.isNaN(Date.parse(f.generated_at))) return null;
  if (!Array.isArray(f.features)) return null;
  for (const feat of f.features) {
    const g = (feat as { geometry?: { type?: unknown; coordinates?: unknown } })?.geometry;
    const p = (feat as { properties?: Record<string, unknown> })?.properties;
    if (!g || g.type !== 'Polygon' || !Array.isArray(g.coordinates) || g.coordinates.length === 0) return null;
    for (const ring of g.coordinates) {
      if (!Array.isArray(ring) || ring.length < 4 || !ring.every(isPosition)) return null;
    }
    if (!p || typeof p.sensor_id !== 'number' || typeof p.pm25 !== 'number') return null;
  }
  return raw as PlumeFile;
}

export async function fetchPlumeFile(url: string, fetchImpl: FetchLike, timeoutMs = 8000): Promise<PlumeFile> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`plume download failed: HTTP ${res.status}`);
    const file = validatePlumeFile(await res.json());
    if (!file) throw new Error('plume file has an unexpected shape');
    return file;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Try to refresh the cache. On any failure the previous cache is kept untouched,
 * so its `generated_at` keeps ageing and the staleness rule applies.
 * Also ignores a downloaded file that is older than the cached one.
 */
export async function refreshPlumeCache(
  url: string,
  store: KeyValueStore,
  fetchImpl: FetchLike,
): Promise<{ file: PlumeFile | null; refreshed: boolean }> {
  const cached = await loadPlumeCache(store);
  try {
    const fresh = await fetchPlumeFile(url, fetchImpl);
    if (cached && Date.parse(cached.generated_at) > Date.parse(fresh.generated_at)) {
      return { file: cached, refreshed: false };
    }
    await savePlumeCache(store, fresh);
    return { file: fresh, refreshed: true };
  } catch {
    return { file: cached, refreshed: false };
  }
}
