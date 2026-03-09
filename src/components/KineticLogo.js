import React from 'react';
import { StyleSheet, View } from 'react-native';
import Zap from 'lucide-react-native/dist/esm/icons/zap';
import { Colors } from '../theme/colors';

export default function KineticLogo({
  size = 48,
  glow = true,
  style,
}) {
  const outerInset = Math.max(10, Math.round(size * 0.25));
  const innerInset = Math.max(6, Math.round(size * 0.17));
  const radius = Math.round(size * 0.62);

  return (
    <View style={[styles.shell, style]}>
      {glow && (
        <>
          <View
            style={[
              styles.glowLayer,
              {
                top: -outerInset,
                right: -outerInset,
                bottom: -outerInset,
                left: -outerInset,
                borderRadius: radius,
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
              },
            ]}
          />
          <View
            style={[
              styles.glowLayer,
              {
                top: -innerInset,
                right: -innerInset,
                bottom: -innerInset,
                left: -innerInset,
                borderRadius: radius - 4,
                backgroundColor: 'rgba(96, 165, 250, 0.24)',
              },
            ]}
          />
        </>
      )}

      <View style={styles.iconWrap}>
        <Zap
          size={size}
          color={Colors.blue[400]}
          strokeWidth={2.5}
          fill={Colors.blue[400]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowLayer: {
    position: 'absolute',
  },
  iconWrap: {
    shadowColor: 'rgba(96, 165, 250, 1)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 10,
    backgroundColor: Colors.background.primary,
    borderRadius: 999,
    padding: 6,
  },
});
