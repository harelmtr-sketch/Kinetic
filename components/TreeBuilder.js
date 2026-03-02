import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { saveTree } from '../utils/treeStorage';

export default function TreeBuilder({ tree, setTree, onClose }) {
  const [tab, setTab] = useState('nodes');
  const [nodeName, setNodeName] = useState('');
  const [nodeDesc, setNodeDesc] = useState('');
  const [nodeVisual, setNodeVisual] = useState('');
  const [nodeX, setNodeX] = useState('300');
  const [nodeY, setNodeY] = useState('300');
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [edgeFrom, setEdgeFrom] = useState('');
  const [edgeTo, setEdgeTo] = useState('');

  function generateId(name) {
    return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now();
  }

  function handleSaveNode() {
    if (!nodeName.trim()) return Alert.alert('Name required', 'Please enter a skill name.');
    const x = parseFloat(nodeX) || 300;
    const y = parseFloat(nodeY) || 300;
    let updatedNodes;
    if (editingNodeId) {
      updatedNodes = tree.nodes.map(n =>
        n.id === editingNodeId
          ? { ...n, name: nodeName.trim(), description: nodeDesc.trim(), visualPlaceholder: nodeVisual.trim(), x, y }
          : n
      );
    } else {
      const newNode = {
        id: generateId(nodeName),
        name: nodeName.trim(),
        x, y,
        unlocked: false,
        isStart: false,
        description: nodeDesc.trim() || 'No description yet.',
        visualPlaceholder: nodeVisual.trim() || '[Visual placeholder — add image/video description here]',
      };
      updatedNodes = [...tree.nodes, newNode];
    }
    const newTree = { ...tree, nodes: updatedNodes };
    setTree(newTree);
    saveTree(newTree);
    clearNodeForm();
    Alert.alert('Saved!', editingNodeId ? 'Node updated.' : 'New node added!');
  }

  function clearNodeForm() {
    setNodeName(''); setNodeDesc(''); setNodeVisual('');
    setNodeX('300'); setNodeY('300'); setEditingNodeId(null);
  }

  function handleEditNode(node) {
    setNodeName(node.name); setNodeDesc(node.description);
    setNodeVisual(node.visualPlaceholder);
    setNodeX(String(node.x)); setNodeY(String(node.y));
    setEditingNodeId(node.id); setTab('nodes');
  }

  function handleDeleteNode(nodeId) {
    Alert.alert('Delete Node', 'This will also remove all connected edges. Sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        const newTree = {
          nodes: tree.nodes.filter(n => n.id !== nodeId),
          edges: tree.edges.filter(e => e.from !== nodeId && e.to !== nodeId),
        };
        setTree(newTree); saveTree(newTree);
      }},
    ]);
  }

  function handleAddEdge() {
    const from = edgeFrom.trim();
    const to = edgeTo.trim();
    if (!from || !to) return Alert.alert('Required', 'Please select both nodes.');
    if (from === to) return Alert.alert('Invalid', 'Cannot connect a node to itself.');
    if (tree.edges.some(e => e.from === from && e.to === to)) return Alert.alert('Exists', 'Connection already exists.');
    const fromNode = tree.nodes.find(n => n.id === from);
    const toNode = tree.nodes.find(n => n.id === to);
    if (!fromNode || !toNode) return Alert.alert('Invalid', 'Node not found.');
    const newTree = { ...tree, edges: [...tree.edges, { from, to }] };
    setTree(newTree); saveTree(newTree);
    setEdgeFrom(''); setEdgeTo('');
    Alert.alert('Connected!', `${fromNode.name} → ${toNode.name}`);
  }

  function handleDeleteEdge(from, to) {
    const newTree = { ...tree, edges: tree.edges.filter(e => !(e.from === from && e.to === to)) };
    setTree(newTree); saveTree(newTree);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>🛠 Tree Builder</Text>
        <TouchableOpacity onPress={onClose} style={styles.doneBtn}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'nodes' && styles.tabActive]} onPress={() => setTab('nodes')}>
          <Text style={[styles.tabText, tab === 'nodes' && styles.tabTextActive]}>Nodes ({tree.nodes.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'edges' && styles.tabActive]} onPress={() => setTab('edges')}>
          <Text style={[styles.tabText, tab === 'edges' && styles.tabTextActive]}>Connections ({tree.edges.length})</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {tab === 'nodes' && (
          <View>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>{editingNodeId ? '✏️ Edit Node' : '➕ Add New Node'}</Text>
              <Text style={styles.label}>Skill Name *</Text>
              <TextInput style={styles.input} value={nodeName} onChangeText={setNodeName} placeholder="e.g. Muscle Up" placeholderTextColor="#555" />
              <Text style={styles.label}>Description</Text>
              <TextInput style={[styles.input, styles.multiline]} value={nodeDesc} onChangeText={setNodeDesc} placeholder="Describe the skill..." placeholderTextColor="#555" multiline numberOfLines={3} />
              <Text style={styles.label}>Visual Placeholder</Text>
              <TextInput style={styles.input} value={nodeVisual} onChangeText={setNodeVisual} placeholder="e.g. [Video: tutorial]" placeholderTextColor="#555" />
              <View style={styles.row}>
                <View style={styles.halfField}>
                  <Text style={styles.label}>X Position</Text>
                  <TextInput style={styles.input} value={nodeX} onChangeText={setNodeX} keyboardType="numeric" placeholderTextColor="#555" />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.label}>Y Position</Text>
                  <TextInput style={styles.input} value={nodeY} onChangeText={setNodeY} keyboardType="numeric" placeholderTextColor="#555" />
                </View>
              </View>
              <View style={styles.formBtns}>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveNode}>
                  <Text style={styles.saveBtnText}>{editingNodeId ? 'Update Node' : 'Add Node'}</Text>
                </TouchableOpacity>
                {editingNodeId && (
                  <TouchableOpacity style={styles.cancelBtn} onPress={clearNodeForm}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <Text style={styles.sectionLabel}>All Nodes</Text>
            {tree.nodes.map(node => (
              <View key={node.id} style={styles.listItem}>
                <View style={styles.listItemInfo}>
                  <Text style={styles.listItemName}>{node.isStart ? '⭐ ' : ''}{node.name}</Text>
                  <Text style={styles.listItemId}>id: {node.id}</Text>
                  <Text style={styles.listItemPos}>x:{node.x} y:{node.y}</Text>
                </View>
                <View style={styles.listItemActions}>
                  {!node.isStart && (
                    <>
                      <TouchableOpacity onPress={() => handleEditNode(node)} style={styles.editBtn}>
                        <Text style={styles.editBtnText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteNode(node.id)} style={styles.deleteBtn}>
                        <Text style={styles.deleteBtnText}>Del</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {tab === 'edges' && (
          <View>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>➕ Add Connection</Text>
              <Text style={styles.hint}>Tap a node chip below to fill From/To fields.</Text>
              <Text style={styles.label}>From Node (ID)</Text>
              <TextInput style={styles.input} value={edgeFrom} onChangeText={setEdgeFrom} placeholder="e.g. start" placeholderTextColor="#555" autoCapitalize="none" />
              <Text style={styles.label}>To Node (ID)</Text>
              <TextInput style={styles.input} value={edgeTo} onChangeText={setEdgeTo} placeholder="e.g. dead_hang" placeholderTextColor="#555" autoCapitalize="none" />
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddEdge}>
                <Text style={styles.saveBtnText}>Add Connection</Text>
              </TouchableOpacity>
              <View style={styles.quickConnectRow}>
                {tree.nodes.map(n => (
                  <TouchableOpacity key={n.id} style={styles.quickChip}
                    onPress={() => { if (!edgeFrom) setEdgeFrom(n.id); else if (!edgeTo) setEdgeTo(n.id); else setEdgeFrom(n.id); }}>
                    <Text style={styles.quickChipText}>{n.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={styles.sectionLabel}>All Connections</Text>
            {tree.edges.map((edge, i) => {
              const fromNode = tree.nodes.find(n => n.id === edge.from);
              const toNode = tree.nodes.find(n => n.id === edge.to);
              return (
                <View key={i} style={styles.listItem}>
                  <Text style={styles.edgeText}>{fromNode?.name} → {toNode?.name}</Text>
                  <TouchableOpacity onPress={() => handleDeleteEdge(edge.from, edge.to)} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>Del</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50, borderBottomWidth: 1, borderColor: '#222' },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  doneBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  doneBtnText: { color: '#fff', fontWeight: 'bold' },
  tabs: { flexDirection: 'row', backgroundColor: '#111' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderColor: '#4CAF50' },
  tabText: { color: '#555', fontWeight: '600' },
  tabTextActive: { color: '#4CAF50' },
  scroll: { flex: 1, padding: 16 },
  formCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  formTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  label: { color: '#888', fontSize: 12, marginBottom: 4, marginTop: 10, textTransform: 'uppercase', letterSpacing: 1 },
  input: { backgroundColor: '#111', borderRadius: 10, color: '#fff', padding: 12, fontSize: 14, borderWidth: 1, borderColor: '#333' },
  multiline: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10 },
  halfField: { flex: 1 },
  formBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  saveBtn: { flex: 1, backgroundColor: '#4CAF50', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  cancelBtn: { backgroundColor: '#333', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center' },
  cancelBtnText: { color: '#aaa', fontWeight: 'bold' },
  sectionLabel: { color: '#888', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  listItem: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#2a2a3e' },
  listItemInfo: { flex: 1 },
  listItemName: { color: '#fff', fontWeight: '600', fontSize: 14 },
  listItemId: { color: '#555', fontSize: 11 },
  listItemPos: { color: '#444', fontSize: 11 },
  listItemActions: { flexDirection: 'row', gap: 6 },
  editBtn: { backgroundColor: '#1565C0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  editBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  deleteBtn: { backgroundColor: '#B71C1C', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  deleteBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  edgeText: { color: '#ddd', fontSize: 14, flex: 1 },
  hint: { color: '#555', fontSize: 12, marginBottom: 8 },
  quickConnectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  quickChip: { backgroundColor: '#222', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#444' },
  quickChipText: { color: '#aaa', fontSize: 12 },
});