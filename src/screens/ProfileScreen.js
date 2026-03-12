import React, { useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRANCH_COLORS, Colors } from '../theme/colors';
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

export default function ProfileScreen({ tree }) {
  const insets = useSafeAreaInsets();
  const stats = useMemo(() => getTreeStats(tree || INIT), [tree]);
  const leadingColor = BRANCH_COLORS[stats.leadingBranch]?.main || '#60A5FA';

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 72 }]}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {Math.max(1, Math.floor(stats.unlocked / 2))}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>Kinetic Athlete</Text>
          <Text style={styles.sub}>Level {Math.max(1, Math.floor(stats.unlocked / 2))}</Text>
        </View>
      </View>

      <View style={styles.statGrid}>
        <StatCard label="Skills" value={stats.total} color="#60A5FA" />
        <StatCard label="Unlocked" value={stats.unlocked} color="#4ADE80" />
        <StatCard label="Complete" value={`${stats.completionPct}%`} color="#FBBF24" />
        <StatCard label="Best Branch" value={stats.leadingBranch.toUpperCase()} color={leadingColor} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Progress</Text>
        {['push', 'pull', 'core'].map((branch) => {
          const b = stats.byBranch[branch];
          const color = BRANCH_COLORS[branch].main;
          return (
            <View key={branch} style={styles.progressRow}>
              <Text style={[styles.progressLabel, { color }]}>{branch.toUpperCase()}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${b.pct}%`, backgroundColor: color }]} />
              </View>
              <Text style={styles.progressMeta}>{b.unlocked}/{b.total}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Highlights</Text>
        <Text style={styles.bodyText}>Leading branch: {stats.leadingBranch.toUpperCase()} ({stats.byBranch[stats.leadingBranch]?.pct || 0}%)</Text>
        <Text style={styles.bodyText}>Skills unlocked: {stats.unlocked} of {stats.total}</Text>
        <Text style={styles.bodyTextDim}>Streaks and milestones coming soon</Text>
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
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(96,165,250,0.12)',
  },
  avatarText: {
    color: '#60A5FA',
    fontSize: 20,
    fontWeight: '800',
  },
  name: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
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
