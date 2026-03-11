export const Colors = {
  black: '#000000',
  white: '#FFFFFF',
  background: {
    primary: '#080808',
    secondary: '#111111',
    card: '#1E2128',
    cardAlt: '#151515',
    gradient: {
      dark1: '#0F1419',
      dark2: '#161B28',
      dark3: '#1A1F2E',
      dark4: '#1E2433',
    },
  },
  blue: { 300: '#93C5FD', 400: '#60A5FA', 500: '#3B82F6', 600: '#2563EB' },
  green: { 400: '#4ADE80', 500: '#22C55E' },
  yellow: { 300: '#FDE047', 400: '#FACC15', 500: '#EAB308' },
  slate: { 300: '#CBD5E1', 400: '#94A3B8', 500: '#64748B', 700: '#334155', 800: '#1E293B', 900: '#0F172A' },
  text: {
    primary: '#FFFFFF',
    secondary: '#E5E7EB',
    tertiary: '#9CA3AF',
    disabled: 'rgba(156, 163, 175, 0.5)',
  },
  border: {
    default: 'rgba(60, 65, 75, 0.3)',
    blue: 'rgba(59, 130, 246, 0.25)',
    blueActive: 'rgba(59, 130, 246, 0.40)',
    subtle: 'rgba(229, 231, 235, 0.1)',
  },
};

export const BRANCH_COLORS = {
  neutral: { main: '#4AA8FF', edgeHex: '#4AA8FF', glow: 'rgba(74,168,255,0.42)', edge: 'rgba(74,168,255,0.84)', ring: '#8CC8FF', glowHex: '#3D7BFF' },
  push:    { main: '#34E17A', edgeHex: '#34E17A', glow: 'rgba(52,225,122,0.46)', edge: 'rgba(52,225,122,0.84)', ring: '#7AEEA8', glowHex: '#1FAE64' },
  pull:    { main: '#FFD84A', edgeHex: '#FFD84A', glow: 'rgba(255,216,74,0.44)', edge: 'rgba(255,216,74,0.86)', ring: '#FFE88A', glowHex: '#FFB000' },
  core:    { main: '#4AA8FF', edgeHex: '#60A5FA', glow: 'rgba(74,168,255,0.40)', edge: 'rgba(96,165,250,0.82)', ring: '#8CC8FF', glowHex: '#3D7BFF' },
};

export const C = {
  bg: Colors.background.primary,
  bgCard: Colors.background.card,
  bgDeep: Colors.background.cardAlt,
  stone: Colors.slate[800],
  stoneLt: Colors.slate[700],
  gold: Colors.blue[400],
  goldDim: Colors.blue[500],
  green: Colors.green[500],
  greenGlow: BRANCH_COLORS.push.glow,
  amber: Colors.yellow[400],
  red: '#EF4444',
  blue: Colors.blue[500],
  textMain: Colors.text.primary,
  textDim: Colors.text.secondary,
  textFaint: Colors.text.tertiary,
};
