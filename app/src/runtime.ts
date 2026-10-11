import AsyncStorage from '@react-native-async-storage/async-storage';
import { playAlertClip } from './alerts/audio';
import { headphonesConnected } from './alerts/headphones';
import { notifyAlert, notifyAllClear } from './alerts/notify';
import { PLUME_URL } from './config';
import { appendLog } from './data/debugLog';
import type { FetchLike } from './data/plumeClient';
import type { CheckDeps } from './engine/checkEngine';

export const store = AsyncStorage;

/** Real (non-mock) dependencies for a location check. */
export function realDeps(over: Partial<CheckDeps> = {}): CheckDeps {
  return {
    store,
    fetchImpl: fetch as unknown as FetchLike,
    plumeUrl: PLUME_URL,
    notifyAlert,
    notifyAllClear,
    playAudio: playAlertClip,
    headphonesConnected,
    log: (m) => appendLog(store, m),
    ...over,
  };
}
