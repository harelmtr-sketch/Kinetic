import React from 'react';
import {
  Pressable, StyleSheet, View,
} from 'react-native';

function alpha(color, value) {
  if (color.startsWith('rgba(')) return color.replace(/rgba\((.+),\s*[\d.]+\)/, `rgba($1, ${value})`);
  if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', `, ${value})`);

  const hex = color.replace('#', '');
  const expanded = hex.length === 3 ? hex.split('').map((char) => char + char).join('') : hex;
  const int = parseInt(expanded, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${value})`;
}

export default function NeonControl({
  children,
  onPress,
  style,
  surfaceStyle,
  accentColor = '#4BA3FF',
  radius = 14,
  paddingHorizontal = 0,
  paddingVertical = 0,
  size,
  activeOpacity = 1,
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => {
        const scale = pressed ? 0.96 : 1;
        return [
          styles.wrapper,
          size ? { width: size, height: size } : null,
          { borderRadius: radius + 8, opacity: activeOpacity, transform: [{ scale }] },
          style,
        ];
      }}
    >
      <View
        style={[
          styles.surface,
          {
            borderRadius: radius,
            borderColor: alpha(accentColor, 0.34),
            paddingHorizontal,
            paddingVertical,
          },
          surfaceStyle,
        ]}
      >
        <View pointerEvents="none" style={styles.innerHighlight} />
        {children}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  surface: {
    backgroundColor: '#0B1422',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: 5,
    right: 5,
    height: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
});
