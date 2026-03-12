import React, { useMemo } from 'react';
import {
  ScrollView, View, Text, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRANCH_COLORS } from '../theme/colors';
import { INIT } from '../data/initialTree';
import { getTreeStats } from '../utils/treeUtils';

function StatCard({ label, value, color }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, color && { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  const leadingColor = BRANCH_COLORS[stats.leadingBranch]?.main || '#60A5FA';
  const level = progress?.level ?? Math.max(1, Math.floor(stats.unlocked / 2));
  const xp = progress?.xp ?? (stats.unlocked * 100);
  const displayName = resolveDisplayName(profile, user);
  const isAdmin = profile?.role === 'admin';

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 72 }]}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{level}</Text>
        </View>
        <View style={{ flex: 1 }}>
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
        </View>
      </View>

      <View style={styles.statGrid}>
        <StatCard label="Level" value={level} color="#7DD3FC" />
        <StatCard label="XP" value={xp} color="#38BDF8" />
        <StatCard label="Unlocked" value={stats.unlocked} color="#4ADE80" />
        <StatCard label="Best Branch" value={stats.leadingBranch.toUpperCase()} color={leadingColor} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Progress</Text>
        {['push', 'pull', 'core'].map((branch) => {
          const branchStats = stats.byBranch[branch];
          const color = BRANCH_COLORS[branch].main;
          return (
            <View key={branch} style={styles.progressRow}>
              <Text style={[styles.progressLabel, { color }]}>{branch.toUpperCase()}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${branchStats.pct}%`, backgroundColor: color }]} />
              </View>
              <Text style={styles.progressMeta}>{branchStats.unlocked}/{branchStats.total}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cloud Save</Text>
        <Text style={styles.bodyText}>Your account session is restored automatically on startup.</Text>
        <Text style={styles.bodyText}>Unlocked skills and XP are synced through Supabase.</Text>
        <Text style={styles.bodyTextDim}>Tree layouts and imported local tree variants still stay on-device.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#080808' },
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(125,211,252,0.12)',
  },
  avatarText: {
    color: '#7DD3FC',
    fontSize: 22,
    fontWeight: '800',
  },
  name: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  adminBadge: {
    position: 'relative',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(96,165,250,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.24)',
    overflow: 'hidden',
  },
  adminBadgeGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(125,211,252,0.08)',
  },
  adminBadgeText: {
    color: '#7DD3FC',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    marginTop: 2,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  statValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  section: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    padding: 18,
    gap: 10,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressLabel: {
    width: 48,
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressMeta: {
    color: 'rgba(255,255,255,0.35)',
    width: 40,
    fontSize: 12,
    textAlign: 'right',
  },
  bodyText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    lineHeight: 20,
  },
  bodyTextDim: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 13,
    fontStyle: 'italic',
  },
});
