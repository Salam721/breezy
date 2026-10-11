/**
 * Design tokens (R6.1, R6.2). Taken from the lungs logo. Contrast ratios were
 * computed against WCAG 2.x (see design.md 4.7): never put white text on `tealLight`.
 */
export const colors = {
  background: '#f0fdfa',
  surface: '#ffffff',
  text: '#0f172a', // 17.1:1 on background
  textMuted: '#475569', // 7.3:1 on background

  teal: '#14b8a6', // icons and fills only, not text
  tealDeep: '#0f766e', // 5.5:1 with white text
  tealLight: '#99f6e4',
  blue: '#2563eb', // 5.2:1 with white text
  blueDeep: '#1d4ed8',

  // Status colours: SAFE is calm teal/blue, IN_PLUME is clearly urgent, STALE is neutral.
  safe: '#0f766e',
  alert: '#b91c1c', // 6.5:1 with white text
  warning: '#fbbf24', // use with dark text (10.7:1)
  stale: '#475569', // 7.6:1 with white text
  onDark: '#ffffff',
} as const;

export const statusStyle = {
  SAFE: { bg: colors.safe, fg: colors.onDark, label: 'Air looks clear' },
  IN_PLUME: { bg: colors.alert, fg: colors.onDark, label: 'Bad air nearby' },
  STALE: { bg: colors.stale, fg: colors.onDark, label: 'Stale / Unverified' },
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { md: 12, lg: 20 } as const;
export const font = { body: 16, large: 20, title: 28, hero: 36 } as const;
