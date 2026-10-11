import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { addImpactEvent, MemoryStore } from '../data/storage';
import { runCheck } from '../engine/checkEngine';
import type { CheckResult } from '../engine/checkEngine';
import {
  DEMO_INITIAL_WIND_FROM, DEMO_SHIFTED_WIND_FROM, buildMockPlumeFile, demoUserPoint,
} from '../mock/mockPlume';
import { MESSAGES } from '../alerts/messages';
import { sensorDataAgeMs } from '../status/statusMachine';
import { realDeps, store } from '../runtime';
import { getPermissionState } from '../tasks/locationTask';
import { colors, statusStyle } from '../theme/tokens';
import type { ImpactEventType } from '../types';
import { Button, Card, Screen, styles } from './ui';

const mockStore = new MemoryStore(); // demo state never touches real state

function sensorText(ms: number | null): string {
  if (ms === null) return '';
  const m = Math.round(ms / 60000);
  return m < 1 ? 'Newest sensor reading: just now' : `Newest sensor reading: ${m} min old`;
}

function ageText(ms: number | null): string {
  if (ms === null) return 'No data yet';
  const m = Math.max(0, Math.round(ms / 60000));
  return m === 0 ? 'Updated just now' : `Updated ${m} min ago`;
}

export default function Home() {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [bgGranted, setBgGranted] = useState(true);
  const [error, setError] = useState('');
  const [mock, setMock] = useState(false);
  const [wind, setWind] = useState(DEMO_INITIAL_WIND_FROM);
  const [staleDemo, setStaleDemo] = useState(false);
  const [toast, setToast] = useState('');
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      setError('');
      setBgGranted((await getPermissionState()).background === 'granted');
      if (mock) {
        const now = new Date();
        const r = await runCheck(
          demoUserPoint(DEMO_INITIAL_WIND_FROM),
          realDeps({ store: mockStore, plumeUrl: '', fileOverride: buildMockPlumeFile(now, wind, staleDemo ? 15 : 0), log: undefined }),
        );
        setResult(r);
      } else {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setResult(await runCheck([pos.coords.longitude, pos.coords.latitude], realDeps()));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busy.current = false;
    }
  }, [mock, wind, staleDemo]);

  useEffect(() => {
    check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, [check]);

  const log = async (type: ImpactEventType, label: string) => {
    await addImpactEvent(store, type);
    setToast(`${label} saved on this phone`);
    setTimeout(() => setToast(''), 2000);
  };

  const status = result?.status.status ?? 'STALE';
  const st = statusStyle[status];
  const inPlumeWarning = result?.status.inPlume;

  return (
    <Screen>
      <ScrollView>
        {mock && (
          <View style={{ backgroundColor: colors.warning, borderRadius: 8, padding: 8, marginBottom: 8 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>DEMO MODE: simulated data, not live air quality</Text>
          </View>
        )}
        <Card style={{ backgroundColor: st.bg }}>
          <Text style={{ color: st.fg, fontSize: 32, fontWeight: '800' }}>{st.label}</Text>
          <Text style={{ color: st.fg, fontSize: 18, marginTop: 4 }}>{ageText(result?.status.ageMs ?? null)}</Text>
          {sensorText(sensorDataAgeMs(result?.file ?? null, new Date())) !== '' && (
            <Text style={{ color: st.fg, fontSize: 14, marginTop: 2 }}>{sensorText(sensorDataAgeMs(result?.file ?? null, new Date()))}</Text>
          )}
          {inPlumeWarning && <Text style={{ color: st.fg, fontSize: 24, fontWeight: '700', marginTop: 12 }}>{MESSAGES.alertBody}</Text>}
          {status === 'STALE' && (
            <Text style={{ color: st.fg, fontSize: 16, marginTop: 8 }}>
              Breezy can't confirm the air is clear right now. Don't treat this as safe.
            </Text>
          )}
        </Card>
        {!bgGranted && !mock && (
          <Card><Text style={styles.body}>Background location is off, so Breezy only checks while this app is open. Turn on "Always" in Settings.</Text></Card>
        )}
        {error ? <Text style={{ color: colors.alert, marginBottom: 8 }}>{error}</Text> : null}
        <Button label="Check now" kind="secondary" onPress={check} />
        <Button label="I used my inhaler" onPress={() => log('inhaler', 'Inhaler use')} />
        <Button label="I closed windows" onPress={() => log('closed_windows', 'Closed windows')} />
        <Button label="I rerouted" onPress={() => log('rerouted', 'Reroute')} />
        {toast ? <Text style={{ color: colors.tealDeep, fontSize: 16, marginBottom: 8 }}>{toast}</Text> : null}

        <Card style={{ marginTop: 12 }}>
          <Text style={styles.title}>Demo mode</Text>
          <Button label={mock ? 'Turn demo mode off' : 'Turn demo mode on'} kind="secondary" onPress={() => { setMock(!mock); setWind(DEMO_INITIAL_WIND_FROM); setStaleDemo(false); }} />
          {mock && (
            <>
              <Button label="Wind from the west (plume reaches you)" kind="secondary" onPress={() => { setStaleDemo(false); setWind(DEMO_INITIAL_WIND_FROM); }} />
              <Button label="Wind shifts east (plume moves away)" kind="secondary" onPress={() => { setStaleDemo(false); setWind(DEMO_SHIFTED_WIND_FROM); }} />
              <Button label="Data goes stale" kind="secondary" onPress={() => setStaleDemo(true)} />
            </>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}
