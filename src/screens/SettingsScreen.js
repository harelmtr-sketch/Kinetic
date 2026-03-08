import React, { useState } from 'react';
import { ScrollView, View, Text, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlowText from '../components/common/GlowText';
import { Colors } from '../theme/colors';

export default function SettingsScreen() {
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.page}>
      <GlowText style={styles.pageTitle} color={Colors.blue[300]} glowColor="rgba(96,165,250,0.75)" outerGlowColor="rgba(59,130,246,0.38)">Settings</GlowText>
      <View style={styles.card}>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Push Notifications</Text>
          <Switch value={notifications} onValueChange={setNotifications} trackColor={{ false: '#334155', true: '#3B82F6' }} thumbColor={notifications ? '#93C5FD' : '#CBD5E1'} />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Dark Theme</Text>
          <Switch value={darkMode} onValueChange={setDarkMode} trackColor={{ false: '#334155', true: '#16A34A' }} thumbColor={darkMode ? '#86EFAC' : '#CBD5E1'} />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Haptics</Text>
          <Ionicons name="phone-portrait-outline" size={17} color={Colors.slate[300]} />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Data Sync</Text>
          <Text style={styles.cardBody}>Manual</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.background.primary },
  content: { padding: 16, gap: 14 },
  pageTitle: { fontSize: 26, fontWeight: '800', marginBottom: 4, letterSpacing: 1 },
  card: { backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.default, borderRadius: 14, padding: 14, gap: 8 },
  cardBody: { color: Colors.text.tertiary, fontSize: 15 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  settingLabel: { color: Colors.text.secondary, fontSize: 15 },
});
