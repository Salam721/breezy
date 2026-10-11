import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { loadImpactEvents, summarizeImpact } from '../data/storage';
import { store } from '../runtime';
import { colors } from '../theme/tokens';
import type { ImpactEvent, ImpactSummary } from '../types';
import { Button, Card, Screen, styles } from './ui';

const LABEL: Record<string, string> = { inhaler: 'Inhaler use', closed_windows: 'Closed windows', rerouted: 'Rerouted' };

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.tealDeep, borderRadius: 16, padding: 12, marginHorizontal: 4, alignItems: 'center' }}>
      <Text style={{ color: colors.onDark, fontSize: 36, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.onDark, fontSize: 14, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

// Layout is a proposal (the brief names the screen but gives no layout): three count tiles + recent list.
export default function Impact() {
  const [events, setEvents] = useState<ImpactEvent[]>([]);
  const [sum, setSum] = useState<ImpactSummary | null>(null);
  const load = useCallback(async () => {
    const e = await loadImpactEvents(store);
    setEvents(e);
    setSum(summarizeImpact(e));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <Screen>
      <ScrollView>
        <Text style={styles.title}>Your impact</Text>
        <Text style={styles.muted}>Stored only on this phone.</Text>
        <View style={{ flexDirection: 'row', marginVertical: 16 }}>
          <Tile label="Inhaler uses" value={sum?.inhaler ?? 0} />
          <Tile label="Closed windows" value={sum?.closed_windows ?? 0} />
          <Tile label="Rerouted" value={sum?.rerouted ?? 0} />
        </View>
        <Card>
          <Text style={styles.title}>Recent</Text>
          {events.length === 0 && <Text style={styles.muted}>Nothing logged yet.</Text>}
          {[...events].reverse().slice(0, 10).map((e, i) => (
            <Text key={i} style={styles.body}>{LABEL[e.type]} · {new Date(e.at).toLocaleString()}</Text>
          ))}
        </Card>
        <Button label="Refresh" kind="secondary" onPress={load} />
      </ScrollView>
    </Screen>
  );
}
