import React, { useState } from 'react';
import {
  Modal, KeyboardAvoidingView, TouchableOpacity, View, TextInput, Text, Platform, StyleSheet,
} from 'react-native';
import { BRANCH_TYPES } from '../../constants/tree';
import { BRANCH_COLORS } from '../../theme/colors';

const BRANCH_LABELS = {
  push: 'PUSH',
  pull: 'PULL',
  core: 'CORE',
};

export default function NamePrompt({ visible, onConfirm, onCancel }) {
  const [val, setVal] = useState('');
  const [branch, setBranch] = useState('core');

  const reset = () => {
    setVal('');
    setBranch('core');
  };

  const ok = () => {
    const name = val.trim();
    if (!name) return;
    onConfirm({ name, branch });
    reset();
  };

  const no = () => {
    reset();
    onCancel();
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={no}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={no} />
        <View style={styles.box}>
          <Text style={styles.title}>New Skill</Text>
          <TextInput
            value={val}
            onChangeText={setVal}
            placeholder="Skill name..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={ok}
            selectionColor="#60A5FA"
            style={styles.input}
          />
          <View style={styles.branchRow}>
            {BRANCH_TYPES.map((branchType) => {
              const selected = branchType === branch;
              const color = BRANCH_COLORS[branchType]?.main || '#60A5FA';
              return (
                <TouchableOpacity
                  key={branchType}
                  style={[styles.branchBtn, selected && { backgroundColor: `${color}18` }]}
                  onPress={() => setBranch(branchType)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.branchT, selected && { color }]}>{BRANCH_LABELS[branchType]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.row}>
            <TouchableOpacity style={styles.cancel} onPress={no} activeOpacity={0.7}>
              <Text style={styles.cancelT}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.add, !val.trim() && styles.off]}
              onPress={ok}
              disabled={!val.trim()}
              activeOpacity={0.7}
            >
              <Text style={styles.addT}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kav: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  box: {
    backgroundColor: 'rgba(18,18,24,0.95)',
    borderRadius: 24,
    padding: 24,
    gap: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: 16,
    fontSize: 17,
    color: '#fff',
  },
  branchRow: { flexDirection: 'row', gap: 8 },
  branchBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
  },
  branchT: {
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.5,
  },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancel: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cancelT: { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 15 },
  add: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(96,165,250,0.18)',
  },
  off: { opacity: 0.3 },
  addT: { color: 'rgba(150,200,255,0.9)', fontWeight: '700', fontSize: 15 },
});
