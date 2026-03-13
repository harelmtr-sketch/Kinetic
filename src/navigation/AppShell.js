import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Alert, ActivityIndicator, Text, TouchableOpacity, View, StyleSheet, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TreeScreen from '../screens/TreeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AuthScreen from '../screens/AuthScreen';
import { Colors, C } from '../theme/colors';
import { INIT } from '../data/initialTree';
import { normalizeTree } from '../utils/treeUtils';
import { signOut } from '../services/authService';
import { applyUnlockedNodesToTree } from '../services/progressService';
import { useAuthSession } from '../hooks/useAuthSession';

const DEFAULT_TREE = normalizeTree(INIT);

function LoadingState() {
  return (
    <View style={styles.loadingRoot}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ActivityIndicator size="large" color="#7DD3FC" />
      <Text style={styles.loadingText}>Restoring your session...</Text>
    </View>
  );
}

export default function AppShell() {
  const [tab, setTab] = useState('Tree');
  const [treeSnapshot, setTreeSnapshot] = useState(DEFAULT_TREE);
  const [skippedAuth, setSkippedAuth] = useState(false);
  const insets = useSafeAreaInsets();
  const treeActionsRef = useRef({ reset: null, unlockAll: null, enterEditMode: null });
  const {
    session,
    user,
    userData,
    setUserData,
    isLoading,
  } = useAuthSession();

  const resolvedUserData = userData || {
    profile: null,
    progress: { xp: 0, level: 1 },
    unlockedNodes: [],
  };
  const isAdmin = skippedAuth || resolvedUserData.profile?.role === 'admin';

  useEffect(() => {
    if (!session) {
      if (!skippedAuth) {
        setTab('Tree');
        setTreeSnapshot(DEFAULT_TREE);
      }
      return;
    }

    setTreeSnapshot((currentTree) => applyUnlockedNodesToTree(currentTree || DEFAULT_TREE, resolvedUserData.unlockedNodes));
  }, [resolvedUserData.unlockedNodes, session, skippedAuth]);

  const handleResetProgress = useCallback(() => {
    if (!isAdmin) return;
    setTab('Tree');
    treeActionsRef.current?.reset?.();
  }, [isAdmin]);
  const handleUnlockAll = useCallback(() => {
    if (!isAdmin) return;
    setTab('Tree');
    treeActionsRef.current?.unlockAll?.();
  }, [isAdmin]);
  const handleEditTree = useCallback(() => {
    if (!isAdmin) return;
    setTab('Tree');
    setTimeout(() => { treeActionsRef.current?.enterEditMode?.(); }, 100);
  }, [isAdmin]);

  const handleCloudDataChange = useCallback((updater) => {
    setUserData((current) => {
      const base = current || {
        profile: null,
        progress: { xp: 0, level: 1 },
        unlockedNodes: [],
      };
      return typeof updater === 'function' ? updater(base) : updater;
    });
  }, [setUserData]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      Alert.alert('Sign out failed', error?.message || 'Unable to sign out right now.');
    }
  }, []);

  const statusBar = useMemo(() => (
    <StatusBar barStyle="light-content" backgroundColor={C.bg} />
  ), []);

  if (isLoading) {
    return <LoadingState />;
  }

  if (!skippedAuth && (!session || !user)) {
    return (
      <>
        {statusBar}
        <AuthScreen onSkip={() => setSkippedAuth(true)} />
      </>
    );
  }

  return (
    <View style={styles.root}>
      {statusBar}

      <View style={styles.contentWrap}>
        <View style={[StyleSheet.absoluteFill, { zIndex: tab === 'Tree' ? 1 : 0, opacity: tab === 'Tree' ? 1 : 0, pointerEvents: tab === 'Tree' ? 'auto' : 'none' }]}>
          <TreeScreen
            onTreeChange={setTreeSnapshot}
            treeActionsRef={treeActionsRef}
            onNavigate={setTab}
            userId={user?.id ?? null}
            userData={resolvedUserData}
            onCloudDataChange={handleCloudDataChange}
          />
        </View>
        {tab === 'Profile' && (
          <ProfileScreen
            tree={treeSnapshot}
            user={user}
            profile={resolvedUserData.profile}
            progress={resolvedUserData.progress}
          />
        )}
        {tab === 'Settings' && (
          <SettingsScreen
            onResetProgress={isAdmin ? handleResetProgress : undefined}
            onUnlockAll={isAdmin ? handleUnlockAll : undefined}
            onEditTree={isAdmin ? handleEditTree : undefined}
            onSignOut={handleSignOut}
            userEmail={user?.email ?? ''}
            userRole={resolvedUserData.profile?.role || 'user'}
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
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.primary,
    gap: 16,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
