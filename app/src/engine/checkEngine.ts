/**
 * One location check (R3.4, R4.1 to R4.4). Used by the background task and the
 * foreground screens. All side effects are injected so the logic is testable.
 * Never throws: a failed refresh, notification or audio call is logged and the
 * check continues, so one failure cannot silence the others.
 */
import { refreshPlumeCache } from '../data/plumeClient';
import type { FetchLike } from '../data/plumeClient';
import type { KeyValueStore } from '../data/storage';
import { loadLastInPlume, loadPlumeCache, saveLastInPlume } from '../data/storage';
import { computeStatus, decideTransition } from '../status/statusMachine';
import type { AlertEvent, StatusResult } from '../status/statusMachine';
import type { PlumeFile, Position } from '../types';

export interface CheckDeps {
  store: KeyValueStore;
  fetchImpl: FetchLike;
  /** Empty string = do not download; use the cache only. */
  plumeUrl: string;
  /** Mock mode supplies the file directly and skips the cache and download. */
  fileOverride?: PlumeFile | null;
  notifyAlert: () => Promise<void>;
  notifyAllClear: () => Promise<void>;
  playAudio: () => Promise<void>;
  headphonesConnected: () => boolean | Promise<boolean>;
  now?: () => Date;
  log?: (msg: string) => void | Promise<void>;
}

export type Delivered = 'audio' | 'notification' | 'none';

export interface CheckResult {
  status: StatusResult;
  event: AlertEvent;
  delivered: Delivered;
  file: PlumeFile | null;
  refreshed: boolean;
}

export async function runCheck(point: Position, deps: CheckDeps): Promise<CheckResult> {
  const log = async (m: string) => {
    try { await deps.log?.(m); } catch { /* logging must never break a check */ }
  };
  const now = (deps.now ?? (() => new Date()))();

  let file: PlumeFile | null;
  let refreshed = false;
  if (deps.fileOverride !== undefined) {
    file = deps.fileOverride;
  } else if (deps.plumeUrl) {
    const r = await refreshPlumeCache(deps.plumeUrl, deps.store, deps.fetchImpl);
    file = r.file;
    refreshed = r.refreshed;
    await log(refreshed ? 'plume file refreshed' : 'plume refresh failed or not newer; using cache');
  } else {
    file = await loadPlumeCache(deps.store);
  }

  const status = computeStatus(file, point, now);
  const prev = await loadLastInPlume(deps.store);
  const { event, nextInPlume } = decideTransition(prev, status);
  await saveLastInPlume(deps.store, nextInPlume);

  let delivered: Delivered = 'none';
  if (event === 'ALERT') {
    let wantAudio = false;
    try { wantAudio = await deps.headphonesConnected(); } catch { await log('headphone check failed'); }
    if (wantAudio) {
      try {
        await deps.playAudio();
        delivered = 'audio'; // R4.2: audio replaces the visual alert when headphones are connected
      } catch { await log('audio failed; falling back to notification'); }
    }
    if (delivered === 'none') {
      try { await deps.notifyAlert(); delivered = 'notification'; } catch { await log('alert notification failed'); }
    }
  } else if (event === 'ALL_CLEAR') {
    try { await deps.notifyAllClear(); delivered = 'notification'; } catch { await log('all-clear notification failed'); }
  }
  await log(`status=${status.status} inPlume=${status.inPlume} event=${event ?? '-'} delivered=${delivered}`);
  return { status, event, delivered, file, refreshed };
}
