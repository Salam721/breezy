/**
 * Status rules (design.md 4.3, R4.1, R4.4, R6.4, R7.3). Pure functions, no I/O.
 *
 * - STALE when the file is older than 10 minutes by its own `generated_at`.
 *   Stale data never shows SAFE. If the user is inside a polygon of a stale
 *   file, inPlume stays true so stale data never suppresses a warning.
 * - ALERT fires once when the user enters a plume.
 * - ALL_CLEAR fires once when the user leaves, but only on FRESH data, because
 *   stale data cannot verify that the air is clear.
 */
import { isInsideAnyPlume } from '../geo/plumeCheck';
import type { AppStatus, PlumeFile, Position } from '../types';

export const STALE_AFTER_MS = 10 * 60 * 1000;

export interface StatusResult {
  status: AppStatus;
  inPlume: boolean;
  ageMs: number | null; // null when there is no file at all
}

export function computeStatus(file: PlumeFile | null, point: Position | null, now: Date): StatusResult {
  if (!file) return { status: 'STALE', inPlume: false, ageMs: null };
  const generated = Date.parse(file.generated_at);
  if (Number.isNaN(generated)) return { status: 'STALE', inPlume: false, ageMs: null };
  const ageMs = now.getTime() - generated;
  const stale = ageMs > STALE_AFTER_MS;
  const inPlume = point ? isInsideAnyPlume(point, file) : false;
  if (stale) return { status: 'STALE', inPlume, ageMs };
  return { status: inPlume ? 'IN_PLUME' : 'SAFE', inPlume, ageMs };
}

/** Age of the newest sensor reading behind the file, or null if unknown. Shown so "fresh file" is never mistaken for "live air". */
export function sensorDataAgeMs(file: PlumeFile | null, now: Date): number | null {
  if (!file?.data_as_of) return null;
  const t = Date.parse(file.data_as_of);
  return Number.isNaN(t) ? null : Math.max(0, now.getTime() - t);
}

export type AlertEvent = 'ALERT' | 'ALL_CLEAR' | null;

export interface Transition {
  event: AlertEvent;
  /** Persist this as the "was in plume" memory for the next check. */
  nextInPlume: boolean;
}

export function decideTransition(prevInPlume: boolean, cur: StatusResult): Transition {
  if (!prevInPlume && cur.inPlume) return { event: 'ALERT', nextInPlume: true };
  if (prevInPlume && !cur.inPlume) {
    if (cur.status === 'STALE') return { event: null, nextInPlume: true }; // cannot verify
    return { event: 'ALL_CLEAR', nextInPlume: false };
  }
  return { event: null, nextInPlume: prevInPlume };
}
