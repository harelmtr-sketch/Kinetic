import React, { useState } from 'react';
import {
  Modal, KeyboardAvoidingView, TouchableOpacity, View, TextInput, Text, Platform, StyleSheet,
} from 'react-native';
import GlowText from '../common/GlowText';
import { Colors, C } from '../../theme/colors';

export default function NamePrompt({ visible, onConfirm, onCancel }) {
  const [val, setVal] = useState('');
  const ok = () => { if (val.trim()) { onConfirm(val.trim()); setVal(''); } };
  const no = () => { setVal(''); onCancel(); };
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={no}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={no} />
        <View style={styles.box}>
          <GlowText style={styles.title} color={Colors.blue[300]} glowColor="rgba(96,165,250,0.65)" outerGlowColor="rgba(59,130,246,0.3)" align="center">NEW SKILL</GlowText>
          <TextInput
            value={val}
            onChangeText={setVal}
            placeholder="Skill name..."
            placeholderTextColor={C.textFaint}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={ok}
            selectionColor={C.gold}
            style={[styles.input, { color: C.textMain }]}
          />
          <View style={styles.row}>
            <TouchableOpacity style={styles.cancel} onPress={no}><Text style={styles.cancelT}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.add, !val.trim() && styles.off]} onPress={ok} disabled={!val.trim()}><Text style={styles.addT}>ADD NODE</Text></TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'flex-start', paddingTop: 110, paddingHorizontal: 30 },
  box: { backgroundColor: C.bgCard, borderRadius: 14, padding: 24, borderWidth: 1, borderColor: C.stone },
  title: { fontSize: 14, fontWeight: '800', letterSpacing: 4, textAlign: 'center', marginBottom: 18 },
  input: { backgroundColor: '#0f172a', borderRadius: 10, padding: 16, fontSize: 17, borderWidth: 1, borderColor: C.stone, marginBottom: 16, color: C.textMain },
  row: { flexDirection: 'row', gap: 10 },
  cancel: { flex: 1, backgroundColor: '#111827', borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: C.stone },
  cancelT: { color: C.textDim, fontWeight: '600' },
  add: { flex: 1, backgroundColor: '#111827', borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: C.gold },
  off: { opacity: 0.3 },
  addT: { color: C.gold, fontWeight: '800', letterSpacing: 2 },
});
