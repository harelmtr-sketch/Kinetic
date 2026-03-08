import React, { useMemo } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlowText from '../components/common/GlowText';
import { BRANCH_COLORS, Colors } from '../theme/colors';
import { INIT } from '../data/initialTree';
import { getTreeStats, toRGBA } from '../utils/treeUtils';

function StatChip({ label, value, accent }) {
  return (
    <View style={[styles.statCard, { borderColor: toRGBA(accent, 0.38) }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen({ tree }) {
  const stats = useMemo(() => getTreeStats(tree || INIT), [tree]);
  const leadingBranchColor = BRANCH_COLORS[stats.leadingBranch]?.main || Colors.blue[400];

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.page}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarOrb}><Ionicons name="fitness" size={22} color={Colors.blue[300]} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>Kinetic Athlete</Text>
          <Text style={styles.profileSub}>Level {Math.max(1, Math.floor(stats.unlocked / 2))} · Build momentum daily</Text>
        </View>
        <TouchableOpacity style={styles.headerAction}><Ionicons name="settings-outline" size={18} color={Colors.text.secondary} /></TouchableOpacity>
      </View>

      <View style={styles.statGrid}>
        <StatChip label="Total Skills" value={stats.total} accent={Colors.blue[400]} />
        <StatChip label="Unlocked" value={stats.unlocked} accent={Colors.green[500]} />
        <StatChip label="Completion" value={`${stats.completionPct}%`} accent={Colors.yellow[400]} />
        <StatChip label="Leading Branch" value={stats.leadingBranch.toUpperCase()} accent={leadingBranchColor} />
      </View>

      <View style={styles.card}>
        <GlowText style={styles.cardTitle} color={Colors.blue[300]} glowColor="rgba(96,165,250,0.55)" outerGlowColor="rgba(59,130,246,0.26)">Tree Progress</GlowText>
        {['push', 'pull', 'core'].map((branch) => {
          const b = stats.byBranch[branch];
          const color = BRANCH_COLORS[branch].main;
          return (
            <View key={branch} style={styles.progressRow}>
              <Text style={[styles.progressLabel, { color }]}>{branch.toUpperCase()}</Text>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${b.pct}%`, backgroundColor: color }]} /></View>
              <Text style={styles.progressMeta}>{b.unlocked}/{b.total}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <GlowText style={styles.cardTitle} color={Colors.blue[300]} glowColor="rgba(96,165,250,0.55)" outerGlowColor="rgba(59,130,246,0.26)">Highlights</GlowText>
        <Text style={styles.cardBody}>• Leading branch: {stats.leadingBranch.toUpperCase()} ({stats.byBranch[stats.leadingBranch]?.pct || 0}% complete)</Text>
        <Text style={styles.cardBody}>• Skills unlocked: {stats.unlocked} of {stats.total}</Text>
        <Text style={styles.cardBody}>• Note: streaks and milestones are not tracked yet.</Text>
      </View>

      <View style={styles.card}>
        <GlowText style={styles.cardTitle} color={Colors.blue[300]} glowColor="rgba(96,165,250,0.55)" outerGlowColor="rgba(59,130,246,0.26)">Actions</GlowText>
        {['Edit Profile', 'Preferences', 'Export Progress', 'Tree Settings'].map((row) => (
          <TouchableOpacity key={row} style={styles.actionRow}>
            <Text style={styles.settingLabel}>{row}</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.slate[400]} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.background.primary },
  content: { padding: 16, gap: 14 },
  profileHeader: {
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.blue,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarOrb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#101A2B',
    borderColor: Colors.border.blueActive,
    borderWidth: 1,
  },
  profileName: { color: Colors.text.primary, fontSize: 17, fontWeight: '800' },
  profileSub: { color: Colors.text.tertiary, marginTop: 2 },
  headerAction: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#131A25' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '48%', backgroundColor: Colors.background.cardAlt, borderRadius: 14, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 12 },
  statValue: { color: Colors.text.primary, fontSize: 19, fontWeight: '800' },
  statLabel: { color: Colors.text.tertiary, fontSize: 12, marginTop: 4 },
  card: { backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.default, borderRadius: 14, padding: 14, gap: 8 },
  cardTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' },
  cardBody: { color: Colors.text.tertiary, fontSize: 15 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  progressLabel: { width: 48, fontSize: 12, fontWeight: '700' },
  progressTrack: { flex: 1, height: 8, borderRadius: 999, backgroundColor: '#111827', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  progressMeta: { color: Colors.slate[400], width: 40, fontSize: 12, textAlign: 'right' },
  actionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border.subtle,
  },
  settingLabel: { color: Colors.text.secondary, fontSize: 15 },
});
