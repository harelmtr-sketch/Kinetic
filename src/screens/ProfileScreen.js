import React, { useMemo } from 'react';
import {
  ScrollView, View, Text, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthBackdrop from '../components/AuthBackdrop';
import { BRANCH_COLORS, Colors } from '../theme/colors';
import { INIT } from '../data/initialTree';
import { getTreeStats } from '../utils/treeUtils';

function StatCard({
  label, value, color, glow,
}) {
  return (
    <View style={[styles.statCard, { borderColor: glow }]}>
      <View style={[styles.statGlow, { backgroundColor: glow }]} />
      <Text style={[styles.statValue, color && { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MetaPill({
  label, value, color,
}) {
  return (
    <View style={[styles.metaPill, { borderColor: `${color}33`, backgroundColor: `${color}14` }]}>
      <Text style={[styles.metaLabel, { color }]}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function resolveDisplayName(profile, user) {
  return profile?.display_name
    || profile?.username
    || profile?.full_name
    || user?.email?.split('@')?.[0]
    || 'Kinetic Athlete';
}

export default function ProfileScreen({
  tree,
  user,
  profile,
  progress,
}) {
  const insets = useSafeAreaInsets();
  const stats = useMemo(() => getTreeStats(tree || INIT), [tree]);
  const leadingBranch = stats.leadingBranch || 'core';
  const leadingColor = BRANCH_COLORS[leadingBranch]?.main || '#60A5FA';
  const leadingRing = BRANCH_COLORS[leadingBranch]?.ring || '#8CC8FF';
  const level = progress?.level ?? Math.max(1, Math.floor(stats.unlocked / 2));
  const xp = progress?.xp ?? (stats.unlocked * 100);
  const displayName = resolveDisplayName(profile, user);
  const isAdmin = profile?.role === 'admin';

  return (
    <View style={styles.root}>
      <AuthBackdrop style={styles.backdrop} />
      <View style={styles.pageTint} />

      <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 72 }]}>
        <View style={[styles.heroCard, { borderColor: `${leadingColor}26` }]}>
          <View style={[styles.heroGlow, { backgroundColor: `${leadingColor}16` }]} />
          <Text style={styles.eyebrow}>PROFILE</Text>

          <View style={styles.profileHeader}>
            <View style={[styles.avatarShell, { borderColor: `${leadingColor}2E` }]}>
              <View style={[styles.avatarGlow, { backgroundColor: `${leadingColor}1A` }]} />
              <View style={styles.avatar}>
                <Text style={styles.avatarLevelLabel}>LEVEL</Text>
                <Text style={styles.avatarText}>{level}</Text>
              </View>
            </View>

            <View style={styles.identityBlock}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{displayName}</Text>
                {isAdmin && (
                  <View style={styles.adminBadge}>
                    <View style={styles.adminBadgeGlow} />
                    <Text style={styles.adminBadgeText}>ADMIN</Text>
                  </View>
                )}
              </View>
              <Text style={styles.sub}>{user?.email || 'Supabase account connected'}</Text>
              <Text style={styles.heroBody}>
                Your motion tree, unlock progress, and account identity all stay in sync with the same neon-space style as the main experience.
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <MetaPill label="Leading" value={leadingBranch.toUpperCase()} color={leadingColor} />
            <MetaPill label="Cloud" value="CONNECTED" color={Colors.blue[300]} />
            <MetaPill label="Status" value={isAdmin ? 'ADMIN' : 'ACTIVE'} color={isAdmin ? '#C4B5FD' : Colors.green[400]} />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Snapshot</Text>
            <Text style={styles.sectionHint}>Current account state</Text>
          </View>
          <View style={styles.statGrid}>
            <StatCard label="Level" value={level} color="#7DD3FC" glow="rgba(125,211,252,0.22)" />
            <StatCard label="XP" value={xp} color="#38BDF8" glow="rgba(56,189,248,0.2)" />
            <StatCard label="Unlocked" value={stats.unlocked} color="#4ADE80" glow="rgba(74,222,128,0.18)" />
            <StatCard label="Best Branch" value={leadingBranch.toUpperCase()} color={leadingRing} glow={`${leadingColor}22`} />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Branch Momentum</Text>
            <Text style={styles.sectionHint}>How your unlocks are distributed</Text>
          </View>
          {['push', 'pull', 'core'].map((branch) => {
            const branchStats = stats.byBranch[branch];
            const branchColor = BRANCH_COLORS[branch].main;
            const branchRing = BRANCH_COLORS[branch].ring;

            return (
              <View key={branch} style={styles.progressRow}>
                <View style={styles.progressHead}>
                  <Text style={[styles.progressLabel, { color: branchColor }]}>{branch.toUpperCase()}</Text>
                  <Text style={styles.progressMeta}>{branchStats.unlocked}/{branchStats.total}</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFillGlow, { width: `${branchStats.pct}%`, backgroundColor: `${branchColor}26` }]} />
                  <View style={[styles.progressFill, { width: `${branchStats.pct}%`, backgroundColor: branchColor }]} />
                  <View style={[styles.progressCap, { left: `${Math.max(branchStats.pct - 4, 0)}%`, backgroundColor: branchRing }]} />
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Cloud Save</Text>
            <Text style={styles.sectionHint}>What syncs automatically</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={[styles.infoDot, { backgroundColor: '#7DD3FC' }]} />
            <Text style={styles.bodyText}>Your account session restores automatically on startup.</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={[styles.infoDot, { backgroundColor: '#4ADE80' }]} />
            <Text style={styles.bodyText}>Unlocked skills and XP sync through Supabase.</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={[styles.infoDot, { backgroundColor: '#FDE68A' }]} />
            <Text style={styles.bodyTextDim}>Imported layouts and local tree variants still stay on this device.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05070E' },
  backdrop: { opacity: 0.72 },
  pageTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3,5,10,0.7)',
  },
  page: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 18,
  },
  eyebrow: {
    color: 'rgba(191,226,255,0.72)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.2,
    marginBottom: 14,
  },
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'rgba(8,12,22,0.72)',
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
    gap: 18,
  },
  heroGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 999,
    top: -120,
    right: -70,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarShell: {
    position: 'relative',
    width: 88,
    height: 88,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
  },
  avatarGlow: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,10,18,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  avatarLevelLabel: {
    color: 'rgba(191,226,255,0.42)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  avatarText: {
    color: '#D7ECFF',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 2,
  },
  identityBlock: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  adminBadge: {
    position: 'relative',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(196,181,253,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.24)',
    overflow: 'hidden',
  },
  adminBadgeGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(196,181,253,0.08)',
  },
  adminBadgeText: {
    color: '#DDD6FE',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sub: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 14,
  },
  heroBody: {
    color: 'rgba(215,236,255,0.68)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  metaValue: {
    color: '#F8FBFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sectionCard: {
    backgroundColor: 'rgba(8,12,22,0.68)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 18,
    gap: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionHint: {
    color: 'rgba(191,226,255,0.38)',
    fontSize: 12,
    fontWeight: '600',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    position: 'relative',
    overflow: 'hidden',
    width: '47%',
    minHeight: 92,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 14,
    justifyContent: 'space-between',
  },
  statGlow: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    top: -36,
    right: -18,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.36)',
    fontSize: 12,
    fontWeight: '600',
  },
  progressRow: {
    gap: 8,
  },
  progressHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  progressTrack: {
    position: 'relative',
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  progressFillGlow: {
    position: 'absolute',
    height: '100%',
    borderRadius: 999,
  },
  progressFill: {
    position: 'absolute',
    height: '100%',
    borderRadius: 999,
  },
  progressCap: {
    position: 'absolute',
    top: 1,
    width: 12,
    height: 6,
    borderRadius: 999,
  },
  progressMeta: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  bodyText: {
    flex: 1,
    color: 'rgba(255,255,255,0.58)',
    fontSize: 14,
    lineHeight: 20,
  },
  bodyTextDim: {
    flex: 1,
    color: 'rgba(255,255,255,0.34)',
    fontSize: 13,
    lineHeight: 19,
  },
});
