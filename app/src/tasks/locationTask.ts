/**
 * Background location task (R3.2). Import this module from index.ts so
 * TaskManager.defineTask runs in the global scope at startup (required by Expo).
 *
 * T2 probe mode (set from the Device test screen) additionally tries, from inside
 * the background task: a network fetch, a local notification and a headphone
 * check, and logs what worked. That settles the [U] items in design.md section 7.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { notifyTest } from '../alerts/notify';
import { currentAudioOutputs, headphonesConnected } from '../alerts/headphones';
import { PLUME_URL } from '../config';
import { appendLog, PROBE_KEY } from '../data/debugLog';
import { runCheck } from '../engine/checkEngine';
import { realDeps, store } from '../runtime';

export const LOCATION_TASK = 'breezy-location-task';

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody<unknown>) => {
  try {
    if (error) {
      await appendLog(store, `task error: ${error.message}`);
      return;
    }
    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations ?? [];
    const last = locations[locations.length - 1];
    if (!last) return;
    const point: [number, number] = [last.coords.longitude, last.coords.latitude];
    await appendLog(store, `task fired: ${locations.length} fix(es), accuracy ${Math.round(last.coords.accuracy ?? -1)} m`);

    if ((await store.getItem(PROBE_KEY)) === '1') {
      // Probe 1: network from the background
      try {
        if (!PLUME_URL) throw new Error('EXPO_PUBLIC_PLUME_URL is empty');
        const res = await fetch(PLUME_URL);
        await appendLog(store, `probe fetch: HTTP ${res.status}`);
      } catch (e) {
        await appendLog(store, `probe fetch FAILED: ${(e as Error).message}`);
      }
      // Probe 2: local notification from the background
      try {
        await notifyTest(`Background task ran ${new Date().toLocaleTimeString()}`);
        await appendLog(store, 'probe notification: scheduled');
      } catch (e) {
        await appendLog(store, `probe notification FAILED: ${(e as Error).message}`);
      }
      // Probe 3: headphones from the background
      await appendLog(store, `probe headphones: ${headphonesConnected()} outputs=${currentAudioOutputs().join(',') || 'none'}`);
    }

    await runCheck(point, realDeps());
  } catch (e) {
    await appendLog(store, `task crashed: ${(e as Error).message}`);
  }
});

export type PermissionState = { foreground: string; background: string };

export async function getPermissionState(): Promise<PermissionState> {
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await Location.getBackgroundPermissionsAsync();
  return { foreground: fg.status, background: bg.status };
}

/** Foreground first, then background ("Always"); iOS may still grant only "When In Use". */
export async function requestLocationPermissions(): Promise<PermissionState> {
  await Location.requestForegroundPermissionsAsync();
  await Location.requestBackgroundPermissionsAsync();
  return getPermissionState();
}

export async function startTracking(): Promise<void> {
  const state = await getPermissionState();
  if (state.foreground !== 'granted') throw new Error('Location permission not granted');
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (started) return;
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 25, // metres between updates; ASSUMPTION, tune after measuring battery
    showsBackgroundLocationIndicator: true, // iOS: visible indicator while tracking in the background
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'Breezy is watching the air near you',
      notificationBody: 'Your location stays on this phone.',
    },
  });
}

export async function stopTracking(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}

export const isTracking = () => Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
