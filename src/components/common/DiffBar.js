import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../../theme/colors';

export default function DiffBar({ label, value, color, glowColor }) {
  const segments = 10;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.bars}>
        {Array.from({ length: segments }, (_, i) => {
          const filled = i < value;
          return (
            <View
              key={i}
              style={[
                styles.seg,
                filled ? {
                  backgroundColor: color,
                  shadowColor: glowColor,
                  shadowOpacity: 0.9,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 0 },
                } : styles.segEmpty,
              ]}
            />
          );
        })}
      </View>
      <Text style={[styles.num, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  label: { color: C.textMain, fontSize: 15, width: 90, fontWeight: '500', letterSpacing: 0.5 },
  bars: { flex: 1, flexDirection: 'row', gap: 3 },
  seg: { flex: 1, height: 14, borderRadius: 3 },
  segEmpty: { flex: 1, height: 14, borderRadius: 3, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937' },
  num: { width: 24, textAlign: 'right', fontSize: 15, fontWeight: '700', marginLeft: 8 },
});
