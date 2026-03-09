import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DashboardScreen from '../screens/DashboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { useAppTheme } from '../theme/useAppTheme';
import { TREE_MOCK_DATA } from '../data/treeMockData';
import { palette } from '../theme/tokens';
import { normalizeTree } from '../utils/treeUtils';

export default function AppShell() {
  const [tab, setTab] = useState('Dashboard');
  const { mode } = useAppTheme();
  const [treeSnapshot, setTreeSnapshot] = useState(normalizeTree(TREE_MOCK_DATA));
  const insets = useSafeAreaInsets();

  const tabsConfig = [
    { key: 'Dashboard', icon: 'grid-outline' },
    { key: 'Profile', icon: 'person-outline' },
    { key: 'Settings', icon: 'settings-outline' },
    { key: 'Daily', icon: 'lock-closed-outline', locked: true },
  ];

  return (
    <View style={[styles.safeRoot, { backgroundColor: mode.background.screen }]}>
      <StatusBar barStyle={mode.isDark ? 'light-content' : 'dark-content'} backgroundColor={mode.background.screen} />
      <View style={[styles.root, { backgroundColor: mode.background.screen }]}>
        <View style={styles.contentWrap}>
          {tab === 'Dashboard' && <DashboardScreen onTreeChange={setTreeSnapshot} />}
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
                    <Ionicons name={item.icon} size={22} color={mode.text.tertiary} />
                  </View>
                  <Text style={[styles.navLabel, styles.navLocked, { color: mode.text.tertiary }]}>{item.key}</Text>
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
                      <Ionicons name={item.icon} size={24} color={mode.text.primary} style={styles.navActiveIcon} />
                    </View>
                  </View>
                  <Text style={[styles.navLabel, styles.navLabelActive, { color: mode.text.primary }]}>{item.key}</Text>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity key={item.key} style={styles.navItem} onPress={() => setTab(item.key)}>
                <View style={styles.navPillInactive}>
                  <Ionicons name={item.icon} size={22} color={mode.text.tertiary} />
                </View>
                <Text style={[styles.navLabel, { color: mode.text.tertiary }]}>{item.key}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeRoot: { flex: 1, backgroundColor: palette.gray[950] },
  root: { flex: 1, backgroundColor: palette.gray[950] },
  contentWrap: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.1)',
    backgroundColor: palette.gray[900],
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
    borderColor: 'rgba(133, 178, 255, 0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: palette.primary[400],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 8,
    elevation: 5,
  },
  navPillCore: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.primary[600],
  },
  navPillCoreHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: 'rgba(133,178,255,0.28)',
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
    backgroundColor: 'rgba(47,107,255,0.09)',
  },
  navPillGlowMid: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(47,107,255,0.14)',
  },
  navPillGlowInner: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(47,107,255,0.21)',
  },
  navLabel: { color: palette.gray[500], fontSize: 12, fontWeight: '500', marginTop: 0 },
  navLabelActive: {
    color: palette.gray[0],
    fontWeight: '700',
    textShadowColor: 'rgba(96,165,250,0.55)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  navLocked: { color: palette.gray[500] },
});
