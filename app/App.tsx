
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View, ActivityIndicator } from 'react-native';
import { Auth0Provider, useAuth0 } from 'react-native-auth0';

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

// Replace these with your Auth0 Domain and Client ID.
const AUTH0_DOMAIN = 'dev-6beh0oah3f0dli1n.us.auth0.com';
const AUTH0_CLIENT_ID = 'DeqJLVbmQw8wOogWGscq820nsVVSkc0P';

type Tab = 'home' | 'impact' | 'test';

export default function App() {
  return (
    <Auth0Provider
      domain={AUTH0_DOMAIN}
      clientId={AUTH0_CLIENT_ID}
    >
      <BreezyApp />
    </Auth0Provider>
  );
}

function BreezyApp() {
  const { user, authorize, clearSession, isLoading, error } = useAuth0();

  const [loaded, setLoaded] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const p = await loadProfile(store);
        setHasProfile(p !== null);

        if (p) {
          const perms = await getPermissionState();
          if (perms.foreground === 'granted') {
            startTracking().catch(() => {});
          }
        }
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const login = async () => {
    try {
      setAuthError('');
      await authorize();
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Login failed');
    }
  };

  const logout = async () => {
    try {
      setAuthError('');
      await clearSession();
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Logout failed');
    }
  };

  if (isLoading || !loaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
        padding: 24
      }}>
        <Text style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 12 }}>
          Welcome to Breezy
        </Text>

        <Text style={{ fontSize: 16, marginBottom: 24 }}>
          Sign in to continue
        </Text>

        <Pressable
          onPress={login}
          style={{
            backgroundColor: colors.tealDeep,
            padding: 16,
            borderRadius: 10
          }}
        >
          <Text style={{ color: colors.onDark, fontSize: 18 }}>
            Log In / Sign Up
          </Text>
        </Pressable>

        {(authError || error) && (
          <Text style={{ color: 'red', marginTop: 16 }}>
            {authError || error?.message}
          </Text>
        )}
      </View>
    );
  }

  if (!hasProfile) {
    return <Onboarding onDone={() => setHasProfile(true)} />;
  }

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

      <Pressable
        onPress={logout}
        style={{
          backgroundColor: colors.tealDeep,
          padding: 10,
          alignItems: 'center'
        }}
      >
        <Text style={{ color: colors.onDark }}>
          Log Out
        </Text>
      </Pressable>

      <View style={{
        flexDirection: 'row',
        backgroundColor: colors.tealDeep,
        paddingBottom: 24
      }}>
        {Tabs.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 14
            }}
          >
            <Text style={{
              color: colors.onDark,
              fontSize: 16,
              fontWeight: tab === t.id ? '800' : '400',
              textDecorationLine: tab === t.id ? 'underline' : 'none'
            }}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
