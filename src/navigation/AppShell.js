import React, {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import {
  Alert, ActivityIndicator, Animated, Easing, Text, TouchableOpacity, View, StyleSheet, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TreeScreen from '../screens/TreeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import FriendsScreen from '../screens/FriendsScreen';
import CameraScreen from '../screens/CameraScreen';
import AuthScreen from '../screens/AuthScreen';
import { Colors, C } from '../theme/colors';
import { INIT } from '../data/initialTree';
import { normalizeTree } from '../utils/treeUtils';
import { signOut } from '../services/authService';
import { applyUnlockedNodesToTree } from '../services/progressService';
import { loadSkillVideoMap } from '../services/skillVideoService';
import { useAuthSession } from '../hooks/useAuthSession';

const DEFAULT_TREE = normalizeTree(INIT);
const ENTRY_STARS = [
  { left: '12%', top: '18%', size: 3 },
  { left: '24%', top: '32%', size: 2 },
  { left: '78%', top: '21%', size: 3 },
  { left: '68%', top: '38%', size: 2 },
  { left: '18%', top: '68%', size: 2 },
  { left: '82%', top: '72%', size: 2 },
  { left: '48%', top: '16%', size: 1.5 },
  { left: '58%', top: '62%', size: 1.5 },
];

function LoadingState() {
  return (
    <View style={styles.loadingRoot}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ActivityIndicator size="large" color="#7DD3FC" />
      <Text style={styles.loadingText}>Restoring your session...</Text>
    </View>
  );
}

function EntryTransition({ progress }) {
  const overlayOpacity = progress.interpolate({ inputRange: [0, 0.78, 1], outputRange: [1, 0.9, 0] });
  const bloomScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.72, 2.8] });
  const bloomOpacity = progress.interpolate({ inputRange: [0, 0.48, 1], outputRange: [0.08, 0.32, 0] });
  const ringScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.82, 2.2] });
  const ringOpacity = progress.interpolate({ inputRange: [0, 0.56, 1], outputRange: [0.32, 0.16, 0] });
  const starOpacity = progress.interpolate({ inputRange: [0, 0.82, 1], outputRange: [0.78, 0.52, 0] });
  const starDrift = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -24] });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.entryOverlay, { opacity: overlayOpacity }]}>
      <View style={styles.entryTint} />
      {ENTRY_STARS.map((star, index) => (
        <Animated.View
          key={`entry_star_${index}`}
          style={[
            styles.entryStar,
            {
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              borderRadius: star.size,
              opacity: starOpacity,
              transform: [{ translateY: starDrift }],
            },
          ]}
        />
      ))}
      <Animated.View style={[styles.entryBloom, { opacity: bloomOpacity, transform: [{ scale: bloomScale }] }]} />
      <Animated.View style={[styles.entryRing, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
    </Animated.View>
  );
}

