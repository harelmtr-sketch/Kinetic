import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert, Image, ScrollView, Switch, Text, TextInput, TouchableOpacity, View, StyleSheet, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AuthBackdrop from '../components/AuthBackdrop';
import { useTheme } from '../theme/ThemeContext';
import { BRANCH_COLORS, Colors } from '../theme/colors';
import { INIT } from '../data/initialTree';
import { getTreeStats } from '../utils/treeUtils';
import { supabase } from '../lib/supabase';

// ── helpers ──────────────────────────────────────────────────────────────────

function resolveDisplayName(profile, user) {
  return profile?.display_name
    || profile?.username
    || profile?.full_name
    || user?.email?.split('@')?.[0]
    || 'Kinetic Athlete';
}

async function uploadAvatar(userId, uri) {
  const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
  const contentType = mimeMap[ext] || 'image/jpeg';
  const path = `${userId}/avatar.${ext}`;

  const response = await fetch(uri);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();

  const { error } = await supabase.storage.from('avatars').upload(path, arrayBuffer, {
    contentType,
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

async function saveProfile(userId, updates) {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  if (error) throw error;
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon }) {
  return (
    <View style={[styles.statCard, { borderColor: `${color}22` }]}>
      <View style={[styles.statAccent, { backgroundColor: color }]} />
      <View style={styles.statHeader}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

function MetaPill({ label, value, color, icon }) {
  return (
    <View style={[styles.metaPill, { borderColor: `${color}32`, backgroundColor: `${color}12` }]}>
      <View style={styles.metaHead}>
        <Ionicons name={icon} size={12} color={color} />
        <Text style={[styles.metaLabel, { color }]}>{label}</Text>
      </View>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

// ── main screen ───────────────────────────────────────────────────────────────

export default function ProfileScreen({
  tree,
  user,
  profile,
  progress,
  onProfileUpdate,
}) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const stats = useMemo(() => getTreeStats(tree || INIT), [tree]);
  const leadingBranch = stats.leadingBranch || 'core';
  const leadingColor = BRANCH_COLORS[leadingBranch]?.main || '#60A5FA';
  const leadingRing = BRANCH_COLORS[leadingBranch]?.ring || '#8CC8FF';
  const level = progress?.level ?? Math.max(1, Math.floor(stats.unlocked / 2));
  const xp = progress?.xp ?? (stats.unlocked * 100);
  const displayName = resolveDisplayName(profile, user);
  const isAdmin = profile?.role === 'admin';

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [localAvatarUri, setLocalAvatarUri] = useState(null);
  const [isPublic, setIsPublic] = useState(profile?.is_public ?? true);
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState(profile?.status ?? 'online');
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const usernameInputRef = useRef(null);

  const handleToggleVisibility = useCallback(async (value) => {
    if (!user?.id) return;
    setIsPublic(value);
    setIsSavingVisibility(true);
    try {
      await saveProfile(user.id, { is_public: value });
      onProfileUpdate?.({ ...profile, is_public: value });
    } catch {
      setIsPublic(!value); // revert on error
    } finally {
      setIsSavingVisibility(false);
    }
  }, [user?.id, profile, onProfileUpdate]);

  const handleSetStatus = useCallback(async (value) => {
    if (!user?.id) return;
    setOnlineStatus(value);
    setIsSavingStatus(true);
    try {
      await saveProfile(user.id, { status: value });
      onProfileUpdate?.({ ...profile, status: value });
    } catch {
      setOnlineStatus(onlineStatus); // revert
    } finally {
      setIsSavingStatus(false);
    }
  }, [user?.id, profile, onProfileUpdate, onlineStatus]);

  const avatarUrl = localAvatarUri || profile?.avatar_url || null;
  const username = profile?.username || null;

  const handlePickAvatar = useCallback(async () => {
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in to upload a profile photo.');
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Allow photo access in Settings to upload a profile picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.82,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      const uri = result.assets[0].uri;
      setLocalAvatarUri(uri);
      setIsUploadingAvatar(true);

      const publicUrl = await uploadAvatar(user.id, uri);
      await saveProfile(user.id, { avatar_url: publicUrl });
      onProfileUpdate?.({ ...profile, avatar_url: publicUrl });
    } catch (err) {
      Alert.alert('Upload failed', err?.message || 'Unable to upload photo.');
      setLocalAvatarUri(null);
    } finally {
      setIsUploadingAvatar(false);
    }
  }, [user?.id, profile, onProfileUpdate]);

  const handleStartEditUsername = () => {
    setUsernameDraft(username || '');
    setEditingUsername(true);
    setTimeout(() => usernameInputRef.current?.focus(), 80);
  };

  const handleSaveUsername = useCallback(async () => {
    if (!user?.id) return;
    const trimmed = usernameDraft.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    if (!trimmed || trimmed.length < 2) {
      Alert.alert('Invalid username', 'Username must be at least 2 characters (a-z, 0-9, _ . -)');
      return;
    }
    if (trimmed === (username || '').toLowerCase()) {
      setEditingUsername(false);
      return;
    }
    setIsSavingUsername(true);
    try {
      await saveProfile(user.id, { username: trimmed, display_name: trimmed });
      onProfileUpdate?.({ ...profile, username: trimmed, display_name: trimmed });
      setEditingUsername(false);
    } catch (err) {
      Alert.alert('Username taken', err?.message?.includes('unique') ? 'That username is already taken.' : (err?.message || 'Unable to save username.'));
    } finally {
      setIsSavingUsername(false);
    }
  }, [user?.id, usernameDraft, username, profile, onProfileUpdate]);

  return (
    <View style={[styles.root, { backgroundColor: theme.screenBg }]}>
      {theme.dark && <AuthBackdrop style={styles.backdrop} />}
      <View style={[styles.pageTint, { backgroundColor: theme.pageTint }]} />

      <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 72 }]}>

        {/* ── Hero card ── */}
        <View style={[styles.heroCard, { backgroundColor: theme.heroBg, borderColor: theme.dark ? `${leadingColor}22` : theme.heroBorder }]}>
          <Text style={[styles.eyebrow, { color: theme.dark ? 'rgba(191,226,255,0.74)' : 'rgba(15,23,42,0.5)' }]}>PROFILE</Text>

          <View style={styles.profileHeader}>
            {/* Avatar */}
            <TouchableOpacity
              style={[styles.avatarShell, { borderColor: `${leadingColor}38` }]}
              onPress={handlePickAvatar}
              activeOpacity={0.78}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={[styles.avatarInitial, { color: leadingColor }]}>
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              {isUploadingAvatar ? (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              ) : (
                <View style={styles.avatarEditBadge}>
                  <Ionicons name="camera-outline" size={11} color="#D7ECFF" />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.identityBlock}>
              {/* Display name / username row */}
              {editingUsername ? (
                <View style={styles.usernameEditRow}>
                  <TextInput
                    ref={usernameInputRef}
                    style={styles.usernameInput}
                    value={usernameDraft}
                    onChangeText={setUsernameDraft}
                    placeholder="username"
                    placeholderTextColor="rgba(255,255,255,0.28)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleSaveUsername}
                  />
                  <TouchableOpacity style={styles.usernameConfirmBtn} onPress={handleSaveUsername} disabled={isSavingUsername}>
                    {isSavingUsername
                      ? <ActivityIndicator size="small" color="#D9F1FF" />
                      : <Ionicons name="checkmark" size={16} color="#D9F1FF" />}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.usernameCancelBtn} onPress={() => setEditingUsername(false)}>
                    <Ionicons name="close" size={16} color="rgba(255,255,255,0.52)" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.nameRow} onPress={handleStartEditUsername} activeOpacity={0.72}>
                  <Text style={[styles.name, { color: theme.textPrimary }]}>{displayName}</Text>
                  <Ionicons name="pencil-outline" size={14} color="rgba(255,255,255,0.32)" />
                  {isAdmin && (
                    <View style={styles.adminBadge}>
                      <Ionicons name="shield-checkmark-outline" size={12} color="#DDD6FE" />
                      <Text style={styles.adminBadgeText}>ADMIN</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}

              {username && !editingUsername && (
                <Text style={styles.usernameHint}>@{username}</Text>
              )}

              <Text style={styles.heroBody}>
                Your training identity, branch momentum, and unlock progress synced here.
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <MetaPill label="Leading" value={leadingBranch.toUpperCase()} color={leadingColor} icon="git-branch-outline" />
            <MetaPill label="Cloud" value="CONNECTED" color={Colors.blue[300]} icon="cloud-done-outline" />
            <MetaPill label="Status" value={isAdmin ? 'ADMIN' : 'ACTIVE'} color={isAdmin ? '#C4B5FD' : Colors.green[400]} icon="sparkles-outline" />
          </View>
        </View>

        {/* ── Snapshot ── */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Snapshot</Text>
            <Text style={styles.sectionHint}>Current account state</Text>
          </View>
          <View style={styles.statGrid}>
            <StatCard label="Level" value={level} color="#7DD3FC" icon="layers-outline" />
            <StatCard label="XP" value={xp} color="#38BDF8" icon="flash-outline" />
            <StatCard label="Unlocked" value={stats.unlocked} color="#4ADE80" icon="checkmark-done-outline" />
            <StatCard label="Best Branch" value={leadingBranch.toUpperCase()} color={leadingRing} icon="trophy-outline" />
          </View>
        </View>

        {/* ── Branch Momentum ── */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Branch Momentum</Text>
            <Text style={styles.sectionHint}>How your unlocks are distributed</Text>
          </View>
          {['push', 'pull', 'core'].map((branch) => {
            const branchStats = stats.byBranch[branch];
            const branchColor = BRANCH_COLORS[branch].main;
            const branchRing = BRANCH_COLORS[branch].ring;
            return (
              <View key={branch} style={styles.progressRow}>
                <View style={styles.progressHead}>
                  <View style={styles.progressLabelWrap}>
                    <View style={[styles.progressBullet, { backgroundColor: branchColor }]} />
                    <Text style={[styles.progressLabel, { color: branchColor }]}>{branch.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.progressMeta}>{branchStats.unlocked}/{branchStats.total}</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFillGlow, { width: `${branchStats.pct}%`, backgroundColor: `${branchColor}24` }]} />
                  <View style={[styles.progressFill, { width: `${branchStats.pct}%`, backgroundColor: branchColor }]} />
                  <View style={[styles.progressCap, { left: `${Math.max(branchStats.pct - 4, 0)}%`, backgroundColor: branchRing }]} />
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Cloud Save ── */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Cloud Save</Text>
            <Text style={styles.sectionHint}>What syncs automatically</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={[styles.infoDot, { backgroundColor: '#7DD3FC' }]} />
            <Text style={[styles.bodyText, { color: theme.textSecondary }]}>Your account session restores automatically on startup.</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={[styles.infoDot, { backgroundColor: '#4ADE80' }]} />
            <Text style={styles.bodyText}>Unlocked skills and XP sync through Supabase.</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={[styles.infoDot, { backgroundColor: '#FDE68A' }]} />
            <Text style={styles.bodyTextDim}>Imported layouts and local tree variants stay on this device.</Text>
          </View>
        </View>

        {/* ── Visibility ── */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Visibility</Text>
            <Text style={styles.sectionHint}>Who can see your profile</Text>
          </View>
          <View style={styles.visibilityRow}>
            <View style={styles.visibilityLeft}>
              <View style={[styles.visibilityIconWrap, { backgroundColor: isPublic ? 'rgba(74,222,128,0.1)' : 'rgba(148,163,184,0.1)', borderColor: isPublic ? 'rgba(74,222,128,0.24)' : 'rgba(148,163,184,0.18)' }]}>
                <Ionicons name={isPublic ? 'globe-outline' : 'lock-closed-outline'} size={18} color={isPublic ? '#4ADE80' : '#94A3B8'} />
              </View>
              <View style={styles.visibilityText}>
                <Text style={styles.visibilityTitle}>{isPublic ? 'Public Profile' : 'Private Profile'}</Text>
                <Text style={styles.visibilityHint}>{isPublic ? 'Friends can find and view your profile' : 'Only you can see your profile'}</Text>
              </View>
            </View>
            {isSavingVisibility
              ? <ActivityIndicator size="small" color={isPublic ? '#4ADE80' : '#94A3B8'} />
              : (
                <Switch
                  value={isPublic}
                  onValueChange={handleToggleVisibility}
                  trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(74,222,128,0.36)' }}
                  thumbColor={isPublic ? '#BBF7D0' : 'rgba(255,255,255,0.62)'}
                />
              )}
          </View>
        </View>

        {/* ── Online Status ── */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Online Status</Text>
            <Text style={styles.sectionHint}>How you appear to friends</Text>
            {isSavingStatus && <ActivityIndicator size="small" color="#7DD3FC" />}
          </View>
          {[
            { value: 'online',  dot: '#4ADE80', label: 'Online',           hint: 'Show as active and available' },
            { value: 'away',    dot: '#FB923C', label: 'Away',             hint: 'Show as away or idle' },
            { value: 'offline', dot: '#94A3B8', label: 'Appear Offline',   hint: 'Present as offline to others' },
          ].map((opt) => {
            const isSelected = onlineStatus === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.statusOption, isSelected && styles.statusOptionActive]}
                onPress={() => handleSetStatus(opt.value)}
                activeOpacity={0.74}
                disabled={isSavingStatus}
              >
                <View style={[styles.statusDot, { backgroundColor: opt.dot, shadowColor: opt.dot, shadowOpacity: isSelected ? 0.7 : 0, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }]} />
                <View style={styles.statusOptionText}>
                  <Text style={[styles.statusOptionLabel, isSelected && { color: '#F8FBFF' }]}>{opt.label}</Text>
                  <Text style={styles.statusOptionHint}>{opt.hint}</Text>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={18} color={opt.dot} />}
              </TouchableOpacity>
            );
          })}
        </View>


      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#04070D' },
  backdrop: { opacity: 0.64 },
  pageTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,6,12,0.74)' },
  page: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 18 },
  eyebrow: { color: 'rgba(191,226,255,0.74)', fontSize: 11, fontWeight: '700', letterSpacing: 2.2, marginBottom: 12 },
  heroCard: {
    position: 'relative', overflow: 'hidden',
    backgroundColor: 'rgba(8,12,22,0.8)', borderRadius: 30, borderWidth: 1,
    padding: 22, gap: 18,
  },
  profileHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  avatarShell: {
    width: 84, height: 84, borderRadius: 22, borderWidth: 1.5,
    overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)',
    position: 'relative',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  avatarInitial: { fontSize: 32, fontWeight: '800' },
  avatarOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.52)', alignItems: 'center', justifyContent: 'center' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12, borderTopLeftRadius: 8,
    backgroundColor: 'rgba(10,38,62,0.9)', borderWidth: 1, borderColor: 'rgba(125,211,252,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  identityBlock: { flex: 1, gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: 0.2 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: 'rgba(196,181,253,0.12)', borderWidth: 1, borderColor: 'rgba(196,181,253,0.24)' },
  adminBadgeText: { color: '#DDD6FE', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  usernameHint: { color: 'rgba(191,226,255,0.48)', fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  usernameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  usernameInput: {
    flex: 1, minHeight: 38, borderRadius: 12, paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(125,211,252,0.18)',
    color: '#fff', fontSize: 15, fontWeight: '600',
  },
  usernameConfirmBtn: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(12,54,80,0.9)', borderWidth: 1, borderColor: 'rgba(125,211,252,0.2)' },
  usernameCancelBtn: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  heroBody: { color: 'rgba(215,236,255,0.7)', fontSize: 13, lineHeight: 19 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaPill: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, minWidth: 100 },
  metaHead: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  metaLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  metaValue: { color: '#F8FBFF', fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  sectionCard: { backgroundColor: 'rgba(8,12,22,0.72)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 18, gap: 14 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  sectionTitle: { color: 'rgba(255,255,255,0.92)', fontSize: 18, fontWeight: '700' },
  sectionHint: { color: 'rgba(191,226,255,0.4)', fontSize: 12, fontWeight: '600' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47%', minHeight: 96, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 18, borderWidth: 1, paddingVertical: 16, paddingHorizontal: 14, justifyContent: 'space-between' },
  statAccent: { position: 'absolute', top: 0, left: 14, right: 14, height: 3, borderBottomLeftRadius: 6, borderBottomRightRadius: 6 },
  statHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  statValue: { fontSize: 24, fontWeight: '800' },
  progressRow: { gap: 8 },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBullet: { width: 8, height: 8, borderRadius: 4 },
  progressLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.7 },
  progressTrack: { position: 'relative', height: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  progressFillGlow: { position: 'absolute', height: '100%', borderRadius: 999 },
  progressFill: { position: 'absolute', height: '100%', borderRadius: 999 },
  progressCap: { position: 'absolute', top: 1, width: 12, height: 6, borderRadius: 999 },
  progressMeta: { color: 'rgba(255,255,255,0.42)', fontSize: 12, fontWeight: '600' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  bodyText: { flex: 1, color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 20 },
  bodyTextDim: { flex: 1, color: 'rgba(255,255,255,0.36)', fontSize: 13, lineHeight: 19 },
  visibilityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  visibilityLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  visibilityIconWrap: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  visibilityText: { flex: 1, gap: 3 },
  visibilityTitle: { color: 'rgba(255,255,255,0.88)', fontSize: 15, fontWeight: '600' },
  visibilityHint: { color: 'rgba(191,226,255,0.46)', fontSize: 12, lineHeight: 17 },
  statusOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  statusOptionActive: {
    borderColor: 'rgba(125,211,252,0.22)', backgroundColor: 'rgba(125,211,252,0.06)',
  },
  statusDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(8,12,22,0.5)' },
  statusOptionText: { flex: 1, gap: 2 },
  statusOptionLabel: { color: 'rgba(255,255,255,0.62)', fontSize: 14, fontWeight: '700' },
  statusOptionHint: { color: 'rgba(191,226,255,0.36)', fontSize: 12, lineHeight: 17 },
});
