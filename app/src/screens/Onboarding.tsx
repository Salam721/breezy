import React, { useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { requestNotificationPermission } from '../alerts/notify';
import { saveProfile } from '../data/storage';
import { store } from '../runtime';
import { requestLocationPermissions, startTracking } from '../tasks/locationTask';
import { colors } from '../theme/tokens';
import type { SurveyAnswers } from '../types';
import { Button, Card, Screen, styles } from './ui';

// PLACEHOLDER survey (the brief asks for a 5-second baseline but gives no questions).
// The owner should confirm or replace these two questions.
const QUESTIONS = [
  { key: 'forWhom', text: 'Who is Breezy for?', options: ['Me', 'My child', 'Someone else I care for'] },
  { key: 'inhalerPerWeek', text: 'In a typical week, how often is an inhaler used?', options: ['0', '1 to 2', '3 to 5', '6 or more'] },
] as const;

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const finish = async () => {
    setBusy(true);
    try {
      await saveProfile(store, { baselineSurvey: answers, createdAt: new Date().toISOString() });
      const perms = await requestLocationPermissions();
      await requestNotificationPermission();
      if (perms.foreground === 'granted') {
        await startTracking().catch((e) => setNote(`Tracking could not start: ${(e as Error).message}`));
      }
      if (perms.background !== 'granted') {
        setNote('Background location is off, so Breezy can only check while the app is open. You can change this in Settings.');
      }
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView>
        <View style={{ alignItems: 'center' }}>
          <Image source={require('../../assets/logo.png')} style={{ width: 220, height: 220 }} resizeMode="contain" />
        </View>
        {step === 0 && (
          <Card>
            <Text style={styles.title}>Welcome to Breezy</Text>
            <Text style={styles.body}>
              Breezy watches nearby air sensors and the wind, and warns you when bad air is moving toward you.
              No account. Your location and health answers stay on this phone.
            </Text>
            <Button label="Get started" onPress={() => setStep(1)} />
          </Card>
        )}
        {step === 1 && (
          <Card>
            <Text style={styles.title}>Two quick questions</Text>
            {QUESTIONS.map((q) => (
              <View key={q.key} style={{ marginBottom: 12 }}>
                <Text style={styles.body}>{q.text}</Text>
                {q.options.map((o) => (
                  <Button key={o} kind={answers[q.key] === o ? 'primary' : 'secondary'} label={o} onPress={() => setAnswers({ ...answers, [q.key]: o })} />
                ))}
              </View>
            ))}
            <Button label="Next" disabled={QUESTIONS.some((q) => answers[q.key] === undefined)} onPress={() => setStep(2)} />
          </Card>
        )}
        {step === 2 && (
          <Card>
            <Text style={styles.title}>Why Breezy needs your location</Text>
            <Text style={styles.body}>
              To warn you even when your phone is locked, Breezy needs location access "Always". The check happens on this
              phone. Your location is never sent to a server.
            </Text>
            <Text style={[styles.muted, { marginBottom: 12 }]}>Next, your phone will ask for location and notification access.</Text>
            {note ? <Text style={{ color: colors.alert, marginBottom: 8 }}>{note}</Text> : null}
            <Button label={busy ? 'Setting up…' : 'Allow and continue'} disabled={busy} onPress={finish} />
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}
