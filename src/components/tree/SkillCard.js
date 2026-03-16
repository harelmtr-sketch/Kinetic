import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeVideoPlayer from '../common/SafeVideoPlayer';
import { HAS_NATIVE_IMAGE_PICKER } from '../../services/safeMediaPicker';
import { BRANCH_COLORS } from '../../theme/colors';
import { canUnlock, resolveBranch, toRGBA } from '../../utils/treeUtils';

function InfoTile({ icon, label, value, color }) {
  return (
    <View style={[styles.infoTile, { borderColor: `${color}24`, backgroundColor: `${color}10` }]}>
      <View style={[styles.infoTileIcon, { backgroundColor: `${color}16` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={styles.infoTileLabel}>{label}</Text>
      <Text style={[styles.infoTileValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function SkillCard({
  node,
  nodes,
  edges,
  info,
  videoRecord,
  onClose,
  onAttempt,
  onSelectPrereq,
  pendingUnlock = false,
  disableBackdropClose = false,
}) {
  const skillInfo = info || { desc: '', str: 5, bal: 5, tec: 5, guideVideoUrl: '' };
  const unlockable = !node.isStart && canUnlock(node.id, nodes, edges);
  const prereqs = edges
    .filter((edge) => edge.to === node.id)
    .map((edge) => nodes.find((candidate) => candidate.id === edge.from))
    .filter(Boolean);
  const unmetPrereqs = prereqs.filter((candidate) => !candidate.unlocked && !candidate.isStart);
  const branch = resolveBranch(node);
  const branchColor = BRANCH_COLORS[branch] || BRANCH_COLORS.neutral;
  const guideVideoUri = typeof skillInfo.guideVideoUrl === 'string' && skillInfo.guideVideoUrl.trim()
    ? skillInfo.guideVideoUrl.trim()
    : null;
  const attemptVideoUri = videoRecord?.remoteUrl || videoRecord?.localUri || null;
  const hasAttemptVideo = !!attemptVideoUri;
  const canRecordAttempt = !pendingUnlock && !!onAttempt && (unlockable || node.unlocked);

  let statusText;
  let statusColor;
  let statusIcon;
  if (pendingUnlock) {
    statusText = 'Video Saved';
    statusColor = '#7DD3FC';
    statusIcon = 'sparkles-outline';
  } else if (node.isStart) {
    statusText = 'Origin';
    statusColor = '#7DD3FC';
    statusIcon = 'planet-outline';
  } else if (node.unlocked) {
    statusText = hasAttemptVideo ? 'Verified' : 'Mastered';
    statusColor = '#4ADE80';
    statusIcon = 'checkmark-circle-outline';
  } else if (unlockable) {
    statusText = 'Ready';
    statusColor = '#FBBF24';
    statusIcon = 'flash-outline';
  } else {
    statusText = 'Locked';
    statusColor = '#F87171';
    statusIcon = 'lock-closed-outline';
  }

  const attemptLabel = hasAttemptVideo
    ? (HAS_NATIVE_IMAGE_PICKER ? 'Update Attempt' : 'Update Video')
    : (HAS_NATIVE_IMAGE_PICKER ? 'Record Attempt' : 'Upload Attempt');
  const attemptIcon = HAS_NATIVE_IMAGE_PICKER ? 'camera-outline' : 'cloud-upload-outline';

  return (
    <Modal
      visible={!!node}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => onClose?.('system')}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => onClose?.('backdrop')}
          disabled={disableBackdropClose}
        />

        <View style={[styles.card, { borderColor: toRGBA(branchColor.main, 0.18) }]}>
          <View style={[styles.cardAccent, { backgroundColor: branchColor.main }]} />
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerMeta}>
              <View style={[styles.branchPill, { borderColor: toRGBA(branchColor.main, 0.22), backgroundColor: toRGBA(branchColor.main, 0.1) }]}>
                <Ionicons name="git-branch-outline" size={13} color={branchColor.main} />
                <Text style={[styles.branchPillText, { color: branchColor.ring }]}>{branch.toUpperCase()}</Text>
              </View>

              <View style={[styles.statusPill, { backgroundColor: toRGBA(statusColor, 0.14), borderColor: toRGBA(statusColor, 0.18) }]}>
                <Ionicons name={statusIcon} size={13} color={statusColor} />
                <Text style={[styles.statusText, { color: statusColor }]}>{statusText.toUpperCase()}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.closeBtn, pendingUnlock && styles.closeBtnPending]}
              onPress={() => onClose?.('close-button')}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            >
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.72)" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroBlock}>
              <Text style={styles.title}>{node.name}</Text>
              {!!skillInfo.desc && (
                <Text style={styles.desc}>{skillInfo.desc}</Text>
              )}
            </View>

            {!node.isStart && (
              <View style={styles.infoRow}>
                <InfoTile icon="barbell-outline" label="Strength" value={`${skillInfo.str}/10`} color="#F87171" />
                <InfoTile icon="pulse-outline" label="Balance" value={`${skillInfo.bal}/10`} color="#60A5FA" />
                <InfoTile icon="sparkles-outline" label="Technique" value={`${skillInfo.tec}/10`} color="#FBBF24" />
              </View>
            )}

            {prereqs.length > 0 && (
              <View style={styles.prereqBox}>
                <View style={styles.prereqHeader}>
                  <Text style={styles.prereqTitle}>PREREQUISITES</Text>
                  <Text style={styles.prereqMeta}>{unmetPrereqs.length ? `${unmetPrereqs.length} locked` : 'All clear'}</Text>
                </View>
                <View style={styles.prereqChipWrap}>
                  {prereqs.map((prereq) => {
                    const met = prereq.unlocked || prereq.isStart;
                    return (
                      <TouchableOpacity
                        key={prereq.id}
                        style={[styles.prereqChip, met ? styles.prereqChipMet : styles.prereqChipLocked]}
                        onPress={() => onSelectPrereq?.(prereq)}
                        activeOpacity={0.72}
                        disabled={!onSelectPrereq}
                      >
                        <Ionicons
                          name={met ? 'checkmark-circle' : 'lock-closed-outline'}
                          size={13}
                          color={met ? '#86EFAC' : '#FCA5A5'}
                        />
                        <Text style={[styles.prereqChipText, met ? styles.prereqChipTextMet : styles.prereqChipTextLocked]}>
                          {prereq.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {hasAttemptVideo && (
              <SafeVideoPlayer
                uri={attemptVideoUri}
                style={styles.videoStage}
                accentColor="#7DD3FC"
                emptyIcon="videocam-outline"
                openLabel="Open Clip"
              />
            )}

            {guideVideoUri && (
              <View style={styles.guideBlock}>
                <Text style={styles.guideLabel}>Guide</Text>
                <SafeVideoPlayer
                  uri={guideVideoUri}
                  style={styles.videoStage}
                  accentColor={branchColor.main}
                  openLabel="Open Guide"
                />
              </View>
            )}
          </ScrollView>

          {node.isStart ? (
            <View style={[styles.actionBtn, styles.staticAction]}>
              <Ionicons name="planet-outline" size={18} color="#7DD3FC" />
              <Text style={[styles.actionBtnT, { color: '#D9F1FF' }]}>Starting Point</Text>
            </View>
          ) : pendingUnlock ? (
            <View style={[styles.actionBtn, styles.pendingUnlockAction]}>
              <Ionicons name="sparkles-outline" size={18} color="#BFE2FF" />
              <Text style={[styles.actionBtnT, { color: '#E7F5FF' }]}>Close to Unlock</Text>
            </View>
          ) : canRecordAttempt ? (
            <TouchableOpacity style={[styles.actionBtn, styles.attemptBtn]} onPress={() => onAttempt?.(node)} activeOpacity={0.84}>
              <Ionicons name={attemptIcon} size={20} color="#BFE2FF" />
              <Text style={[styles.actionBtnT, { color: '#E7F5FF' }]}>{attemptLabel}</Text>
              <Ionicons name="arrow-forward" size={18} color="#BFE2FF" />
            </TouchableOpacity>
          ) : (
            <View style={[styles.actionBtn, styles.lockedActionBtn]}>
              <Ionicons name="lock-closed-outline" size={18} color="rgba(255,255,255,0.42)" />
              <Text style={[styles.actionBtnT, { color: 'rgba(255,255,255,0.62)' }]}>Complete Prerequisites First</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: 'rgba(10,14,22,0.98)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.38,
    shadowRadius: 28,
    elevation: 24,
  },
  cardAccent: {
    height: 3,
    width: '100%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginTop: 10,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 14,
  },
  headerMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  branchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  branchPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  closeBtnPending: {
    backgroundColor: 'rgba(13,58,86,0.86)',
    borderColor: 'rgba(125,211,252,0.18)',
    shadowColor: '#7DD3FC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  scroll: {
    maxHeight: 500,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 14,
  },
  heroBlock: {
    gap: 6,
  },
  title: {
    color: '#F8FBFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  desc: {
    color: 'rgba(225,236,248,0.68)',
    fontSize: 14,
    lineHeight: 21,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  infoTile: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  infoTileIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  infoTileLabel: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  infoTileValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  prereqBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    gap: 12,
  },
  prereqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  prereqTitle: {
    color: '#F8FBFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  prereqMeta: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
  },
  prereqChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  prereqChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
  },
  prereqChipMet: {
    backgroundColor: 'rgba(74,222,128,0.1)',
    borderColor: 'rgba(74,222,128,0.16)',
  },
  prereqChipLocked: {
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderColor: 'rgba(248,113,113,0.12)',
  },
  prereqChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  prereqChipTextMet: {
    color: '#D8FFE8',
  },
  prereqChipTextLocked: {
    color: '#FFD4D4',
  },
  videoStage: {
    height: 190,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(6,13,22,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.14)',
  },
  guideBlock: {
    gap: 8,
  },
  guideLabel: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  actionBtn: {
    minHeight: 68,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  attemptBtn: {
    backgroundColor: 'rgba(13,58,86,0.72)',
  },
  pendingUnlockAction: {
    backgroundColor: 'rgba(10,36,56,0.76)',
  },
  staticAction: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  lockedActionBtn: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  actionBtnT: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
});
