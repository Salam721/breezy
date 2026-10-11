/** Small on-device log so background runs can be inspected later (task T2). Never uploaded. */
import type { KeyValueStore } from './storage';

export const DEBUG_LOG_KEY = 'breezy.debugLog';
export const PROBE_KEY = 'breezy.probeMode';
const MAX = 80;

export async function appendLog(store: KeyValueStore, msg: string, now: Date = new Date()): Promise<void> {
  let list: string[] = [];
  try {
    list = JSON.parse((await store.getItem(DEBUG_LOG_KEY)) ?? '[]');
    if (!Array.isArray(list)) list = [];
  } catch {
    list = [];
  }
  list.push(`${now.toISOString().slice(11, 19)}Z ${msg}`);
  await store.setItem(DEBUG_LOG_KEY, JSON.stringify(list.slice(-MAX)));
}

export async function readLog(store: KeyValueStore): Promise<string[]> {
  try {
    const v = JSON.parse((await store.getItem(DEBUG_LOG_KEY)) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export const clearLog = (store: KeyValueStore) => store.removeItem(DEBUG_LOG_KEY);
