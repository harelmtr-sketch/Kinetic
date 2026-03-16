import React, { createContext, useContext } from 'react';

const DarkModeCtx = createContext(true);

export function ThemeProvider({ darkMode, children }) {
  return <DarkModeCtx.Provider value={darkMode ?? true}>{children}</DarkModeCtx.Provider>;
}

export function useDarkMode() {
  return useContext(DarkModeCtx);
}

export function useTheme() {
  const dark = useContext(DarkModeCtx);
  return dark ? DARK : LIGHT;
}

const DARK = {
  dark: true,
  screenBg: '#04070D',
  pageTint: 'rgba(3,6,12,0.76)',
  heroBg: 'rgba(8,12,22,0.80)',
  heroBorder: 'rgba(125,211,252,0.16)',
  cardBg: 'rgba(8,12,22,0.72)',
  cardBorder: 'rgba(255,255,255,0.06)',
  cardBg2: 'rgba(255,255,255,0.04)',
  cardBorder2: 'rgba(255,255,255,0.07)',
  sectionBg: 'rgba(8,12,22,0.72)',
  sectionBorder: 'rgba(255,255,255,0.06)',
  inputBg: 'rgba(255,255,255,0.05)',
  inputBorder: 'rgba(255,255,255,0.09)',
  rowBorder: 'rgba(255,255,255,0.05)',
  textPrimary: '#F8FBFF',
  textSecondary: 'rgba(215,236,255,0.68)',
  textDim: 'rgba(191,226,255,0.44)',
  textFaint: 'rgba(191,226,255,0.3)',
  textMuted: 'rgba(225,236,248,0.6)',
};

const LIGHT = {
  dark: false,
  screenBg: '#EEF2F7',
  pageTint: 'transparent',
  heroBg: '#FFFFFF',
  heroBorder: 'rgba(0,0,0,0.09)',
  cardBg: '#FFFFFF',
  cardBorder: 'rgba(0,0,0,0.07)',
  cardBg2: '#FFFFFF',
  cardBorder2: 'rgba(0,0,0,0.07)',
  sectionBg: '#FFFFFF',
  sectionBorder: 'rgba(0,0,0,0.07)',
  inputBg: 'rgba(0,0,0,0.04)',
  inputBorder: 'rgba(0,0,0,0.12)',
  rowBorder: 'rgba(0,0,0,0.06)',
  textPrimary: '#0F172A',
  textSecondary: 'rgba(15,23,42,0.72)',
  textDim: 'rgba(15,23,42,0.5)',
  textFaint: 'rgba(15,23,42,0.35)',
  textMuted: 'rgba(15,23,42,0.6)',
};
