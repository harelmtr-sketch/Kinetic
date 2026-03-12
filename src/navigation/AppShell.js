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
  const treeActionsRef = useRef({ reset: null, unlockAll: null, enterEditMode: null });
  const handleResetProgress = useCallback(() => { treeActionsRef.current?.reset?.(); }, []);
  const handleUnlockAll = useCallback(() => { treeActionsRef.current?.unlockAll?.(); }, []);
  const handleEditTree = useCallback(() => {
    setTab('Tree');
    setTimeout(() => { treeActionsRef.current?.enterEditMode?.(); }, 100);
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={styles.contentWrap}>
        {tab === 'Tree' && (
          <TreeScreen
            onTreeChange={setTreeSnapshot}
            treeActionsRef={treeActionsRef}
            onNavigate={setTab}
          />
        )}
        {tab === 'Profile' && <ProfileScreen tree={treeSnapshot} />}
        {tab === 'Settings' && (
          <SettingsScreen
            onResetProgress={handleResetProgress}
            onUnlockAll={handleUnlockAll}
            onEditTree={handleEditTree}
          />
        )}
      </View>

      {tab !== 'Tree' && (
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 12 }]}
          onPress={() => setTab('Tree')}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  contentWrap: { flex: 1 },
  backBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 100,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,15,20,0.65)',
  },
});
