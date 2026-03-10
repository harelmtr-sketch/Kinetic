import React, { useState, useRef, useCallback } from 'react';
import {
  View, TouchableOpacity, StyleSheet, StatusBar,
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
  const treeActionsRef = useRef({ reset: null, unlockAll: null });
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
          <TouchableOpacity
            style={[styles.navCircle, styles.navLeft, { top: insets.top + 64 }]}
            onPress={() => setTab('Profile')}
            activeOpacity={0.7}
          >
            <Ionicons name="person-outline" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navCircle, styles.navRight, { top: insets.top + 64 }]}
            onPress={() => setTab('Settings')}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </>
      )}

      {/* Back button when on Profile or Settings */}
      {tab !== 'Tree' && (
        <TouchableOpacity
          style={[styles.navCircle, styles.navLeft, { top: insets.top + 64 }]}
          onPress={() => setTab('Tree')}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  contentWrap: { flex: 1 },
  navCircle: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  navLeft: { left: 16 },
  navRight: { right: 16 },
});
