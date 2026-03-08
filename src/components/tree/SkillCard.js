import React from 'react';
import { Modal, View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import GlowText from '../common/GlowText';
import DiffBar from '../common/DiffBar';
import { Colors, C } from '../../theme/colors';
import { toRGBA, canUnlock } from '../../utils/treeUtils';

export default function SkillCard({ node, nodes, edges, info, onClose, onRecord }) {
  const skillInfo = info || { desc: '', str: 5, bal: 5, tec: 5 };
  const unlockable = !node.isStart && canUnlock(node.id, nodes, edges);
  const prereqs = edges.filter((e) => e.to === node.id).map((e) => nodes.find((n) => n.id === e.from)).filter(Boolean);
  const unmetPrereqs = prereqs.filter((p) => !p.unlocked);

  let statusText; let statusColor;
  if (node.isStart) { statusText = 'ORIGIN'; statusColor = C.gold; } else if (node.unlocked) { statusText = 'MASTERED'; statusColor = C.green; } else if (unlockable) { statusText = 'READY TO ATTEMPT'; statusColor = C.amber; } else { statusText = 'LOCKED'; statusColor = C.red; }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.handle} />
          <View style={styles.topRow}>
            <View style={[styles.statusBadge, { borderColor: `${statusColor}60` }]}>
              <Text style={[styles.statusT, { color: statusColor, textShadowColor: statusColor, textShadowRadius: 8 }]}>{statusText}</Text>
            </View>
            <TouchableOpacity style={styles.xBtn} onPress={onClose} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
              <Text style={styles.xT}>✕</Text>
            </TouchableOpacity>
          </View>

          <GlowText style={styles.kicker} color={Colors.blue[300]} glowColor="rgba(96,165,250,0.65)" outerGlowColor="rgba(59,130,246,0.25)" align="center">SKILL DETAIL</GlowText>

          <View style={styles.divRow}><View style={styles.divLine} /><View style={styles.divDot} /><View style={styles.divLine} /></View>
          <GlowText style={styles.title} color={Colors.text.primary} glowColor="rgba(96,165,250,0.32)" outerGlowColor="rgba(59,130,246,0.18)" align="center">{node.name.toUpperCase()}</GlowText>
          <View style={styles.divRow}><View style={styles.divLine} /><View style={styles.divDot} /><View style={styles.divLine} /></View>

          {!!skillInfo.desc && <Text style={styles.desc}>{skillInfo.desc}</Text>}

          {!node.isStart && (
            <View style={styles.diffSection}>
              <GlowText style={styles.sectionLabel} color={Colors.blue[300]} glowColor="rgba(96,165,250,0.5)" outerGlowColor="rgba(79,70,229,0.25)" align="center">DIFFICULTY</GlowText>
              <DiffBar label="Strength" value={skillInfo.str} color="#c04040" glowColor="#ff2020" />
              <DiffBar label="Balance" value={skillInfo.bal} color="#3a70d0" glowColor="#2060ff" />
              <DiffBar label="Technique" value={skillInfo.tec} color="#b09020" glowColor="#ffd030" />
            </View>
          )}

          <View style={styles.mediaBg}>
            <Text style={styles.mediaLabel}>VIDEO PLACEHOLDER</Text>
            <Text style={styles.mediaHint}>Replace with skill footage</Text>
          </View>

          {unmetPrereqs.length > 0 && (
            <View style={styles.prereqBox}>
              <GlowText style={styles.prereqTitle} color="#FCA5A5" glowColor="rgba(248,113,113,0.55)" outerGlowColor="rgba(239,68,68,0.28)">PREREQUISITES NEEDED</GlowText>
              {unmetPrereqs.map((p) => <Text key={p.id} style={styles.prereqItem}>· {p.name}</Text>)}
            </View>
          )}

          {node.isStart ? (
            <View style={styles.originBtn}><Text style={styles.originBtnT}>THE BEGINNING</Text></View>
          ) : node.unlocked ? (
            <View style={styles.masteredBtn}><Text style={styles.masteredBtnT}>MASTERED</Text></View>
          ) : unlockable ? (
            <TouchableOpacity style={styles.attemptBtn} onPress={() => onRecord(node.id)} activeOpacity={0.8}><Text style={styles.attemptBtnT}>ATTEMPT</Text></TouchableOpacity>
          ) : (
            <View style={styles.lockedBtn}><Text style={styles.lockedBtnT}>COMPLETE PREREQUISITES</Text></View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.76)', justifyContent: 'flex-end', paddingHorizontal: 14, paddingBottom: 8 },
  card: {
    backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
    width: '100%', maxWidth: 520, alignSelf: 'center', borderWidth: 1, borderColor: C.stone,
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.65, shadowRadius: 28, elevation: 24,
    overflow: 'hidden', paddingBottom: 8,
  },
  handle: { alignSelf: 'center', width: 56, height: 5, borderRadius: 999, backgroundColor: 'rgba(148,163,184,0.42)', marginTop: 10, marginBottom: 4 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8 },
  statusBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(2,6,23,0.55)' },
  statusT: { fontSize: 10, fontWeight: '800', letterSpacing: 2.5 },
  xBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  xT: { color: C.textDim, fontSize: 16, fontWeight: '300' },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 3.2, textAlign: 'center', marginBottom: 4 },
  divRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 18, marginVertical: 6 },
  divLine: { flex: 1, height: 1, backgroundColor: C.stone },
  divDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.goldDim, marginHorizontal: 8 },
  title: { textAlign: 'center', fontSize: 28, fontWeight: '800', letterSpacing: 5, paddingHorizontal: 18, paddingVertical: 8 },
  diffSection: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 4 },
  desc: { color: C.textDim, fontSize: 13, lineHeight: 18, paddingHorizontal: 18, paddingTop: 4, paddingBottom: 8, textAlign: 'center' },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 3, textAlign: 'center', marginBottom: 14 },
  mediaBg: {
    marginHorizontal: 18, marginVertical: 10, height: 160, backgroundColor: '#0d1524',
    borderRadius: 12, borderWidth: 1, borderColor: toRGBA(Colors.blue[400], 0.36),
    alignItems: 'center', justifyContent: 'center', shadowColor: Colors.blue[500], shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
  },
  mediaLabel: { color: Colors.blue[300], fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  mediaHint: { color: C.textDim, fontSize: 10 },
  prereqBox: { marginHorizontal: 18, marginBottom: 8, padding: 12, backgroundColor: '#131923', borderRadius: 8, borderWidth: 1, borderColor: '#7f1d1d' },
  prereqTitle: { fontSize: 9, fontWeight: '800', letterSpacing: 2.5, marginBottom: 6 },
  prereqItem: { color: '#fca5a5', fontSize: 13, marginBottom: 3 },
  attemptBtn: {
    margin: 18, marginTop: 10, backgroundColor: '#111827', borderRadius: 10, paddingVertical: 18,
    alignItems: 'center', borderWidth: 1.5, borderColor: C.gold,
    shadowColor: C.gold, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
  },
  attemptBtnT: { color: C.gold, fontSize: 17, fontWeight: '800', letterSpacing: 5, textShadowColor: C.gold, textShadowRadius: 10 },
  lockedBtn: { margin: 18, marginTop: 10, backgroundColor: '#131923', borderRadius: 10, paddingVertical: 18, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)' },
  lockedBtnT: { color: '#fca5a5', fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  masteredBtn: {
    margin: 18, marginTop: 10, backgroundColor: '#131b22', borderRadius: 10, paddingVertical: 18,
    alignItems: 'center', borderWidth: 1.5, borderColor: C.green,
    shadowColor: C.green, shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
  },
  masteredBtnT: { color: C.green, fontSize: 17, fontWeight: '800', letterSpacing: 5 },
  originBtn: { margin: 18, marginTop: 10, backgroundColor: '#111827', borderRadius: 10, paddingVertical: 18, alignItems: 'center', borderWidth: 1, borderColor: C.goldDim },
  originBtnT: { color: C.goldDim, fontSize: 14, fontWeight: '700', letterSpacing: 4 },
});
