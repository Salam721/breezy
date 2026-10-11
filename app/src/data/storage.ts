/** On-device storage only (R5.2, NFR-3.2). Nothing here is ever uploaded. */
import type { ImpactEvent, ImpactEventType, ImpactSummary, PlumeFile, Profile } from '../types';

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const KEYS = {
  profile: 'breezy.profile',
  impactEvents: 'breezy.impactEvents',
  plumeCache: 'breezy.plumeCache',
  lastInPlume: 'breezy.lastInPlume',
} as const;

async function readJson<T>(store: KeyValueStore, key: string): Promise<T | null> {
  const raw = await store.getItem(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null; // corrupt value: behave as if absent
  }
}

export const loadProfile = (s: KeyValueStore) => readJson<Profile>(s, KEYS.profile);
export const saveProfile = (s: KeyValueStore, p: Profile) => s.setItem(KEYS.profile, JSON.stringify(p));

export async function loadImpactEvents(s: KeyValueStore): Promise<ImpactEvent[]> {
  return (await readJson<ImpactEvent[]>(s, KEYS.impactEvents)) ?? [];
}

export async function addImpactEvent(s: KeyValueStore, type: ImpactEventType, now: Date = new Date()): Promise<ImpactEvent[]> {
  const events = await loadImpactEvents(s);
  events.push({ type, at: now.toISOString() });
  await s.setItem(KEYS.impactEvents, JSON.stringify(events));
  return events;
}

export function summarizeImpact(events: ImpactEvent[]): ImpactSummary {
  const out: ImpactSummary = { inhaler: 0, closed_windows: 0, rerouted: 0, total: 0, lastAt: null };
  for (const e of events) {
    if (e.type in out) (out as any)[e.type] += 1;
    out.total += 1;
    if (out.lastAt === null || e.at > out.lastAt) out.lastAt = e.at;
  }
  return out;
}

export const loadPlumeCache = (s: KeyValueStore) => readJson<PlumeFile>(s, KEYS.plumeCache);
export const savePlumeCache = (s: KeyValueStore, f: PlumeFile) => s.setItem(KEYS.plumeCache, JSON.stringify(f));

export async function loadLastInPlume(s: KeyValueStore): Promise<boolean> {
  return (await s.getItem(KEYS.lastInPlume)) === '1';
}
export const saveLastInPlume = (s: KeyValueStore, v: boolean) => s.setItem(KEYS.lastInPlume, v ? '1' : '0');

/** In-memory store for tests and mock mode. */
export class MemoryStore implements KeyValueStore {
  private m = new Map<string, string>();
  async getItem(k: string) { return this.m.has(k) ? (this.m.get(k) as string) : null; }
  async setItem(k: string, v: string) { this.m.set(k, v); }
  async removeItem(k: string) { this.m.delete(k); }
}
