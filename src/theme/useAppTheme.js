import { useColorScheme } from 'react-native';
import { getModeTokens, palette, radii, spacing, treeMetrics, typography } from './tokens';

export function useAppTheme() {
  const scheme = useColorScheme();
  const isDark = scheme !== 'light';
  return {
    mode: getModeTokens(isDark),
    palette,
    spacing,
    radii,
    typography,
    treeMetrics,
  };
}
