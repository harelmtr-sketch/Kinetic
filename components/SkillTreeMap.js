import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  PanResponder,
  Animated,
} from 'react-native';
import Svg, { Line, Circle, Text as SvgText } from 'react-native-svg';
import SkillCard from './SkillCard';
import { isUnlockable, saveTree } from '../utils/treeStorage';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const NODE_RADIUS = 44;

export default function SkillTreeMap({ tree, setTree, onOpenBuilder }) {
  const [selectedNode, setSelectedNode] = useState(null);

  const translateX = useRef(0);
  const translateY = useRef(0);
  const scale = useRef(1);
  const animTranslateX = useRef(new Animated.Value(0)).current;
  const animTranslateY = useRef(new Animated.Value(0)).current;
  const animScale = useRef(new Animated.Value(1)).current;
  const lastDistance = useRef(null);
  const lastPanPos = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (evt.nativeEvent.touches.length === 1) {
          lastPanPos.current = {
            x: evt.nativeEvent.touches[0].pageX,
            y: evt.nativeEvent.touches[0].pageY,
          };
        }
        if (evt.nativeEvent.touches.length === 2) {
          const dx = evt.nativeEvent.touches[0].pageX - evt.nativeEvent.touches[1].pageX;
          const dy = evt.nativeEvent.touches[0].pageY - evt.nativeEvent.touches[1].pageY;
          lastDistance.current = Math.sqrt(dx * dx + dy * dy);
        }
      },
      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (lastDistance.current) {
            const ratio = dist / lastDistance.current;
            const newScale = Math.min(Math.max(scale.current * ratio, 0.3), 3);
            scale.current = newScale;
            animScale.setValue(newScale);
          }
          lastDistance.current = dist;
        } else if (touches.length === 1) {
          const dx = touches[0].pageX - lastPanPos.current.x;
          const dy = touches[0].pageY - lastPanPos.current.y;
          translateX.current += dx;
          translateY.current += dy;
          animTranslateX.setValue(translateX.current);
          animTranslateY.setValue(translateY.current);
          lastPanPos.current = { x: touches[0].pageX, y: touches[0].pageY };
        }
      },
      onPanResponderRelease: () => { lastDistance.current = null; },
    })
  ).current;

  function handleRecord(nodeId) {
    const newNodes = tree.nodes.map(n => n.id === nodeId ? { ...n, unlocked: true } : n);
    const newTree = { ...tree, nodes: newNodes };
    setTree(newTree);
    saveTree(newTree);
    setSelectedNode(prev => prev ? { ...prev, unlocked: true } : null);
  }

  const maxX = Math.max(...tree.nodes.map(n => n.x)) + NODE_RADIUS + 60;
  const maxY = Math.max(...tree.nodes.map(n => n.y)) + NODE_RADIUS + 60;
  const canvasW = Math.max(maxX, SCREEN_W);
  const canvasH = Math.max(maxY, SCREEN_H);

  function getNodeColor(node) {
    if (node.isStart) return { fill: '#1a237e', stroke: '#3F51B5' };
    if (node.unlocked) return { fill: '#1b5e20', stroke: '#4CAF50' };
    if (isUnlockable(node.id, tree.nodes, tree.edges)) return { fill: '#1a2a1a', stroke: '#FFC107' };
    return { fill: '#2a2a3e', stroke: '#444' };
  }

  function getEdgeColor(edge) {
    const fromNode = tree.nodes.find(n => n.id === edge.from);
    const toNode = tree.nodes.find(n => n.id === edge.to);
    if (fromNode?.unlocked && toNode?.unlocked) return '#4CAF50';
    return '#333';
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.appTitle}>⚡ Calisthenics</Text>
        <TouchableOpacity onPress={onOpenBuilder} style={styles.builderBtn}>
          <Text style={styles.builderBtnText}>🛠 Build Tree</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mapContainer} {...panResponder.panHandlers}>
        <Animated.View style={{
          transform: [
            { translateX: animTranslateX },
            { translateY: animTranslateY },
            { scale: animScale },
          ],
        }}>
          <Svg width={canvasW} height={canvasH}>
            {tree.edges.map((edge, i) => {
              const fromNode = tree.nodes.find(n => n.id === edge.from);
              const toNode = tree.nodes.find(n => n.id === edge.to);
              if (!fromNode || !toNode) return null;
              const color = getEdgeColor(edge);
              return (
                <Line
                  key={i}
                  x1={fromNode.x} y1={fromNode.y}
                  x2={toNode.x} y2={toNode.y}
                  stroke={color}
                  strokeWidth={color === '#4CAF50' ? 3 : 2}
                  strokeDasharray={color === '#4CAF50' ? undefined : '6,4'}
                />
              );
            })}

            {tree.nodes.map(node => {
              const { fill, stroke } = getNodeColor(node);
              const words = node.name.split(' ');
              const lines = [];
              let current = '';
              for (const w of words) {
                if ((current + ' ' + w).trim().length > 10) {
                  if (current) lines.push(current.trim());
                  current = w;
                } else {
                  current = current ? current + ' ' + w : w;
                }
              }
              if (current) lines.push(current.trim());
              const lineHeight = 13;
              const totalTextH = lines.length * lineHeight;
              const startTextY = node.y - totalTextH / 2 + lineHeight / 2;

              return (
                <React.Fragment key={node.id}>
                  <Circle
                    cx={node.x} cy={node.y} r={NODE_RADIUS}
                    fill={fill} stroke={stroke} strokeWidth={2.5}
                    onPress={() => setSelectedNode(node)}
                  />
                  {lines.map((line, li) => (
                    <SvgText
                      key={li}
                      x={node.x} y={startTextY + li * lineHeight}
                      fill="#fff" fontSize={11} fontWeight="bold"
                      textAnchor="middle"
                      onPress={() => setSelectedNode(node)}>
                      {line}
                    </SvgText>
                  ))}
                </React.Fragment>
              );
            })}
          </Svg>
        </Animated.View>
      </View>

      <View style={styles.legend}>
        {[['#4CAF50','Unlocked'],['#FFC107','Ready'],['#444','Locked'],['#3F51B5','Start']].map(([color, label]) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {selectedNode && (
        <SkillCard
          node={selectedNode}
          nodes={tree.nodes}
          edges={tree.edges}
          onClose={() => setSelectedNode(null)}
          onRecord={handleRecord}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a12' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, backgroundColor: '#0f0f1a', borderBottomWidth: 1, borderColor: '#1a1a2e' },
  appTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', letterSpacing: 1 },
  builderBtn: { backgroundColor: '#1a1a2e', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  builderBtnText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  mapContainer: { flex: 1, overflow: 'hidden' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingVertical: 10, backgroundColor: '#0f0f1a', borderTopWidth: 1, borderColor: '#1a1a2e' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { color: '#666', fontSize: 11 },
});
```

Save with **Ctrl+S**.

---

Now the last step — in PowerShell run:
```