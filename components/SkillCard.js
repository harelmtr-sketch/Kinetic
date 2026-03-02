import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { isUnlockable } from '../utils/treeStorage';

const { width } = Dimensions.get('window');

export default function SkillCard({ node, nodes, edges, onClose, onRecord }) {
  if (!node) return null;

  const unlockable = node.isStart ? false : isUnlockable(node.id, nodes, edges);
  const alreadyUnlocked = node.unlocked;

  let statusText = '';
  let statusColor = '#888';
  if (node.isStart) {
    statusText = '✅ Starting Node';
    statusColor = '#4CAF50';
  } else if (alreadyUnlocked) {
    statusText = '✅ Unlocked';
    statusColor = '#4CAF50';
  } else if (unlockable) {
    statusText = '🔓 Ready to Unlock';
    statusColor = '#FFC107';
  } else {
    statusText = '🔒 Locked — Complete prerequisites first';
    statusColor = '#F44336';
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.cardContainer}>
        <ScrollView bounces={false}>
          <View style={styles.header}>
            <Text style={styles.skillName}>{node.name}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.statusBadge, { borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
          </View>

          <View style={styles.visualBox}>
            <Text style={styles.visualLabel}>VISUAL AREA</Text>
            <Text style={styles.visualPlaceholder}>{node.visualPlaceholder}</Text>
            <Text style={styles.visualHint}>
              → Replace this with an image, video thumbnail, or animation when ready
            </Text>
          </View>

          <View style={styles.descriptionBox}>
            <Text style={styles.descriptionLabel}>About this skill</Text>
            <Text style={styles.descriptionText}>{node.description}</Text>
          </View>

          {!node.isStart && (
            <View style={styles.prereqBox}>
              <Text style={styles.prereqLabel}>Prerequisites</Text>
              {edges
                .filter(e => e.to === node.id)
                .map(e => {
                  const parent = nodes.find(n => n.id === e.from);
                  return (
                    <Text
                      key={e.from}
                      style={[
                        styles.prereqItem,
                        { color: parent?.unlocked ? '#4CAF50' : '#F44336' },
                      ]}>
                      {parent?.unlocked ? '✅' : '❌'} {parent?.name}
                    </Text>
                  );
                })}
            </View>
          )}

          {!node.isStart && !alreadyUnlocked && (
            <TouchableOpacity
              style={[styles.recordBtn, !unlockable && styles.recordBtnDisabled]}
              onPress={() => unlockable && onRecord(node.id)}
              disabled={!unlockable}>
              <Text style={styles.recordBtnText}>
                {unlockable ? '🎥 Record Skill' : '🔒 Unlock Prerequisites First'}
              </Text>
            </TouchableOpacity>
          )}

          {alreadyUnlocked && !node.isStart && (
            <View style={styles.unlockedBanner}>
              <Text style={styles.unlockedBannerText}>🏆 Skill Unlocked!</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  cardContainer: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '70%',
    borderTopWidth: 2,
    borderColor: '#4CAF50',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  skillName: { fontSize: 24, fontWeight: 'bold', color: '#fff', flex: 1 },
  closeBtn: {
    padding: 6,
    backgroundColor: '#333',
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: '#aaa', fontSize: 14, fontWeight: 'bold' },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  statusText: { fontSize: 13, fontWeight: '600' },
  visualBox: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  visualLabel: { color: '#555', fontSize: 10, fontWeight: 'bold', letterSpacing: 2, marginBottom: 8 },
  visualPlaceholder: { color: '#aaa', fontSize: 14, fontStyle: 'italic', marginBottom: 6 },
  visualHint: { color: '#555', fontSize: 11 },
  descriptionBox: { marginBottom: 16 },
  descriptionLabel: { color: '#888', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' },
  descriptionText: { color: '#ddd', fontSize: 15, lineHeight: 22 },
  prereqBox: { backgroundColor: '#16213e', borderRadius: 12, padding: 14, marginBottom: 16 },
  prereqLabel: { color: '#888', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  prereqItem: { fontSize: 14, marginBottom: 4 },
  recordBtn: { backgroundColor: '#4CAF50', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 8 },
  recordBtnDisabled: { backgroundColor: '#333' },
  recordBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  unlockedBanner: { backgroundColor: '#1b5e20', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 8 },
  unlockedBannerText: { color: '#4CAF50', fontSize: 16, fontWeight: 'bold' },
});