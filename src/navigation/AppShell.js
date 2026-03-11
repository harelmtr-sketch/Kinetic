import React, { useState, useRef, useCallback } from 'react';
import {
  View, StyleSheet, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NeonControl from '../components/common/NeonControl';
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
  const treeActionsRef = useRef({ reset: null, unlockAll: null });
  const floatingNavTop = insets.top + 92;
  const handleResetProgress = useCallback(() => { treeActionsRef.current?.reset?.(); }, []);
  const handleUnlockAll = useCallback(() => { treeActionsRef.current?.unlockAll?.(); }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={styles.contentWrap}>
        {tab === 'Tree' && <TreeScreen onTreeChange={setTreeSnapshot} treeActionsRef={treeActionsRef} />}
        {tab === 'Profile' && <ProfileScreen tree={treeSnapshot} />}
        {tab === 'Settings' && (
          <SettingsScreen
            onResetProgress={handleResetProgress}
            onUnlockAll={handleUnlockAll}
          />
        )}
      </View>

      {/* Overlay nav circles — only show on Tree screen */}
      {tab === 'Tree' && (
        <>
          <NeonControl
            style={[styles.navCircle, styles.navLeft, { top: floatingNavTop }]}
            surfaceStyle={styles.navSurface}
            size={44}
            radius={22}
            accentColor="#4BA3FF"
            onPress={() => setTab('Profile')}
          >
            <Ionicons name="person-outline" size={18} color="#E4F0FF" />
          </NeonControl>
          <NeonControl
            style={[styles.navCircle, styles.navRight, { top: floatingNavTop }]}
            surfaceStyle={styles.navSurface}
            size={44}
            radius={22}
            accentColor="#4BA3FF"
            onPress={() => setTab('Settings')}
          >
            <Ionicons name="settings-outline" size={18} color="#E4F0FF" />
          </NeonControl>
        </>
      )}

      {/* Back button when on Profile or Settings */}
      {tab !== 'Tree' && (
        <NeonControl
          style={[styles.navCircle, styles.navLeft, { top: floatingNavTop }]}
          surfaceStyle={styles.navSurface}
          size={44}
          radius={22}
          accentColor="#4BA3FF"
          onPress={() => setTab('Tree')}
        >
          <Ionicons name="arrow-back" size={18} color="#E4F0FF" />
        </NeonControl>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  contentWrap: { flex: 1 },
  navCircle: {
    position: 'absolute',
    zIndex: 100,
  },
  navSurface: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15,26,43,0.92)',
    borderColor: 'rgba(120,180,255,0.34)',
  },
  navLeft: { left: 18 },
  navRight: { right: 18 },
});
