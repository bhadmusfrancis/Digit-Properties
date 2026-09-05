/** Digit Properties design tokens. Keep in sync with web primary teal. */
export const colors = {
  primary: '#0d9488',
  primaryDark: '#0f766e',
  primarySoft: '#ccfbf1',
  primaryMuted: '#14b8a6',
  ink: '#0f172a',
  body: '#334155',
  muted: '#64748b',
  faint: '#94a3b8',
  line: '#e2e8f0',
  bg: '#f8fafc',
  card: '#ffffff',
  danger: '#dc2626',
  warning: '#d97706',
  warningSoft: '#fffbeb',
  whatsapp: '#25D366',
  overlay: 'rgba(15, 23, 42, 0.45)',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 999,
} as const;

export const type = {
  hero: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.4, color: colors.ink },
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.ink },
  subtitle: { fontSize: 16, fontWeight: '600' as const, color: colors.ink },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.body, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '500' as const, color: colors.muted },
  overline: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: colors.faint,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  price: { fontSize: 20, fontWeight: '800' as const, color: colors.primary },
};

export const shadow = {
  card: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  float: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
};

export const LEGAL_URLS = {
  privacy: 'https://www.digitproperties.com/privacy',
  terms: 'https://www.digitproperties.com/terms',
  support: 'https://www.digitproperties.com/contact',
} as const;
