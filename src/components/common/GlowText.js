import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';

export default function GlowText({
  children,
  style,
  color = Colors.blue[300],
  glowColor = 'rgba(96,165,250,0.75)',
  outerGlowColor = 'rgba(59,130,246,0.35)',
  align = 'auto',
  numberOfLines,
}) {
  return (
    <View style={[styles.wrap, align !== 'auto' && { alignItems: align }]}>
      <Text
        numberOfLines={numberOfLines}
        style={[
          style,
          styles.layerBase,
          {
            color,
            textShadowColor: outerGlowColor,
            textShadowRadius: 16,
            opacity: 0.45,
          },
        ]}
      >
        {children}
      </Text>

      <Text
        numberOfLines={numberOfLines}
        style={[
          style,
          styles.layerBase,
          {
            color,
            textShadowColor: glowColor,
            textShadowRadius: 8,
            opacity: 0.9,
          },
        ]}
      >
        {children}
      </Text>

      <Text
        numberOfLines={numberOfLines}
        style={[
          style,
          {
            color,
            textShadowColor: 'rgba(255,255,255,0.08)',
            textShadowRadius: 2,
            textShadowOffset: { width: 0, height: 0 },
          },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  layerBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    textShadowOffset: { width: 0, height: 0 },
  },
});
