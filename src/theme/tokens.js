export const palette = {
  primary: {
    50: '#EEF4FF', 100: '#DCE8FF', 200: '#B8D0FF', 300: '#85B2FF', 400: '#4E8DFF', 500: '#2C6CFF', 600: '#1E52F2', 700: '#173FCE', 800: '#1737A5', 900: '#182F82', 950: '#0B1230',
  },
  secondary: {
    50: '#F5F1FF', 100: '#ECE4FF', 200: '#D9C8FF', 300: '#BFA2FF', 400: '#A178FF', 500: '#8454F5', 600: '#6D3BE0', 700: '#582DBA', 800: '#472795', 900: '#3A2274', 950: '#1D103B',
  },
  gray: {
    0: '#FFFFFF', 50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1', 400: '#94A3B8', 500: '#64748B', 600: '#475569', 700: '#334155', 800: '#1E293B', 850: '#111827', 900: '#0B1220', 950: '#030712', 1000: '#000000',
  },
  accent: {
    treeBlueGlow: '#2F6BFF',
    treeBlueHotspot: '#7FB0FF',
    treeVioletDim: '#5A4DB1',
    ringWhite: '#FAFBFF',
    surfaceBlack: '#020408',
    surfaceCard: '#05070B',
    successMint: '#26F7C5',
    warningGold: '#F6C744',
    pushBase: '#22C55E',
    pushGlow: '#4ADE80',
    pushEdgeInactive: '#14532D',
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, x2: 24, x3: 28 };
export const radii = { sm: 12, md: 16, lg: 24, xl: 28, round: 999 };
export const typography = {
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -0.3 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.3 },
  body: { fontSize: 15, fontWeight: '500' },
  chip: { fontSize: 12, fontWeight: '700' },
};

export const treeMetrics = {
  nodeDiameter: { base: 44, sm: 48, md: 52, lg: 56 },
  edgeWidth: { activeNear: 2.5, activeMid: 2, activeFar: 1.4, inactiveNear: 1.5, inactiveMid: 1.1, inactiveFar: 0.7 },
  glow: { dark: 1, light: 0.58 },
  opacity: { activeEdge: 0.95, inactiveEdge: 0.22, centralBloom: 0.35 },
  cardRadius: { base: 24, md: 28 },
  cardPadding: { base: 16, sm: 20, md: 24, lg: 28 },
};

export const getModeTokens = (isDark) => ({
  isDark,
  background: {
    screen: isDark ? palette.gray[950] : palette.gray[50],
    panel: isDark ? palette.accent.surfaceCard : palette.gray[0],
    nodeActiveFill: isDark ? palette.accent.surfaceBlack : palette.gray[0],
    nodeInactiveFill: isDark ? palette.gray[900] : palette.gray[100],
  },
  text: {
    primary: isDark ? palette.gray[0] : palette.gray[950],
    secondary: isDark ? palette.gray[400] : palette.gray[500],
    tertiary: isDark ? palette.gray[500] : palette.gray[600],
  },
  tree: {
    ambientBloom: isDark ? palette.primary[500] : palette.primary[200],
    activeRing: isDark ? palette.accent.ringWhite : palette.gray[950],
    inactiveRing: isDark ? palette.secondary[800] : palette.secondary[300],
    activeEdge: isDark ? palette.gray[0] : palette.gray[900],
    inactiveEdge: isDark ? palette.secondary[700] : palette.secondary[300],
    labelActive: isDark ? palette.gray[0] : palette.gray[900],
    labelInactive: isDark ? palette.gray[300] : palette.gray[600],
    glowStrength: isDark ? treeMetrics.glow.dark : treeMetrics.glow.light,
  },
});
