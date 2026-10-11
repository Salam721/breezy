/** Task T2: settle the [U] items on a real phone. Everything here is for testing, not part of the demo. */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { playAlertClip } from '../alerts/audio';
import { currentAudioOutputs, headphoneModuleAvailable, headphonesConnected } from '../alerts/headphones';
import { notifyTest, requestNotificationPermission } from '../alerts/notify';
import { PLUME_URL } from '../config';
import { clearLog, PROBE_KEY, readLog } from '../data/debugLog';
import { fetchPlumeFile } from '../data/plumeClient';
import type { FetchLike } from '../data/plumeClient';
import { store } from '../runtime';
import { getPermissionState, isTracking, requestLocationPermissions, startTracking, stopTracking } from '../tasks/locationTask';
import { Button, Card, Screen, styles } from './ui';

export default function DeviceTest() {
  const [out, setOut] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [probe, setProbe] = useState(false);
  const [tracking, setTracking] = useState(false);

  const refresh = useCallback(async () => {
    setLog(await readLog(store));
    setProbe((await store.getItem(PROBE_KEY)) === '1');
    setTracking(await isTracking());
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const run = (name: string, fn: () => Promise<string>) => async () => {
    try { setOut(`${name}: ${await fn()}`); } catch (e) { setOut(`${name} FAILED: ${(e as Error).message}`); }
    refresh();
  };

  return (
    <Screen>
      <ScrollView>
        <Text style={styles.title}>Device test (T2)</Text>
        <Text style={styles.muted}>Run these on the iPhone. Report the log back to Claude.</Text>
        <Card>
          <Text style={styles.body}>Plume URL: {PLUME_URL || '(empty: set EXPO_PUBLIC_PLUME_URL)'}</Text>
          <Text style={styles.body}>Headphone module: {headphoneModuleAvailable() ? 'loaded' : 'NOT loaded'}</Text>
          <Text style={styles.body}>Tracking: {tracking ? 'on' : 'off'} · Probe mode: {probe ? 'on' : 'off'}</Text>
        </Card>
        <Button label="1. Request permissions" onPress={run('permissions', async () => {
          const s = await requestLocationPermissions(); const n = await requestNotificationPermission();
          return `location fg=${s.foreground} bg=${s.background}, notifications=${n}`;
        })} />
        <Button label="2. Start tracking" onPress={run('start', async () => { await startTracking(); return 'started'; })} />
        <Button label="Stop tracking" kind="secondary" onPress={run('stop', async () => { await stopTracking(); return 'stopped'; })} />
        <Button label={probe ? 'Probe mode: ON (tap to turn off)' : '3. Turn probe mode on'} onPress={run('probe', async () => {
          const next = !probe; await store.setItem(PROBE_KEY, next ? '1' : '0'); return next ? 'on' : 'off';
        })} />
        <Button label="Fetch plume file now (foreground)" kind="secondary" onPress={run('fetch', async () => {
          const f = await fetchPlumeFile(PLUME_URL, fetch as unknown as FetchLike);
          return `ok, generated_at=${f.generated_at}, ${f.features.length} plume(s)`;
        })} />
        <Button label="Notification in 10 s (then lock the phone)" kind="secondary" onPress={run('notification', async () => {
          await requestNotificationPermission(); setTimeout(() => notifyTest('Lock-screen test'), 10_000); return 'scheduled in 10 s';
        })} />
        <Button label="Play alert clip" kind="secondary" onPress={run('audio', async () => { await playAlertClip(); return 'playing'; })} />
        <Button label="Check headphones" kind="secondary" onPress={run('headphones', async () => `connected=${headphonesConnected()} outputs=[${currentAudioOutputs().join(', ')}]`)} />
        <Text style={[styles.body, { marginTop: 12 }]}>{out}</Text>
        <Card>
          <Text style={styles.title}>Background log</Text>
          {log.length === 0 && <Text style={styles.muted}>Empty. Start tracking, lock the phone, walk around, then refresh.</Text>}
          {log.slice(-40).map((l, i) => <Text key={i} style={{ fontSize: 12, color: '#0f172a' }}>{l}</Text>)}
        </Card>
        <Button label="Refresh log" onPress={refresh} />
        <Button label="Clear log" kind="secondary" onPress={async () => { await clearLog(store); refresh(); }} />
      </ScrollView>
    </Screen>
  );
}
