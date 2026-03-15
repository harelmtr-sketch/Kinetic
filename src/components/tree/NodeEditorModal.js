import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRANCH_COLORS } from '../../theme/colors';

const BRANCH_OPTIONS = ['core', 'push', 'pull'];

function StatStepper({ label, value, color, onChange }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statControls}>
        <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(Math.max(1, value - 1))}>
          <Ionicons name="remove" size={16} color="rgba(255,255,255,0.72)" />
        </TouchableOpacity>
        <View style={[styles.statValueWrap, { borderColor: `${color}2B`, backgroundColor: `${color}12` }]}>
          <Text style={[styles.statValue, { color }]}>{value}</Text>
        </View>
        <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(Math.min(10, value + 1))}>
          <Ionicons name="add" size={16} color="rgba(255,255,255,0.72)" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function NodeEditorModal({
  visible,
  node,
  info,
  onCancel,
  onSave,
}) {
  const skillInfo = useMemo(() => ({
    desc: '',
    str: 5,
    bal: 5,
    tec: 5,
    guideVideoUrl: '',
    ...(info || {}),
  }), [info]);

  const [name, setName] = useState(node?.name || '');
  const [branch, setBranch] = useState(node?.branch || 'core');
  const [desc, setDesc] = useState(skillInfo.desc);
  const [guideVideoUrl, setGuideVideoUrl] = useState(skillInfo.guideVideoUrl || '');
  const [stats, setStats] = useState({
    str: skillInfo.str,
    bal: skillInfo.bal,
    tec: skillInfo.tec,
  });

  useEffect(() => {
    if (!visible || !node) {
      return;
    }

    setName(node.name || '');
    setBranch(node.branch || 'core');
    setDesc(skillInfo.desc);
    setGuideVideoUrl(skillInfo.guideVideoUrl || '');
    setStats({
      str: skillInfo.str,
      bal: skillInfo.bal,
      tec: skillInfo.tec,
    });
  }, [node, skillInfo, visible]);

  if (!node) {
    return null;
  }

  const canSave = name.trim().length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onCancel} />

        <View style={styles.card}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>NODE ATTRIBUTES</Text>
              <Text style={styles.title}>Edit Skill</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onCancel}>
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.74)" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.field}>
              <Text style={styles.label}>Skill Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Planche lean"
                placeholderTextColor="rgba(255,255,255,0.28)"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Branch</Text>
              <View style={styles.branchRow}>
                {BRANCH_OPTIONS.map((option) => {
                  const isSelected = branch === option;
                  const palette = BRANCH_COLORS[option] || BRANCH_COLORS.neutral;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.branchChip,
                        isSelected && {
                          borderColor: `${palette.main}3D`,
                          backgroundColor: `${palette.main}18`,
                        },
                      ]}
                      onPress={() => setBranch(option)}
                    >
                      <View style={[styles.branchDot, { backgroundColor: palette.main }]} />
                      <Text style={[styles.branchText, isSelected && styles.branchTextSelected]}>
                        {option.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                value={desc}
                onChangeText={setDesc}
                placeholder="Cue setup, clean reps, and standards for this skill."
                placeholderTextColor="rgba(255,255,255,0.28)"
                multiline
                textAlignVertical="top"
                style={[styles.input, styles.textArea]}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Guide Video URL</Text>
              <TextInput
                value={guideVideoUrl}
                onChangeText={setGuideVideoUrl}
                placeholder="https://..."
                placeholderTextColor="rgba(255,255,255,0.28)"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
              <Text style={styles.caption}>Paste a public demo clip URL and it will appear inside the skill card.</Text>
            </View>

            <View style={styles.statsRow}>
              <StatStepper label="Strength" value={stats.str} color="#F87171" onChange={(value) => setStats((prev) => ({ ...prev, str: value }))} />
              <StatStepper label="Balance" value={stats.bal} color="#60A5FA" onChange={(value) => setStats((prev) => ({ ...prev, bal: value }))} />
              <StatStepper label="Technique" value={stats.tec} color="#FBBF24" onChange={(value) => setStats((prev) => ({ ...prev, tec: value }))} />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onCancel}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, !canSave && styles.disabledBtn]}
              disabled={!canSave}
              onPress={() => onSave({
                node: {
                  ...node,
                  name: name.trim(),
                  branch,
                },
                info: {
                  ...skillInfo,
                  desc: desc.trim(),
                  guideVideoUrl: guideVideoUrl.trim(),
                  ...stats,
                },
              })}
            >
              <Ionicons name="save-outline" size={16} color="#E8F7FF" />
              <Text style={styles.primaryBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  card: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    backgroundColor: 'rgba(8,12,20,0.98)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.14)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 20,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignSelf: 'center',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 8,
  },
  eyebrow: {
    color: 'rgba(191,226,255,0.5)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  title: {
    color: '#F8FBFF',
    fontSize: 24,
    fontWeight: '800',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  scroll: {
    maxHeight: 520,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 18,
    gap: 16,
  },
  field: {
    gap: 8,
  },
  label: {
    color: 'rgba(225,240,255,0.76)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  input: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 15,
  },
  textArea: {
    minHeight: 120,
  },
  caption: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 12,
    lineHeight: 17,
  },
  branchRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  branchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  branchDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  branchText: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  branchTextSelected: {
    color: '#EDF8FF',
  },
  statsRow: {
    gap: 10,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  statLabel: {
    color: '#F8FBFF',
    fontSize: 14,
    fontWeight: '700',
  },
  statControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statValueWrap: {
    minWidth: 42,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  secondaryBtn: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  secondaryBtnText: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryBtn: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(14,60,88,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.18)',
  },
  primaryBtnText: {
    color: '#E8F7FF',
    fontSize: 14,
    fontWeight: '800',
  },
  disabledBtn: {
    opacity: 0.42,
  },
});
