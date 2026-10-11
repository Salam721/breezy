import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, font, radius, spacing } from '../theme/tokens';

export function Button({
  label, onPress, kind = 'primary', disabled,
}: { label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'danger'; disabled?: boolean }) {
  const bg = kind === 'primary' ? colors.blue : kind === 'danger' ? colors.alert : colors.surface;
  const fg = kind === 'secondary' ? colors.blueDeep : colors.onDark;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        kind === 'secondary' && { borderWidth: 2, borderColor: colors.blueDeep },
      ]}
    >
      <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Screen({ children }: { children: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingTop: 64, paddingHorizontal: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  btn: { borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  btnText: { fontSize: font.large, fontWeight: '700' },
  title: { fontSize: font.title, fontWeight: '800', color: colors.tealDeep, marginBottom: spacing.sm },
  body: { fontSize: font.body, color: colors.text, marginBottom: spacing.sm },
  muted: { fontSize: font.body, color: colors.textMuted },
});
