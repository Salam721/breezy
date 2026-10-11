import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { configureNotifications } from './src/alerts/notify';
import { loadProfile } from './src/data/storage';
import { store } from './src/runtime';
import DeviceTest from './src/screens/DeviceTest';
import Home from './src/screens/Home';
import Impact from './src/screens/Impact';
import Onboarding from './src/screens/Onboarding';
import { getPermissionState, startTracking } from './src/tasks/locationTask';
import { colors } from './src/theme/tokens';

configureNotifications();

type Tab = 'home' | 'impact' | 'test';

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [tab, setTab] = useState<Tab>('home');

  useEffect(() => {
    (async () => {
      const p = await loadProfile(store);
      setHasProfile(p !== null);
      setLoaded(true);
      if (p) {
        // Re-arm background tracking on launch if permission was already granted.
        const perms = await getPermissionState();
        if (perms.foreground === 'granted') startTracking().catch(() => {});
      }
    })();
  }, []);

  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  if (!hasProfile) return <Onboarding onDone={() => setHasProfile(true)} />;

  const Tabs: { id: Tab; label: string }[] = [
    { id: 'home', label: 'Air' },
    { id: 'impact', label: 'Impact' },
    { id: 'test', label: 'Device test' },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="dark" />
      <View style={{ flex: 1 }}>
        {tab === 'home' && <Home />}
        {tab === 'impact' && <Impact />}
        {tab === 'test' && <DeviceTest />}
      </View>
      <View style={{ flexDirection: 'row', backgroundColor: colors.tealDeep, paddingBottom: 24 }}>
        {Tabs.map((t) => (
          <Pressable key={t.id} onPress={() => setTab(t.id)} style={{ flex: 1, alignItems: 'center', paddingVertical: 14 }}>
            <Text style={{ color: colors.onDark, fontSize: 16, fontWeight: tab === t.id ? '800' : '400', textDecorationLine: tab === t.id ? 'underline' : 'none' }}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
