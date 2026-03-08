import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TreeScreen from '../screens/TreeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { Colors, C } from '../theme/colors';
import { INIT } from '../data/initialTree';
import { normalizeTree } from '../utils/treeUtils';

export default function AppShell() {
  const [tab, setTab] = useState('Tree');
  const [treeSnapshot, setTreeSnapshot] = useState(normalizeTree(INIT));
  const insets = useSafeAreaInsets();

  const tabsConfig = [
    { key: 'Tree', icon: 'git-branch-outline' },
    { key: 'Profile', icon: 'person-outline' },
    { key: 'Settings', icon: 'settings-outline' },
    { key: 'Daily', icon: 'lock-closed-outline', locked: true },
  ];

  return (
    <View style={styles.safeRoot}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={styles.root}>
        <View style={styles.contentWrap}>
          {tab === 'Tree' && <TreeScreen onTreeChange={setTreeSnapshot} />}
          {tab === 'Profile' && <ProfileScreen tree={treeSnapshot} />}
          {tab === 'Settings' && <SettingsScreen />}
        </View>

        <View style={[styles.navBar, { paddingBottom: insets.bottom }]}>
          {tabsConfig.map((item) => {
            const active = tab === item.key;
            if (item.locked) {
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.navItem, styles.navItemLocked]}
                  onPress={() => Alert.alert('Daily', 'Coming soon, stay tuned')}
                  activeOpacity={0.7}
                >
                  <View style={styles.navPillInactive}>
                    <Ionicons name={item.icon} size={22} color="#6B7280" />
                  </View>
                  <Text style={[styles.navLabel, styles.navLocked]}>{item.key}</Text>
                </TouchableOpacity>
              );
            }
            if (active) {
              return (
                <TouchableOpacity key={item.key} style={styles.navItem} onPress={() => setTab(item.key)}>
                  <View style={styles.navOrbStack}>
                    <View style={styles.navPillGlowOuter} />
                    <View style={styles.navPillGlowMid} />
                    <View style={styles.navPillGlowInner} />
                    <View style={styles.navPillActiveWrap}>
                      <View style={styles.navPillCore} />
                      <View style={styles.navPillCoreHighlight} />
                      <View style={styles.navPillShine} />
                      <Ionicons name={item.icon} size={24} color="#FFFFFF" style={styles.navActiveIcon} />
                    </View>
                  </View>
                  <Text style={[styles.navLabel, styles.navLabelActive]}>{item.key}</Text>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity key={item.key} style={styles.navItem} onPress={() => setTab(item.key)}>
                <View style={styles.navPillInactive}>
                  <Ionicons name={item.icon} size={22} color="#6B7280" />
                </View>
                <Text style={styles.navLabel}>{item.key}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeRoot: { flex: 1, backgroundColor: Colors.background.primary },
  root: { flex: 1, backgroundColor: Colors.background.primary },
  contentWrap: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.1)',
    backgroundColor: '#1A1D23',
    paddingTop: 7,
    minHeight: 68,
    overflow: 'visible',
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navItemLocked: { opacity: 0.5 },
  navOrbStack: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -3 }],
    marginBottom: -1,
  },
  navPillInactive: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navPillActiveWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.6,
    borderColor: 'rgba(147, 197, 253, 0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#60A5FA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 8,
    elevation: 5,
  },
  navPillCore: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#4C5FD5',
  },
  navPillCoreHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: 'rgba(91,124,230,0.28)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  navPillShine: {
    position: 'absolute',
    top: 6,
    width: 28,
    height: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  navActiveIcon: { marginTop: -0.5 },
  navPillGlowOuter: {
    position: 'absolute',
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: 'rgba(59,130,246,0.09)',
  },
  navPillGlowMid: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(59,130,246,0.14)',
  },
  navPillGlowInner: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(59,130,246,0.21)',
  },
  navLabel: { color: '#6B7280', fontSize: 12, fontWeight: '500', marginTop: 0 },
  navLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
    textShadowColor: 'rgba(96,165,250,0.55)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  navLocked: { color: '#6B7280' },
});