export default function AppShell() {
  const [tab, setTab] = useState('Tree');
  const [treeSnapshot, setTreeSnapshot] = useState(DEFAULT_TREE);
  const [treePrefs, setTreePrefs] = useState({ showParticles: true, highQuality: true });
  const [skillVideos, setSkillVideos] = useState({});
  const [activeSkillAttempt, setActiveSkillAttempt] = useState(null);
  const [skippedAuth, setSkippedAuth] = useState(false);
  const [showEntryTransition, setShowEntryTransition] = useState(false);
  const [hasResolvedInitialAuth, setHasResolvedInitialAuth] = useState(false);
  const insets = useSafeAreaInsets();
  const treeActionsRef = useRef({
    reset: null,
    unlockAll: null,
    completeSkill: null,
    enterEditMode: null,
  });
  const authScreenWasVisibleRef = useRef(false);
  const initialEntryPlayedRef = useRef(false);
  const entryProgress = useRef(new Animated.Value(1)).current;
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

  useEffect(() => {
    AsyncStorage.getItem('@kinetic/treePrefs').then((raw) => {
      if (raw) {
        try { setTreePrefs((p) => ({ ...p, ...JSON.parse(raw) })); } catch { /* ignore */ }
      }
    });
  }, []);

  const handleTreePrefsChange = useCallback((nextPrefs) => {
    setTreePrefs(nextPrefs);
    AsyncStorage.setItem('@kinetic/treePrefs', JSON.stringify(nextPrefs));
  }, []);
  const isAuthenticated = !!session && !!user;
  const isAdmin = skippedAuth || resolvedUserData.profile?.role === 'admin';

  useEffect(() => {
    if (!session) {
      if (!skippedAuth) {
        setTab('Tree');
        setTreeSnapshot(DEFAULT_TREE);
        setSkillVideos({});
        setActiveSkillAttempt(null);
      }
      return;
    }

    setTreeSnapshot((currentTree) => applyUnlockedNodesToTree(currentTree || DEFAULT_TREE, resolvedUserData.unlockedNodes));
  }, [resolvedUserData.unlockedNodes, session, skippedAuth]);

  useEffect(() => {
    let isMounted = true;

    const hydrateSkillVideos = async () => {
      const nextVideos = await loadSkillVideoMap();
      if (isMounted) {
        setSkillVideos(nextVideos);
      }
    };

    if (session || skippedAuth) {
      void hydrateSkillVideos();
    }

    return () => {
      isMounted = false;
    };
  }, [session, skippedAuth, user?.id]);

  useEffect(() => {
    if (!isLoading) {
      setHasResolvedInitialAuth(true);
    }
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading && !skippedAuth && !isAuthenticated) {
      authScreenWasVisibleRef.current = true;
    }
  }, [isAuthenticated, isLoading, skippedAuth]);

  useLayoutEffect(() => {
    const shouldPlayInitialEntry = !initialEntryPlayedRef.current
      && hasResolvedInitialAuth
      && (skippedAuth || isAuthenticated);
    const shouldPlayPostAuthEntry = !skippedAuth
      && isAuthenticated
      && authScreenWasVisibleRef.current;

    if (!shouldPlayInitialEntry && !shouldPlayPostAuthEntry) {
      return;
    }

    initialEntryPlayedRef.current = true;
    authScreenWasVisibleRef.current = false;
    setShowEntryTransition(true);
    entryProgress.stopAnimation();
    entryProgress.setValue(0);
    Animated.timing(entryProgress, {
      toValue: 1,
      duration: 780,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setShowEntryTransition(false);
      }
    });
  }, [entryProgress, hasResolvedInitialAuth, isAuthenticated, skippedAuth]);

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
  const appEntryOpacity = entryProgress.interpolate({ inputRange: [0, 1], outputRange: [0.84, 1] });
  const appEntryScale = entryProgress.interpolate({ inputRange: [0, 1], outputRange: [1.025, 1] });
  const appEntryTranslateY = entryProgress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  if (isLoading && !hasResolvedInitialAuth) {
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

      <Animated.View style={[styles.contentWrap, { opacity: appEntryOpacity, transform: [{ scale: appEntryScale }, { translateY: appEntryTranslateY }] }]}>
        <View style={[StyleSheet.absoluteFill, { zIndex: tab === 'Tree' ? 1 : 0, opacity: tab === 'Tree' ? 1 : 0, pointerEvents: tab === 'Tree' ? 'auto' : 'none' }]}>
          <TreeScreen
            onTreeChange={setTreeSnapshot}
            treeActionsRef={treeActionsRef}
            onNavigate={setTab}
            userId={user?.id ?? null}
            userData={resolvedUserData}
            onCloudDataChange={handleCloudDataChange}
            skillVideos={skillVideos}
            treePrefs={treePrefs}
            onStartSkillAttempt={(node) => {
              setActiveSkillAttempt(node);
              setTab('Camera');
            }}
          />
        </View>
        {tab === 'Profile' && (
          <ProfileScreen
            tree={treeSnapshot}
            user={user}
            profile={resolvedUserData.profile}
            progress={resolvedUserData.progress}
            onProfileUpdate={(updates) => {
              handleCloudDataChange((base) => ({
                ...base,
                profile: { ...(base.profile || {}), ...updates },
              }));
            }}
          />
        )}
        {tab === 'Settings' && (
          <SettingsScreen
            onResetProgress={isAdmin ? handleResetProgress : undefined}
            onUnlockAll={isAdmin ? handleUnlockAll : undefined}
            onEditTree={isAdmin ? handleEditTree : undefined}
            onSignOut={handleSignOut}
            userEmail={user?.email ?? ''}
            username={resolvedUserData.profile?.username ?? null}
            userRole={resolvedUserData.profile?.role || 'user'}
            treePrefs={treePrefs}
            onTreePrefsChange={handleTreePrefsChange}
          />
        )}
        {tab === 'Friends' && (
          <FriendsScreen currentUser={user} />
        )}
        {tab === 'Camera' && (
          <CameraScreen
            node={activeSkillAttempt}
            existingVideo={activeSkillAttempt ? skillVideos[activeSkillAttempt.id] : null}
            userId={user?.id ?? null}
            onCancel={() => {
              setActiveSkillAttempt(null);
              setTab('Tree');
            }}
            onSaved={async (savedRecord) => {
              setSkillVideos((current) => ({
                ...current,
                [savedRecord.nodeId]: savedRecord,
              }));

              if (savedRecord?.nodeId) {
                await treeActionsRef.current?.completeSkill?.(savedRecord.nodeId, {
                  deferUntilClose: true,
                });
              }

              setActiveSkillAttempt(null);
              setTab('Tree');
            }}
          />
        )}
      </Animated.View>

      {tab !== 'Tree' && (
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 12 }]}
          onPress={() => setTab('Tree')}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={18} color="#D7ECFF" />
          <Text style={styles.backBtnText}>Tree</Text>
        </TouchableOpacity>
      )}
      {showEntryTransition && <EntryTransition progress={entryProgress} />}
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
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    backgroundColor: 'rgba(8,12,22,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(140,200,255,0.14)',
    shadowColor: '#7DD3FC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  backBtnText: {
    color: 'rgba(225,240,255,0.88)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
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
  entryOverlay: {
    zIndex: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#01030A',
  },
  entryTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(1, 4, 12, 0.92)',
  },
  entryStar: {
    position: 'absolute',
    backgroundColor: '#D7ECFF',
    shadowColor: '#D7ECFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
  },
  entryBloom: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(125, 211, 252, 0.18)',
    shadowColor: '#7DD3FC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
  },
  entryRing: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 1.6,
    borderColor: 'rgba(196, 232, 255, 0.44)',
  },
});
