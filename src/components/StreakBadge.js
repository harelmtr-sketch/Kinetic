import React from 'react';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';


const BASE = {
  wrapperWidth: 96,
  wrapperHeight: 74,
  outerWidth: 94,
  outerHeight: 68,
  outerRadius: 22,
  midWidth: 88,
  midHeight: 62,
  midRadius: 20,
  innerWidth: 82,
  innerHeight: 56,
  innerRadius: 18,
  cardWidth: 74,
  cardHeight: 50,
  cardRadius: 16,
  iconSize: 16,
  numberSize: 22,
  numberLineHeight: 24,
  labelSize: 12,
  labelLineHeight: 13,
};

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;
  const int = parseInt(expanded, 16);

  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function scaled(value, size) {
  return Math.round(value * size);
}

export default function StreakBadge({
  days,
  glowColor = '#FF5A4F',
  size = 1,
  active = true,
  style,
  onPress,
}) {
  const outerBloomColor = withAlpha(glowColor, active ? 0.1 : 0.04);
  const midBloomColor = withAlpha(glowColor, active ? 0.12 : 0.045);
  const innerGlowColor = withAlpha(glowColor, active ? 0.08 : 0.03);
  const borderColor = withAlpha(glowColor, active ? 0.45 : 0.22);
  const iconColor = active ? '#FF6B57' : '#C87A71';
  const numberColor = active ? '#FF7A6B' : '#CC8B83';
  const labelColor = active ? 'rgba(255,235,230,0.82)' : 'rgba(255,235,230,0.54)';

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={[
        styles.wrapper,
        {
          width: scaled(BASE.wrapperWidth, size),
          height: scaled(BASE.wrapperHeight, size),
          opacity: active ? 1 : 0.82,
        },
        style,
      ]}
      {...(onPress ? { onPress, activeOpacity: 0.9 } : {})}
    >
      <View
        pointerEvents="none"
        style={[
          styles.outerBloom,
          {
            width: scaled(BASE.outerWidth, size),
            height: scaled(BASE.outerHeight, size),
            borderRadius: scaled(BASE.outerRadius, size),
            backgroundColor: outerBloomColor,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.midBloom,
          {
            width: scaled(BASE.midWidth, size),
            height: scaled(BASE.midHeight, size),
            borderRadius: scaled(BASE.midRadius, size),
            backgroundColor: midBloomColor,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.innerGlow,
          {
            width: scaled(BASE.innerWidth, size),
            height: scaled(BASE.innerHeight, size),
            borderRadius: scaled(BASE.innerRadius, size),
            backgroundColor: innerGlowColor,
          },
        ]}
      />

      <View
        style={[
          styles.card,
          {
            width: scaled(BASE.cardWidth, size),
            height: scaled(BASE.cardHeight, size),
            borderRadius: scaled(BASE.cardRadius, size),
          },
        ]}
      >
        <View pointerEvents="none" style={styles.lowerHeat} />
        <View pointerEvents="none" style={styles.edgeHeat} />
        <View
          pointerEvents="none"
          style={[
            styles.borderOverlay,
            {
              borderRadius: scaled(BASE.cardRadius, size),
              borderColor,
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.topHighlight,
            {
              left: scaled(6, size),
              right: scaled(6, size),
              height: scaled(12, size),
              borderRadius: scaled(10, size),
            },
          ]}
        />

        <View style={[styles.content, { marginTop: scaled(-1, size) }]}>
          <View style={[styles.topRow, { gap: scaled(5, size) }]}>
            <Text style={{ fontSize: scaled(BASE.iconSize, size), color: iconColor }}>🔥</Text>
            <Text
              style={[
                styles.number,
                {
                  fontSize: scaled(BASE.numberSize, size),
                  lineHeight: scaled(BASE.numberLineHeight, size),
                  color: numberColor,
                },
              ]}
            >
              {days}
            </Text>
          </View>
          <Text
            style={[
              styles.label,
              {
                fontSize: scaled(BASE.labelSize, size),
                lineHeight: scaled(BASE.labelLineHeight, size),
                marginTop: scaled(-1, size),
                color: labelColor,
              },
            ]}
          >
            days
          </Text>
        </View>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  outerBloom: {
    position: 'absolute',
    transform: [{ translateY: 3 }],
    shadowColor: '#FF3B30',
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  midBloom: {
    position: 'absolute',
    transform: [{ translateY: 2 }],
    shadowColor: '#FF4D42',
    shadowOpacity: 0.38,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 9,
  },
  innerGlow: {
    position: 'absolute',
    transform: [{ translateY: 1 }],
    shadowColor: '#FF6A5A',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  card: {
    backgroundColor: '#16090A',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lowerHeat: {
    position: 'absolute',
    left: -8,
    right: -8,
    bottom: -10,
    height: '78%',
    backgroundColor: 'rgba(120, 20, 22, 0.24)',
  },
  edgeHeat: {
    position: 'absolute',
    top: 8,
    bottom: 4,
    left: -6,
    right: -6,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 72, 56, 0.035)',
  },
  borderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  number: {
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  label: {
    fontWeight: '600',
  },
});
