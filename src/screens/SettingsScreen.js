import React, { useState } from 'react';
import { ScrollView, View, Text, Switch, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen({ onResetProgress, onUnlockAll, onEditTree }) {
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const insets = useSafeAreaInsets();

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 72 }]}>
      <Text style={styles.pageTitle}>Settings</Text>

      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.label}>Notifications</Text>
          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(96,165,250,0.4)' }}
            thumbColor={notifications ? '#60A5FA' : 'rgba(255,255,255,0.5)'}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>Dark Theme</Text>
          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(74,222,128,0.35)' }}
            thumbColor={darkMode ? '#4ADE80' : 'rgba(255,255,255,0.5)'}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>Haptics</Text>
          <Text style={styles.valueDim}>On</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>Data Sync</Text>
          <Text style={styles.valueDim}>Manual</Text>
        </View>
      </View>

      <Text style={styles.sectionHeader}>Tree</Text>
      <View style={styles.section}>
        {onEditTree && (
          <TouchableOpacity style={styles.row} onPress={onEditTree} activeOpacity={0.6}>
            <Text style={styles.label}>Edit Tree</Text>
            <Text style={styles.valueDim}>→</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sectionHeader}>Danger Zone</Text>
      <View style={styles.actionRow}>
        {onResetProgress && (
          <TouchableOpacity
            style={styles.dangerBtn}
            activeOpacity={0.7}
            onPress={() => {
              Alert.alert('Reset Progress', 'Set all skills back to locked? Your tree structure stays intact.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Reset', style: 'destructive', onPress: onResetProgress },
              ]);
            }}
          >
            <Text style={styles.dangerBtnT}>Reset Progress</Text>
          </TouchableOpacity>
        )}
        {onUnlockAll && (
          <TouchableOpacity
            style={styles.greenBtn}
            activeOpacity={0.7}
            onPress={() => {
              Alert.alert('Unlock Entire Tree', 'Unlock every skill in the current tree?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Unlock', onPress: onUnlockAll },
              ]);
            }}
          >
            <Text style={styles.greenBtnT}>Unlock All</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#080808' },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  pageTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  sectionHeader: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  section: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    padding: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  label: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
  },
  valueDim: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 15,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dangerBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(248,113,113,0.1)',
  },
  dangerBtnT: {
    color: '#F87171',
    fontSize: 14,
    fontWeight: '600',
  },
  greenBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(74,222,128,0.1)',
  },
  greenBtnT: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '600',
  },
});
