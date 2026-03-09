import { palette } from './tokens';

export const Colors = {
  black: palette.gray[1000],
  white: palette.gray[0],
  background: {
    primary: palette.gray[950],
    secondary: palette.gray[900],
    card: palette.accent.surfaceCard,
    cardAlt: palette.accent.surfaceBlack,
    gradient: {
      dark1: palette.gray[950],
      dark2: palette.gray[900],
      dark3: palette.gray[850],
      dark4: palette.gray[800],
    },
  },
  blue: { 300: palette.primary[300], 400: palette.primary[400], 500: palette.primary[500], 600: palette.primary[600] },
  green: { 400: palette.accent.pushGlow, 500: palette.accent.pushBase },
  yellow: { 300: palette.secondary[200], 400: palette.secondary[300], 500: palette.secondary[400] },
  slate: { 300: palette.gray[300], 400: palette.gray[400], 500: palette.gray[500], 700: palette.gray[700], 800: palette.gray[800], 900: palette.gray[900] },
  text: {
    primary: palette.gray[0],
    secondary: palette.gray[200],
    tertiary: palette.gray[400],
    disabled: 'rgba(148, 163, 184, 0.5)',
  },
  border: {
    default: 'rgba(71, 85, 105, 0.3)',
    blue: 'rgba(78, 141, 255, 0.25)',
    blueActive: 'rgba(78, 141, 255, 0.40)',
    subtle: 'rgba(203, 213, 225, 0.1)',
  },
};

export const BRANCH_COLORS = {
  neutral: { main: palette.primary[500], edgeHex: palette.primary[300], glow: 'rgba(47,107,255,0.42)', edge: 'rgba(133,178,255,0.84)', ring: palette.accent.ringWhite },
  push: { main: palette.accent.pushBase, edgeHex: palette.accent.pushGlow, glow: 'rgba(34,197,94,0.42)', edge: 'rgba(74,222,128,0.84)', ring: palette.accent.ringWhite },
  pull: { main: palette.secondary[500], edgeHex: palette.secondary[300], glow: 'rgba(132,84,245,0.42)', edge: 'rgba(191,162,255,0.86)', ring: palette.accent.ringWhite },
  core: { main: palette.primary[500], edgeHex: palette.primary[300], glow: 'rgba(47,107,255,0.42)', edge: 'rgba(133,178,255,0.84)', ring: palette.accent.ringWhite },
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
