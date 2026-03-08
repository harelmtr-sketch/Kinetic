import React, {
  useState, useRef, useEffect, useMemo,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  PanResponder, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';
import NamePrompt from '../components/tree/NamePrompt';
import SkillCard from '../components/tree/SkillCard';
import GlowText from '../components/common/GlowText';
import SkiaTreeCanvas from '../components/tree/SkiaTreeCanvas';
import { BRANCH_COLORS, Colors } from '../theme/colors';
import {
  STORAGE_KEY, NODE_R, MIN_SC, MAX_SC, DEV_PERF_LOG,
} from '../constants/tree';
import { INIT } from '../data/initialTree';
import {
  normalizeTree, segDist, resolveBranch, segmentIntersectsRect, toRGBA,
} from '../utils/treeUtils';

export default function TreeScreen({ onTreeChange }) {
  const insets = useSafeAreaInsets();
  const [tree, _setTree] = useState(normalizeTree(INIT));
  const tR = useRef(normalizeTree(INIT));
  const setTree = (t) => { tR.current = t; _setTree(t); };
  const hist = useRef([normalizeTree(INIT)]); const hi = useRef(0);
  const [canUndo, setCU] = useState(false); const [canRedo, setCR] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw);
        if (saved?.nodes && saved?.edges) {
          const t = normalizeTree(saved);
          hist.current = [t]; hi.current = 0;
          setTree(t); setCU(false); setCR(false);
        }
      } catch (e) {}
    });
  }, []);

  useEffect(() => { onTreeChange?.(tree); }, [onTreeChange, tree]);

  const commit = (t) => {
    const h = hist.current.slice(0, hi.current + 1); h.push(t);
    hist.current = h; hi.current = h.length - 1; setTree(t); setCU(true); setCR(false);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(t)).catch(() => {});
  };
  const undo = () => { if (!hi.current) return; hi.current -= 1; const t = hist.current[hi.current]; setTree(t); setCU(hi.current > 0); setCR(true); };
  const redo = () => { if (hi.current >= hist.current.length - 1) return; hi.current += 1; const t = hist.current[hi.current]; setTree(t); setCU(true); setCR(hi.current < hist.current.length - 1); };

  const [bld, _setBld] = useState(false); const bR = useRef(false); const setBld = (v) => { bR.current = v; _setBld(v); };
  const [tool, _setTool] = useState('move'); const tR2 = useRef('move'); const setTool = (v) => { tR2.current = v; _setTool(v); };
  const [connA, _setConnA] = useState(null); const cAR = useRef(null); const setConnA = (v) => { cAR.current = v; _setConnA(v); };
  const [sel, setSel] = useState(null);
  const [prompt, showPrompt] = useState(false);
  const pendingPos = useRef({ x: 450, y: 400 });

  const txN = useRef(0); const tyN = useRef(0); const scN = useRef(1);
  const txV = useSharedValue(0); const tyV = useSharedValue(0); const scV = useSharedValue(1);
  const dragXV = useSharedValue(0); const dragYV = useSharedValue(0);
  const [dragId, setDragId] = useState(null);
  const [xform, setXform] = useState({ tx: 0, ty: 0, sc: 1 });
  const gestureActive = useRef(false);
  const setLiveXform = (tx, ty, sc) => {
    txN.current = tx; tyN.current = ty; scN.current = sc;
    txV.value = tx; tyV.value = ty; scV.value = sc;
  };
  const commitLiveXform = () => {
    const next = { tx: txN.current, ty: tyN.current, sc: scN.current };
    setXform((prev) => (prev.tx === next.tx && prev.ty === next.ty && prev.sc === next.sc ? prev : next));
  };

  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  useEffect(() => { setLiveXform(txN.current, tyN.current, scN.current); }, [tree, bld, tool, connA, sel, prompt]);
  useEffect(() => { setLiveXform(xform.tx, xform.ty, xform.sc); }, [xform.sc, xform.tx, xform.ty]);

  const glowDebounceRef = useRef(null);
  useEffect(() => () => {
    if (glowDebounceRef.current) clearTimeout(glowDebounceRef.current);
  }, []);

  const cL = useRef(0); const cT = useRef(0); const cRef = useRef(null);
  const measureC = () => cRef.current?.measure((_, __, _w, _h, px, py) => { cL.current = px; cT.current = py; });

  const toSVG = (px, py) => ({
    x: (px - cL.current - txN.current) / scN.current,
    y: (py - cT.current - tyN.current) / scN.current,
  });
  const hitNode = (px, py) => {
    const p = toSVG(px, py);
    return tR.current.nodes.find((n) => Math.hypot(n.x - p.x, n.y - p.y) <= NODE_R + 14);
  };

  const gSx = useRef(0); const gSy = useRef(0); const gLx = useRef(0); const gLy = useRef(0); const moved = useRef(false);
  const pOn = useRef(false); const pD0 = useRef(0); const pSc0 = useRef(1); const pTx0 = useRef(0); const pTy0 = useRef(0);
  const pMx0 = useRef(0); const pMy0 = useRef(0);
  const dId = useRef(null); const dNx = useRef(0); const dNy = useRef(0); const dPx = useRef(0); const dPy = useRef(0);
  const dragLive = useRef({ id: null, x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState(false);
  const interactionTier = useMemo(() => {
    if (!isInteracting) return 'idle';
    if (xform.sc < 0.4) return 'heavy';
    return xform.sc < 0.9 ? 'medium' : 'light';
  }, [isInteracting, xform.sc]);

  const setDragPos = (id, x, y) => {
    dragXV.value = x;
    dragYV.value = y;
    if (dId.current !== id) { dId.current = id; setDragId(id); }
  };
  const clearDragPos = () => {
    dId.current = null;
    dragLive.current = { id: null, x: 0, y: 0 };
    setDragId(null);
  };
  const beginInteraction = () => {
    if (glowDebounceRef.current) {
      clearTimeout(glowDebounceRef.current);
      glowDebounceRef.current = null;
    }
    setIsInteracting(true);
  };
  const endInteraction = () => {
    if (glowDebounceRef.current) clearTimeout(glowDebounceRef.current);
    glowDebounceRef.current = setTimeout(() => {
      setIsInteracting(false);
      glowDebounceRef.current = null;
    }, 90);
  };

  const panR = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.hypot(g.dx, g.dy) > 3,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: (evt) => {
      const ts = evt.nativeEvent.touches;
      moved.current = false; pOn.current = false;
      clearDragPos();
      beginInteraction();
      if (ts.length >= 2) {
        gestureActive.current = true;
        pOn.current = true;
        pD0.current = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
        pSc0.current = scN.current; pTx0.current = txN.current; pTy0.current = tyN.current;
        pMx0.current = (ts[0].pageX + ts[1].pageX) / 2 - cL.current;
        pMy0.current = (ts[0].pageY + ts[1].pageY) / 2 - cT.current;
        return;
      }
      const t = ts[0];
      gSx.current = t.pageX; gSy.current = t.pageY; gLx.current = t.pageX; gLy.current = t.pageY;
      if (bR.current && tR2.current === 'move') {
        const hit = hitNode(t.pageX, t.pageY);
        if (hit) {
          dNx.current = hit.x; dNy.current = hit.y;
          const p = toSVG(t.pageX, t.pageY); dPx.current = p.x; dPy.current = p.y;
          dragLive.current = { id: hit.id, x: hit.x, y: hit.y };
          setDragPos(hit.id, hit.x, hit.y);
        }
      }
    },
    onPanResponderMove: (evt) => {
      const ts = evt.nativeEvent.touches;
      if (!pOn.current && ts.length >= 2) {
        gestureActive.current = true;
        pOn.current = true;
        pD0.current = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
        pSc0.current = scN.current; pTx0.current = txN.current; pTy0.current = tyN.current;
        pMx0.current = (ts[0].pageX + ts[1].pageX) / 2 - cL.current;
        pMy0.current = (ts[0].pageY + ts[1].pageY) / 2 - cT.current;
        return;
      }
      if (pOn.current && ts.length < 2) { pOn.current = false; return; }
      if (pOn.current && ts.length >= 2) {
        const d = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
        const newSc = Math.min(Math.max(pSc0.current * (d / pD0.current), MIN_SC), MAX_SC);
        const curMx = (ts[0].pageX + ts[1].pageX) / 2 - cL.current;
        const curMy = (ts[0].pageY + ts[1].pageY) / 2 - cT.current;
        const svgMx = (pMx0.current - pTx0.current) / pSc0.current;
        const svgMy = (pMy0.current - pTy0.current) / pSc0.current;
        setLiveXform(curMx - svgMx * newSc, curMy - svgMy * newSc, newSc);
        moved.current = true; return;
      }
      if (ts.length !== 1) return;
      const t = ts[0];
      if (Math.hypot(t.pageX - gSx.current, t.pageY - gSy.current) > 6) moved.current = true;
      if (bR.current && tR2.current === 'move' && dId.current) {
        const p = toSVG(t.pageX, t.pageY);
        const nx = dNx.current + (p.x - dPx.current); const ny = dNy.current + (p.y - dPy.current);
        dragLive.current = { id: dId.current, x: nx, y: ny };
        dragXV.value = nx; dragYV.value = ny;
        gLx.current = t.pageX; gLy.current = t.pageY; return;
      }
      gestureActive.current = true;
      setLiveXform(txN.current + (t.pageX - gLx.current), tyN.current + (t.pageY - gLy.current), scN.current);
      gLx.current = t.pageX; gLy.current = t.pageY;
    },
    onPanResponderRelease: (evt) => {
      pOn.current = false;
      if (gestureActive.current) {
        gestureActive.current = false;
        commitLiveXform();
      }
      endInteraction();
      if (bR.current && tR2.current === 'move' && dId.current && moved.current) {
        const live = dragLive.current;
        if (live.id) {
          commit({ ...tR.current, nodes: tR.current.nodes.map((n) => (n.id === live.id ? { ...n, x: live.x, y: live.y } : n)) });
        }
        clearDragPos();
        return;
      }
      clearDragPos();
      if (moved.current) return;
      const { pageX, pageY } = evt.nativeEvent;
      const hit = hitNode(pageX, pageY);
      if (!bR.current) { if (hit) setSel({ ...hit }); return; }
      if (tR2.current === 'move' && !hit) {
        const p = toSVG(pageX, pageY); pendingPos.current = { x: p.x, y: p.y }; showPrompt(true); return;
      }
      if (tR2.current === 'connect' && hit) {
        const first = cAR.current;
        if (!first) { setConnA(hit.id); return; }
        if (first === hit.id) { setConnA(null); return; }
        const ex = tR.current.edges.some((e) => (e.from === first && e.to === hit.id) || (e.from === hit.id && e.to === first));
        if (!ex) commit({ ...tR.current, edges: [...tR.current.edges, { from: first, to: hit.id }] });
        setConnA(null); return;
      }
      if (tR2.current === 'delete') {
        if (hit && !hit.isStart) {
          Alert.alert('Delete', `Delete "${hit.name}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete', style: 'destructive', onPress: () => {
                const nextInfo = { ...(tR.current.info || {}) };
                delete nextInfo[hit.id];
                commit({
                  ...tR.current,
                  nodes: tR.current.nodes.filter((n) => n.id !== hit.id),
                  edges: tR.current.edges.filter((e) => e.from !== hit.id && e.to !== hit.id),
                  info: nextInfo,
                });
              },
            },
          ]); return;
        }
        if (!hit) {
          const p = toSVG(pageX, pageY);
          const nodeById = new Map(tR.current.nodes.map((n) => [n.id, n]));
          const idx = tR.current.edges.findIndex((e) => {
            const fn = nodeById.get(e.from);
            const tn = nodeById.get(e.to);
            return fn && tn && segDist(p.x, p.y, fn.x, fn.y, tn.x, tn.y) < 28;
          });
          if (idx !== -1) commit({ ...tR.current, edges: tR.current.edges.filter((_, i) => i !== idx) });
        }
      }
    },
    onPanResponderTerminate: () => {
      pOn.current = false;
      if (gestureActive.current) { gestureActive.current = false; commitLiveXform(); }
      endInteraction();
      clearDragPos();
    },
  })).current;

  const addNode = (name) => {
    const id = `${name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}_${Date.now()}`;
    commit({
      ...tR.current,
      nodes: [...tR.current.nodes, {
        id, name, x: pendingPos.current.x, y: pendingPos.current.y, unlocked: false, isStart: false, branch: 'core',
      }],
      info: { ...tR.current.info, [id]: { desc: 'No description yet.', str: 5, bal: 5, tec: 5 } },
    });
    showPrompt(false);
  };
  const record = (id) => {
    const t = { ...tR.current, nodes: tR.current.nodes.map((n) => (n.id === id ? { ...n, unlocked: true } : n)) };
    commit(t); setSel((prev) => (prev ? { ...prev, unlocked: true } : null));
  };

  const exportTree = async () => {
    try {
      const json = JSON.stringify(tR.current, null, 2);
      const path = `${FileSystem.cacheDirectory}calisthenics_tree.json`;
      await FileSystem.writeAsStringAsync(path, json, { encoding: 'utf8' });
      await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Export Skill Tree' });
    } catch (e) { Alert.alert('Export failed', String(e)); }
  };

  const importTree = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (res.canceled) return;
      const raw = await FileSystem.readAsStringAsync(res.assets[0].uri, { encoding: 'utf8' });
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
        Alert.alert('Invalid file', 'Not a valid skill tree JSON.');
        return;
      }
      const t = normalizeTree(parsed);
      Alert.alert('Import Tree', 'Replace current tree with imported one?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import', onPress: () => {
            hist.current = [t]; hi.current = 0;
            setTree(t); setCU(false); setCR(false);
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(t)).catch(() => {});
          },
        },
      ]);
    } catch (e) { Alert.alert('Import failed', String(e)); }
  };

  const nodeMap = useMemo(() => new Map(tree.nodes.map((n) => [n.id, n])), [tree.nodes]);
  const incomingByNode = useMemo(() => {
    const incoming = new Map();
    for (const e of tree.edges) {
      if (!incoming.has(e.to)) incoming.set(e.to, []);
      incoming.get(e.to).push(e.from);
    }
    return incoming;
  }, [tree.edges]);

  const nodeStatusMap = useMemo(() => {
    const status = {};
    for (const n of tree.nodes) {
      if (n.isStart) {
        status[n.id] = 'start';
        continue;
      }
      if (n.unlocked) {
        status[n.id] = 'mastered';
        continue;
      }
      if (!bld) {
        const prereqs = incomingByNode.get(n.id) || [];
        const ready = prereqs.length > 0 && prereqs.every((pid) => nodeMap.get(pid)?.unlocked);
        status[n.id] = ready ? 'ready' : 'locked';
      } else {
        status[n.id] = 'locked';
      }
    }
    return status;
  }, [tree.nodes, bld, incomingByNode, nodeMap]);

  const wrap = (name) => {
    const words = name.split(' '); const lines = []; let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (next.length > 10 && cur) { lines.push(cur); cur = w; } else cur = next;
    }
    if (cur) lines.push(cur); return lines;
  };

  const wrappedLabels = useMemo(() => {
    const labels = {};
    for (const n of tree.nodes) labels[n.id] = wrap(n.name);
    return labels;
  }, [tree.nodes]);

  const visibleBounds = useMemo(() => {
    if (!canvasSize.width || !canvasSize.height) return null;
    return {
      left: (-xform.tx) / xform.sc,
      top: (-xform.ty) / xform.sc,
      right: (canvasSize.width - xform.tx) / xform.sc,
      bottom: (canvasSize.height - xform.ty) / xform.sc,
    };
  }, [canvasSize.height, canvasSize.width, xform.sc, xform.tx, xform.ty]);

  const visibleNodes = useMemo(() => {
    if (!visibleBounds) return tree.nodes;
    const margin = Math.min(Math.max((NODE_R * 2) / xform.sc, NODE_R * 2), NODE_R * 12);
    return tree.nodes.filter((n) => (
      n.x >= visibleBounds.left - margin && n.x <= visibleBounds.right + margin
      && n.y >= visibleBounds.top - margin && n.y <= visibleBounds.bottom + margin
    ));
  }, [tree.nodes, visibleBounds, xform.sc]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const visibleEdges = useMemo(() => {
    if (!visibleBounds) return tree.edges;
    const edgeMargin = NODE_R * (xform.sc < 0.6 ? 1.6 : 2.2);
    const edgeRect = {
      left: visibleBounds.left - edgeMargin,
      top: visibleBounds.top - edgeMargin,
      right: visibleBounds.right + edgeMargin,
      bottom: visibleBounds.bottom + edgeMargin,
    };

    return tree.edges.filter((e) => {
      if (visibleNodeIds.has(e.from) || visibleNodeIds.has(e.to)) return true;
      const fn = nodeMap.get(e.from);
      const tn = nodeMap.get(e.to);
      if (!fn || !tn) return false;
      return segmentIntersectsRect(fn.x, fn.y, tn.x, tn.y, edgeRect);
    });
  }, [tree.edges, visibleNodeIds, visibleBounds, xform.sc, nodeMap]);

  const lodTier = useMemo(() => {
    if (xform.sc < 0.32) return 'far';
    if (xform.sc < 0.72) return 'mid';
    return 'near';
  }, [xform.sc]);

  const LOD = useMemo(() => {
    const isFar = lodTier === 'far';
    const isMid = lodTier === 'mid';
    const isNear = lodTier === 'near';
    const forceCheap = interactionTier === 'heavy';

    return {
      isFar,
      isMid,
      isNear,
      interactionTier,
      showLabels: isNear && interactionTier === 'idle',
      showInnerRing: !isFar && !forceCheap,
      showOuterRing: isNear && interactionTier !== 'heavy',
      useDashedReady: isNear && interactionTier === 'idle',
      showEdgeGlow: isNear && interactionTier === 'idle',
      showNodeGlowBlur: isNear && interactionTier === 'idle',
      simplifyNodeStack: isFar || interactionTier === 'heavy',
      showNodeHighlight: !isFar && interactionTier !== 'heavy',
      showDust: !forceCheap,
    };
  }, [interactionTier, lodTier]);

  const nodeStyles = useMemo(() => {
    const nb = BRANCH_COLORS.neutral;
    const map = {};
    for (const n of visibleNodes) {
      const branch = resolveBranch(n);
      const bc = BRANCH_COLORS[branch] || nb;
      const status = nodeStatusMap[n.id] || 'locked';
      if (bld && connA === n.id) {
        map[n.id] = {
          fill: '#132238', innerFill: '#0C1728', outerRim: '#2B3C55',
          stroke: nb.main, ring: toRGBA(nb.ring, 0.88),
          glowInner: toRGBA(nb.main, 0.38), glowOuter: toRGBA(nb.main, 0.20), sw: 2.7, opacity: 1,
        };
      } else if (status === 'start') {
        map[n.id] = {
          fill: '#172A43', innerFill: '#0F1D30', outerRim: '#2C4060',
          stroke: nb.main, ring: toRGBA(nb.ring, 0.82),
          glowInner: toRGBA(nb.main, 0.36), glowOuter: toRGBA(nb.main, 0.18), sw: 2.5, opacity: 1,
        };
      } else if (status === 'mastered') {
        map[n.id] = {
          fill: '#131B28', innerFill: '#0B1220', outerRim: '#243444',
          stroke: bc.main, ring: toRGBA(bc.ring, 0.92),
          glowInner: toRGBA(bc.ring, 0.42), glowOuter: toRGBA(bc.main, 0.24), sw: 2.55, opacity: 1,
        };
      } else if (status === 'ready') {
        map[n.id] = {
          fill: '#19212F', innerFill: '#101826', outerRim: '#2A3848',
          stroke: bc.main, ring: toRGBA(bc.ring, 0.84),
          glowInner: toRGBA(bc.ring, 0.32), glowOuter: toRGBA(bc.main, 0.17), sw: 2.25, opacity: 0.97,
        };
      } else {
        map[n.id] = {
          fill: '#080E18', innerFill: '#050A10', outerRim: '#131D2A',
          stroke: 'rgba(85,100,125,0.30)', ring: 'rgba(85,100,125,0.18)',
          glowInner: 'rgba(85,100,125,0.05)', glowOuter: 'rgba(85,100,125,0.03)', sw: 1.2, opacity: 0.82,
        };
      }
    }
    return map;
  }, [visibleNodes, nodeStatusMap, bld, connA]);

  const edgeVisual = useMemo(() => {
    if (LOD.isFar) return {
      masteredW: 1.2, readyW: 1.05, lockedW: 0.9, masteredO: 0.68, readyO: 0.56, lockedO: 0.28,
    };
    if (LOD.isMid) return {
      masteredW: 1.9, readyW: 1.55, lockedW: 1.2, masteredO: 0.8, readyO: 0.68, lockedO: 0.34,
    };
    return {
      masteredW: 2.8, readyW: 2.3, lockedW: 1.5, masteredO: 0.9, readyO: 0.8, lockedO: 0.44,
    };
  }, [LOD.isFar, LOD.isMid]);

  useEffect(() => {
    if (!DEV_PERF_LOG) return;
    const id = setInterval(() => {
      console.log('[perf]', {
        visibleNodes: visibleNodes.length,
        visibleEdges: visibleEdges.length,
        scale: xform.sc.toFixed(3),
        lodTier,
      });
    }, 1000);
    return () => clearInterval(id);
  }, [visibleNodes.length, visibleEdges.length, xform.sc, lodTier]);

  const hints = {
    move: 'Drag nodes to reposition · Tap empty space to add',
    connect: connA ? 'Now tap second node to connect' : 'Tap first node to begin branch',
    delete: 'Tap a node or line to delete it',
  };

  return (
    <View style={styles.root}>
      <View style={[styles.bar, { paddingTop: insets.top + 10 }]}>
        <View style={styles.titleWrap}>
          <GlowText style={styles.title} color={Colors.blue[300]} glowColor="rgba(96,165,250,0.72)" outerGlowColor="rgba(59,130,246,0.38)" numberOfLines={1}>KINETIC SKILL TREE</GlowText>
        </View>
        <View style={styles.barRight}>
          {!bld && (
            <TouchableOpacity style={styles.resetBtn} onPress={() => {
              Alert.alert('Reset Progress', 'Set all skills back to locked? Your tree structure stays intact.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Reset', style: 'destructive', onPress: () => {
                    const t = { ...tR.current, nodes: tR.current.nodes.map((n) => (n.isStart ? n : { ...n, unlocked: false })) };
                    commit(t);
                  },
                },
              ]);
            }}>
              <Text style={styles.resetT}>RESET</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.modeBtn, bld && styles.modeOn]} onPress={() => { setBld(!bld); setConnA(null); dId.current = null; }}>
            <Text style={[styles.modeT, bld && styles.modeTOn]}>{bld ? 'DONE' : 'EDIT TREE'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {bld && (
        <View style={styles.toolbar}>
          <View style={styles.tg}>
            {[['move', 'Move/Add'], ['connect', 'Connect'], ['delete', 'Delete']].map(([id, lbl]) => (
              <TouchableOpacity key={id} style={[styles.tBtn, tool === id && styles.tOn]} onPress={() => { setTool(id); setConnA(null); }}>
                <Text style={[styles.tT, tool === id && styles.tTOn]}>{lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.tg}>
            <TouchableOpacity style={[styles.uBtn, !canUndo && styles.dim]} onPress={undo} disabled={!canUndo}><Text style={styles.uT}>Undo</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.uBtn, !canRedo && styles.dim]} onPress={redo} disabled={!canRedo}><Text style={styles.uT}>Redo</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {bld && (
        <View style={styles.ioRow}>
          <TouchableOpacity style={styles.ioBtn} onPress={exportTree}><Text style={styles.ioT}>⬆  EXPORT</Text></TouchableOpacity>
          <TouchableOpacity style={styles.ioBtn} onPress={importTree}><Text style={styles.ioT}>⬇  IMPORT</Text></TouchableOpacity>
        </View>
      )}
      {bld && <View style={styles.hintRow}><Text style={styles.hintT}>{hints[tool]}</Text></View>}

      <View
        ref={cRef}
        style={styles.canvas}
        onLayout={(evt) => {
          const { width, height } = evt.nativeEvent.layout;
          setCanvasSize({ width, height });
          setTimeout(measureC, 50);
        }}
        {...panR.panHandlers}
      >
        {!!canvasSize.width && !!canvasSize.height && (
          <SkiaTreeCanvas
            nodes={tree.nodes}
            visibleNodes={visibleNodes}
            visibleEdges={visibleEdges}
            nodeStatusMap={nodeStatusMap}
            wrappedLabels={wrappedLabels}
            txV={txV}
            tyV={tyV}
            scV={scV}
            dragId={dragId}
            dragXV={dragXV}
            dragYV={dragYV}
            LOD={LOD}
            edgeVisual={edgeVisual}
            bld={bld}
            connA={connA}
            isInteracting={isInteracting}
            canvasSize={canvasSize}
            nodeStyles={nodeStyles}
          />
        )}
      </View>

      {!bld && (
        <View style={styles.legend}>
          {[
            [BRANCH_COLORS.push.main, 'Push'],
            [BRANCH_COLORS.pull.main, 'Pull'],
            [BRANCH_COLORS.core.main, 'Core'],
            ['#334155', 'Locked'],
          ].map(([c, l]) => (
            <View key={l} style={styles.lr}>
              <View style={[styles.dot, { backgroundColor: c }]} />
              <Text style={styles.lt}>{l}</Text>
            </View>
          ))}
        </View>
      )}

      <NamePrompt visible={prompt} onConfirm={addNode} onCancel={() => showPrompt(false)} />
      {sel && !bld && (
        <SkillCard
          node={sel}
          nodes={tree.nodes}
          edges={tree.edges}
          info={tree.info?.[sel.id]}
          onClose={() => setSel(null)}
          onRecord={record}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  bar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, gap: 10,
    backgroundColor: '#060A10', borderBottomWidth: 1, borderColor: Colors.border.default,
  },
  barRight: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0, minWidth: 0,
  },
  titleWrap: { flex: 1, minWidth: 0, paddingRight: 4 },
  title: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2.2,
    flexShrink: 1,
    paddingRight: 6,
  },
  resetBtn: {
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#151922', borderWidth: 1, borderColor: 'rgba(239,68,68,0.6)',
    shadowColor: '#EF4444', shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  resetT: { color: '#f87171', fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2 },
  modeBtn: {
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6,
    backgroundColor: '#151a24', borderWidth: 1, borderColor: Colors.border.default,
  },
  modeOn: { backgroundColor: '#12283d', borderColor: 'rgba(59,130,246,0.45)' },
  modeT: {
    color: Colors.text.tertiary, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2,
  },
  modeTOn: { color: Colors.green[400] },
  toolbar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 10, rowGap: 8,
    backgroundColor: Colors.background.secondary, borderBottomWidth: 1, borderColor: Colors.border.default, flexWrap: 'wrap',
  },
  tg: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  tBtn: {
    paddingHorizontal: 11, paddingVertical: 8, borderRadius: 6,
    backgroundColor: '#121722', borderWidth: 1, borderColor: Colors.border.default,
  },
  tOn: { backgroundColor: 'rgba(59,130,246,0.18)', borderColor: 'rgba(59,130,246,0.4)' },
  tT: { color: Colors.text.tertiary, fontSize: 12, fontWeight: '600' },
  tTOn: { color: Colors.blue[300] },
  uBtn: {
    paddingHorizontal: 11, paddingVertical: 8, borderRadius: 6,
    backgroundColor: Colors.background.primary, borderWidth: 1, borderColor: Colors.border.default,
  },
  dim: { opacity: 0.2 },
  uT: { color: Colors.text.tertiary, fontSize: 12, fontWeight: '600' },
  ioRow: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.background.primary,
  },
  ioBtn: {
    flex: 1, backgroundColor: Colors.background.cardAlt, borderRadius: 6, paddingVertical: 10,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border.default,
  },
  ioT: { color: Colors.text.secondary, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  hintRow: { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: Colors.background.primary },
  hintT: {
    color: Colors.text.tertiary, fontSize: 11, textAlign: 'center', letterSpacing: 0.5,
  },
  canvas: { flex: 1, backgroundColor: '#05080F', overflow: 'hidden' },
  legend: {
    flexDirection: 'row', justifyContent: 'center', gap: 28, paddingVertical: 12,
    backgroundColor: '#060A10', borderTopWidth: 1, borderColor: Colors.border.default,
  },
  lr: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  lt: { color: Colors.text.secondary, fontSize: 11, letterSpacing: 1 },
});
