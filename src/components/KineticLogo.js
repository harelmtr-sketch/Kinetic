import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Zap } from 'lucide-react-native/icons';
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
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
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
                backgroundColor: 'rgba(96, 165, 250, 0.32)',
              },
            ]}
          />
        </>
      )}

      <View style={[styles.iconWrap, { padding: Math.max(6, Math.round(size * 0.22)) }]}>
        <View style={styles.iconCore} />
        <Zap
          size={size}
          color="#7BC3FF"
          strokeWidth={2.5}
          fill="#7BC3FF"
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
    shadowColor: 'rgba(123, 195, 255, 1)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 14,
    elevation: 10,
    backgroundColor: '#0B1B2E',
    borderColor: 'rgba(111, 184, 255, 0.28)',
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  iconCore: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(84, 160, 255, 0.08)',
  },
});
