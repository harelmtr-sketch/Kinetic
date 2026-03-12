import React from 'react';
import { Modal, View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import DiffBar from '../common/DiffBar';
import { Colors, C } from '../../theme/colors';
import { toRGBA, canUnlock } from '../../utils/treeUtils';

export default function SkillCard({ node, nodes, edges, info, onClose, onRecord }) {
  const skillInfo = info || { desc: '', str: 5, bal: 5, tec: 5 };
  const unlockable = !node.isStart && canUnlock(node.id, nodes, edges);
  const prereqs = edges.filter((e) => e.to === node.id).map((e) => nodes.find((n) => n.id === e.from)).filter(Boolean);
  const unmetPrereqs = prereqs.filter((p) => !p.unlocked);

  let statusText; let statusColor;
  if (node.isStart) { statusText = 'ORIGIN'; statusColor = '#60A5FA'; }
  else if (node.unlocked) { statusText = 'MASTERED'; statusColor = '#4ADE80'; }
  else if (unlockable) { statusText = 'READY'; statusColor = '#FBBF24'; }
  else { statusText = 'LOCKED'; statusColor = '#F87171'; }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={[styles.statusPill, { backgroundColor: toRGBA(statusColor, 0.15) }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusT, { color: statusColor }]}>{statusText}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
              <Text style={styles.closeT}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>{node.name.toUpperCase()}</Text>
          {!!skillInfo.desc && <Text style={styles.desc}>{skillInfo.desc}</Text>}

          {!node.isStart && (
            <View style={styles.diffSection}>
              <Text style={styles.sectionLabel}>DIFFICULTY</Text>
              <DiffBar label="Strength" value={skillInfo.str} color="#c04040" glowColor="#ff2020" />
              <DiffBar label="Balance" value={skillInfo.bal} color="#3a70d0" glowColor="#2060ff" />
              <DiffBar label="Technique" value={skillInfo.tec} color="#b09020" glowColor="#ffd030" />
            </View>
          )}

          <View style={styles.mediaBg}>
            <Text style={styles.mediaLabel}>VIDEO</Text>
            <Text style={styles.mediaHint}>Add skill footage</Text>
          </View>

          {unmetPrereqs.length > 0 && (
            <View style={styles.prereqBox}>
              <Text style={styles.prereqTitle}>PREREQUISITES</Text>
              {unmetPrereqs.map((p) => <Text key={p.id} style={styles.prereqItem}>• {p.name}</Text>)}
            </View>
          )}

          {node.isStart ? (
            <View style={styles.actionBtn}><Text style={styles.actionBtnT}>THE BEGINNING</Text></View>
          ) : node.unlocked ? (
            <View style={[styles.actionBtn, styles.masteredBtn]}><Text style={[styles.actionBtnT, { color: '#4ADE80' }]}>MASTERED</Text></View>
          ) : unlockable ? (
            <TouchableOpacity style={[styles.actionBtn, styles.attemptBtn]} onPress={() => onRecord(node.id)} activeOpacity={0.8}>
              <Text style={[styles.actionBtnT, { color: '#60A5FA' }]}>ATTEMPT</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.actionBtn, styles.lockedActionBtn]}><Text style={[styles.actionBtnT, { color: 'rgba(255,255,255,0.3)', fontSize: 13 }]}>COMPLETE PREREQUISITES</Text></View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: 'rgba(16,16,22,0.97)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusT: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  closeT: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  title: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 3,
    color: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  desc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 20,
    paddingBottom: 8,
    textAlign: 'center',
  },
  diffSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 14,
  },
  mediaBg: {
    marginHorizontal: 20,
    marginVertical: 10,
    height: 140,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 4,
  },
  mediaHint: { color: 'rgba(255,255,255,0.2)', fontSize: 12 },
  prereqBox: {
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 14,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderRadius: 14,
  },
  prereqTitle: {
    color: '#F87171',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
  },
  prereqItem: { color: 'rgba(252,165,165,0.8)', fontSize: 14, marginBottom: 3 },
  actionBtn: {
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  actionBtnT: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 3,
  },
  attemptBtn: {
    backgroundColor: 'rgba(96,165,250,0.12)',
  },
  masteredBtn: {
    backgroundColor: 'rgba(74,222,128,0.1)',
  },
  lockedActionBtn: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
});
