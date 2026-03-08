import React, {
  useState, useRef, useEffect, useMemo,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  PanResponder, Alert, Modal, TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import NamePrompt from '../components/tree/NamePrompt';
import SkillCard from '../components/tree/SkillCard';
import GlowText from '../components/common/GlowText';
import SkiaTreeCanvas from '../components/tree/SkiaTreeCanvas';
import { BRANCH_COLORS, Colors } from '../theme/colors';
import {
  STORAGE_KEY, SAVED_TREES_KEY, SELECTED_TREE_KEY, NODE_R, MIN_SC, MAX_SC, DEV_PERF_LOG,
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
  const [savedTrees, setSavedTrees] = useState([]);
  const [selectedTreeId, setSelectedTreeId] = useState(null);
  const [namePromptVisible, setNamePromptVisible] = useState(false);
  const [treeNameDraft, setTreeNameDraft] = useState('');
  const [libraryVisible, setLibraryVisible] = useState(false);

  const resetHistoryWithTree = (nextTree) => {
    hist.current = [nextTree];
    hi.current = 0;
    setTree(nextTree);
    setCU(false);
    setCR(false);
  };

  const persistWorkingTree = (nextTree) => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextTree)).catch(() => {});
  const persistSelectedTree = (id) => {
    if (id) {
      AsyncStorage.setItem(SELECTED_TREE_KEY, id).catch(() => {});
    } else {
      AsyncStorage.removeItem(SELECTED_TREE_KEY).catch(() => {});
    }
    setSelectedTreeId(id || null);
  };
  const persistSavedTrees = (nextSavedTrees) => {
    setSavedTrees(nextSavedTrees);
    AsyncStorage.setItem(SAVED_TREES_KEY, JSON.stringify(nextSavedTrees)).catch(() => {});
  };

  useEffect(() => {
    const boot = async () => {
      const defaultTree = normalizeTree(INIT);
      let resolvedTree = defaultTree;
      let resolvedSelectedId = null;
      let library = [];

      try {
        const rawLibrary = await AsyncStorage.getItem(SAVED_TREES_KEY);
        if (rawLibrary) {
          const parsed = JSON.parse(rawLibrary);
          if (Array.isArray(parsed)) {
            library = parsed.filter((item) => item && item.id && item.name && item.tree?.nodes && item.tree?.edges);
          }
        }
      } catch (e) {}

      try {
        const savedSelectedId = await AsyncStorage.getItem(SELECTED_TREE_KEY);
        const selectedTree = savedSelectedId ? library.find((entry) => entry.id === savedSelectedId) : null;
        if (selectedTree) {
          resolvedTree = normalizeTree(selectedTree.tree);
          resolvedSelectedId = selectedTree.id;
        } else {
          const rawWorking = await AsyncStorage.getItem(STORAGE_KEY);
          if (rawWorking) {
            const parsedWorking = JSON.parse(rawWorking);
            if (parsedWorking?.nodes && parsedWorking?.edges) resolvedTree = normalizeTree(parsedWorking);
          }
        }
      } catch (e) {}

      setSavedTrees(library);
      setSelectedTreeId(resolvedSelectedId);
      resetHistoryWithTree(resolvedTree);
      persistWorkingTree(resolvedTree);
      if (resolvedSelectedId) AsyncStorage.setItem(SELECTED_TREE_KEY, resolvedSelectedId).catch(() => {});
      else AsyncStorage.removeItem(SELECTED_TREE_KEY).catch(() => {});
    };

    boot();
  }, []);

  useEffect(() => { onTreeChange?.(tree); }, [onTreeChange, tree]);

  const commit = (t) => {
    const h = hist.current.slice(0, hi.current + 1); h.push(t);
    hist.current = h; hi.current = h.length - 1; setTree(t); setCU(true); setCR(false);
    persistWorkingTree(t);
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
  const panStartTx = useSharedValue(0); const panStartTy = useSharedValue(0); const panStartSc = useSharedValue(1);
  const pinchStartTx = useSharedValue(0); const pinchStartTy = useSharedValue(0); const pinchStartSc = useSharedValue(1);
  const pinchStartSvgFx = useSharedValue(0); const pinchStartSvgFy = useSharedValue(0);
  const canvasLeftV = useSharedValue(0); const canvasTopV = useSharedValue(0);
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
  const measureC = () => cRef.current?.measure((_, __, _w, _h, px, py) => {
    cL.current = px;
    cT.current = py;
    canvasLeftV.value = px;
    canvasTopV.value = py;
  });

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

  const handleViewTap = (pageX, pageY) => {
    const hit = hitNode(pageX, pageY);
    if (hit) setSel({ ...hit });
  };

  const commitSharedXform = (tx, ty, sc) => {
    txN.current = tx;
    tyN.current = ty;
    scN.current = sc;
    setXform((prev) => (
      prev.tx === tx && prev.ty === ty && prev.sc === sc
        ? prev
        : { tx, ty, sc }
    ));
  };

  const navGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .onBegin(() => {
        panStartTx.value = txV.value;
        panStartTy.value = tyV.value;
        panStartSc.value = scV.value;
        runOnJS(beginInteraction)();
      })
      .onUpdate((evt) => {
        txV.value = panStartTx.value + evt.translationX;
        tyV.value = panStartTy.value + evt.translationY;
        scV.value = panStartSc.value;
      })
      .onFinalize(() => {
        runOnJS(commitSharedXform)(txV.value, tyV.value, scV.value);
        runOnJS(endInteraction)();
      });

    const pinch = Gesture.Pinch()
      .onBegin((evt) => {
        pinchStartSc.value = scV.value;
        pinchStartTx.value = txV.value;
        pinchStartTy.value = tyV.value;
        const fx = evt.focalX - canvasLeftV.value;
        const fy = evt.focalY - canvasTopV.value;
        pinchStartSvgFx.value = (fx - pinchStartTx.value) / pinchStartSc.value;
        pinchStartSvgFy.value = (fy - pinchStartTy.value) / pinchStartSc.value;
        runOnJS(beginInteraction)();
      })
      .onUpdate((evt) => {
        const nextSc = Math.min(Math.max(pinchStartSc.value * evt.scale, MIN_SC), MAX_SC);
        const fx = evt.focalX - canvasLeftV.value;
        const fy = evt.focalY - canvasTopV.value;
        scV.value = nextSc;
        txV.value = fx - pinchStartSvgFx.value * nextSc;
        tyV.value = fy - pinchStartSvgFy.value * nextSc;
      })
      .onFinalize(() => {
        runOnJS(commitSharedXform)(txV.value, tyV.value, scV.value);
        runOnJS(endInteraction)();
      });

    const tap = Gesture.Tap()
      .maxDistance(7)
      .onEnd((evt, success) => {
        if (success) runOnJS(handleViewTap)(evt.absoluteX, evt.absoluteY);
      });

    pan.maxPointers(1).minDistance(1).averageTouches(true);
    tap.requireExternalGestureToFail(pan, pinch);

    return Gesture.Exclusive(tap, Gesture.Simultaneous(pan, pinch));
  }, []);

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

  const addNode = ({ name, branch = 'core' }) => {
    const id = `${name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}_${Date.now()}`;
    commit({
      ...tR.current,
      nodes: [...tR.current.nodes, {
        id, name, x: pendingPos.current.x, y: pendingPos.current.y, unlocked: false, isStart: false, branch,
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
            persistWorkingTree(t);
          },
        },
      ]);
    } catch (e) { Alert.alert('Import failed', String(e)); }
  };

  const saveCurrentTreeAs = () => {
    setTreeNameDraft('');
    setNamePromptVisible(true);
  };

  const confirmSaveCurrentTreeAs = () => {
    const name = treeNameDraft.trim();
    if (!name) return;
    const nextEntry = {
      id: `tree_${Date.now()}`,
      name,
      tree: normalizeTree(tR.current),
      updatedAt: Date.now(),
    };
    const nextLibrary = [nextEntry, ...savedTrees];
    persistSavedTrees(nextLibrary);
    persistSelectedTree(nextEntry.id);
    persistWorkingTree(nextEntry.tree);
    setNamePromptVisible(false);
    setTreeNameDraft('');
  };

  const overwriteSelectedTree = () => {
    if (!selectedTreeId) {
      Alert.alert('No selected tree', 'Choose a saved tree first or save as a new tree.');
      return;
    }
    const nextLibrary = savedTrees.map((entry) => (
      entry.id === selectedTreeId
        ? { ...entry, tree: normalizeTree(tR.current), updatedAt: Date.now() }
        : entry
    ));
    persistSavedTrees(nextLibrary);
    persistWorkingTree(tR.current);
  };

  const switchToTree = (treeId) => {
    const target = savedTrees.find((entry) => entry.id === treeId);
    if (!target) return;
    const next = normalizeTree(target.tree);
    resetHistoryWithTree(next);
    persistWorkingTree(next);
    persistSelectedTree(treeId);
    setLibraryVisible(false);
  };

  const loadDefaultTree = () => {
    const next = normalizeTree(INIT);
    resetHistoryWithTree(next);
    persistWorkingTree(next);
    persistSelectedTree(null);
    setLibraryVisible(false);
  };

  const deleteSelectedTree = () => {
    if (!selectedTreeId) return;
    const entry = savedTrees.find((t) => t.id === selectedTreeId);
    Alert.alert('Delete tree', `Delete "${entry?.name || 'this tree'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          const nextLibrary = savedTrees.filter((t) => t.id !== selectedTreeId);
          persistSavedTrees(nextLibrary);
          persistSelectedTree(null);
        },
      },
    ]);
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
    const interactionPad = isInteracting ? Math.max(520 / xform.sc, 320) : 0;
    return {
      left: (-xform.tx) / xform.sc - interactionPad,
      top: (-xform.ty) / xform.sc - interactionPad,
      right: (canvasSize.width - xform.tx) / xform.sc + interactionPad,
      bottom: (canvasSize.height - xform.ty) / xform.sc + interactionPad,
    };
  }, [canvasSize.height, canvasSize.width, isInteracting, xform.sc, xform.tx, xform.ty]);

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

  const lodTierRef = useRef('near');
  const lodTier = useMemo(() => {
    const prev = lodTierRef.current;
    const sc = xform.sc;
    let next = prev;

    if (prev === 'near') {
      if (sc < 0.56) next = 'mid';
    } else if (prev === 'mid') {
      if (sc < 0.23) next = 'far';
      else if (sc > 0.68) next = 'near';
    } else if (prev === 'far' && sc > 0.31) {
      next = 'mid';
    }

    lodTierRef.current = next;
    return next;
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
      showOuterRing: !isFar && interactionTier !== 'heavy',
      useDashedReady: isNear && interactionTier === 'idle',
      showEdgeGlow: isNear && interactionTier === 'idle',
      showNodeGlowBlur: isNear && interactionTier === 'idle',
      simplifyNodeStack: isFar || interactionTier === 'heavy',
      showNodeHighlight: !isFar && interactionTier !== 'heavy',
      showDust: interactionTier === 'idle' && !isFar,
    };
  }, [interactionTier, lodTier]);

  const nodeStyles = useMemo(() => {
    const nb = BRANCH_COLORS.neutral;
    const map = {};
    const makeVisual = (branch, bc, status) => {
      const isLocked = status === 'locked';
      if (isLocked) {
        return {
          fill: 'rgba(44,39,35,0.54)',
          innerFill: 'rgba(30,27,24,0.78)',
          core: 'rgba(86,80,73,0.38)',
          outerRim: 'rgba(110,99,88,0.26)',
          stroke: 'rgba(138,124,108,0.42)',
          ring: 'rgba(128,115,100,0.28)',
          glowInner: toRGBA(bc.main, 0.12),
          glowOuter: toRGBA(bc.main, 0.08),
          ambient: 'rgba(18,16,14,0.12)',
          farAura: toRGBA(bc.main, 0.08),
          farBody: 'rgba(88,78,68,0.34)',
          farCore: 'rgba(132,118,102,0.34)',
          innerRing: 'rgba(121,108,93,0.28)',
          innerRingSoft: 'rgba(86,76,67,0.26)',
          specular: 'rgba(228,216,202,0.08)',
          sw: 1.4,
          opacity: 0.82,
        };
      }

      const baseFill = status === 'mastered' ? toRGBA(bc.main, 0.16) : toRGBA(bc.main, 0.12);
      const innerFill = status === 'mastered' ? toRGBA(bc.main, 0.23) : toRGBA(bc.main, 0.17);
      const core = status === 'mastered' ? toRGBA(bc.ring, 0.2) : toRGBA(bc.ring, 0.15);
      const strokeAlpha = status === 'mastered' ? 0.93 : 0.84;
      const ringAlpha = status === 'mastered' ? 0.88 : 0.76;
      const glowOuterBase = status === 'mastered' ? 0.2 : 0.16;
      const glowInnerBase = status === 'mastered' ? 0.34 : 0.28;
      const branchBoost = branch === 'push' ? 1.08 : branch === 'pull' ? 1.1 : 1;
      const glowOuterAlpha = glowOuterBase * branchBoost;
      const glowInnerAlpha = glowInnerBase * branchBoost;

      return {
        fill: baseFill,
        innerFill,
        core,
        outerRim: toRGBA(bc.ring, 0.24),
        stroke: toRGBA(bc.main, strokeAlpha),
        ring: toRGBA(bc.ring, ringAlpha),
        glowInner: toRGBA(bc.ring, glowInnerAlpha),
        glowOuter: toRGBA(bc.main, glowOuterAlpha),
        ambient: toRGBA(bc.main, status === 'mastered' ? 0.068 : 0.052),
        farAura: toRGBA(bc.main, status === 'mastered' ? 0.18 : 0.15),
        farBody: toRGBA(bc.main, status === 'mastered' ? 0.46 : 0.38),
        farCore: toRGBA(bc.ring, status === 'mastered' ? 0.66 : 0.54),
        innerRing: toRGBA(bc.main, 0.30),
        innerRingSoft: toRGBA(bc.ring, 0.34),
        specular: 'rgba(240,246,255,0.14)',
        sw: status === 'mastered' ? 2.4 : 2.1,
        opacity: 0.98,
      };
    };


    for (const n of visibleNodes) {
      const branch = resolveBranch(n);
      const bc = BRANCH_COLORS[branch] || nb;
      const status = nodeStatusMap[n.id] || 'locked';

      if (bld && connA === n.id) {
        map[n.id] = {
          ...makeVisual('neutral', nb, 'ready'),
          fill: '#0F1E33',
          innerFill: '#173250',
          core: 'rgba(96,165,250,0.2)',
          outerRim: 'rgba(191,219,254,0.34)',
          stroke: toRGBA(nb.main, 0.95),
          ring: toRGBA(nb.ring, 0.92),
          glowInner: toRGBA(nb.main, 0.46),
          glowOuter: toRGBA(nb.main, 0.24),
          sw: 2.7,
        };
      } else if (status === 'start') {
        const startBc = BRANCH_COLORS.neutral;
        map[n.id] = {
          ...makeVisual('neutral', startBc, 'ready'),
          fill: 'rgba(14,27,44,0.9)',
          innerFill: 'rgba(22,46,74,0.92)',
          core: 'rgba(147,197,253,0.2)',
          stroke: 'rgba(96,165,250,0.92)',
          ring: 'rgba(191,219,254,0.82)',
          glowInner: 'rgba(96,165,250,0.34)',
          glowOuter: 'rgba(59,130,246,0.2)',
          innerRing: 'rgba(96,165,250,0.3)',
          innerRingSoft: 'rgba(191,219,254,0.28)',
          sw: 2.45,
        };
      } else {
        map[n.id] = makeVisual(branch, bc, status);
      }
    }
    return map;
  }, [visibleNodes, nodeStatusMap, bld, connA]);

  const edgeVisual = useMemo(() => {
    if (LOD.isFar) return {
      masteredW: 1.3, readyW: 1.0, lockedW: 0.6, masteredO: 0.74, readyO: 0.42, lockedO: 0.11,
    };
    if (LOD.isMid) return {
      masteredW: 2.1, readyW: 1.42, lockedW: 0.88, masteredO: 0.84, readyO: 0.52, lockedO: 0.15,
    };
    return {
      masteredW: 3.1, readyW: 2.0, lockedW: 0.98, masteredO: 0.92, readyO: 0.62, lockedO: 0.19,
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
          <GlowText style={styles.title} color={Colors.blue[300]} glowColor="rgba(96,165,250,0.72)" outerGlowColor="rgba(59,130,246,0.38)" numberOfLines={1}>KINETIC</GlowText>
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
        <View style={styles.treeMgrWrap}>
          <View style={styles.treeMgrHeaderRow}>
            <Text style={styles.treeMgrTitle}>TREE SLOT</Text>
            <Text style={styles.treeMgrCurrent}>{selectedTreeId ? (savedTrees.find((t) => t.id === selectedTreeId)?.name || 'Saved') : 'Default'}</Text>
          </View>
          <View style={styles.treeMgrActions}>
            <TouchableOpacity style={styles.miniBtn} onPress={saveCurrentTreeAs}><Text style={styles.miniBtnT}>Save As</Text></TouchableOpacity>
            <TouchableOpacity style={styles.miniBtn} onPress={overwriteSelectedTree}><Text style={styles.miniBtnT}>Overwrite</Text></TouchableOpacity>
            <TouchableOpacity style={styles.miniBtn} onPress={() => setLibraryVisible(true)}><Text style={styles.miniBtnT}>Switch</Text></TouchableOpacity>
            <TouchableOpacity style={styles.miniBtn} onPress={loadDefaultTree}><Text style={styles.miniBtnT}>Default</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.miniBtn, !selectedTreeId && styles.dim]} onPress={deleteSelectedTree} disabled={!selectedTreeId}><Text style={styles.miniBtnT}>Delete</Text></TouchableOpacity>
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

      {bld ? (
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
      ) : (
        <GestureDetector gesture={navGesture}>
          <View
            ref={cRef}
            style={styles.canvas}
            onLayout={(evt) => {
              const { width, height } = evt.nativeEvent.layout;
              setCanvasSize({ width, height });
              setTimeout(measureC, 50);
            }}
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
        </GestureDetector>
      )}

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

      <Modal transparent visible={namePromptVisible} animationType="fade" onRequestClose={() => setNamePromptVisible(false)}>
        <View style={styles.slotModalBack}>
          <View style={styles.slotModalCard}>
            <Text style={styles.slotModalTitle}>Save Tree</Text>
            <TextInput
              value={treeNameDraft}
              onChangeText={setTreeNameDraft}
              placeholder="Tree name"
              placeholderTextColor={Colors.text.tertiary}
              style={styles.slotInput}
              autoFocus
            />
            <View style={styles.slotRow}>
              <TouchableOpacity style={styles.slotBtn} onPress={() => setNamePromptVisible(false)}><Text style={styles.slotBtnT}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.slotBtn, !treeNameDraft.trim() && styles.dim]} onPress={confirmSaveCurrentTreeAs} disabled={!treeNameDraft.trim()}><Text style={styles.slotBtnT}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={libraryVisible} animationType="fade" onRequestClose={() => setLibraryVisible(false)}>
        <View style={styles.slotModalBack}>
          <View style={styles.slotModalCard}>
            <Text style={styles.slotModalTitle}>Switch Tree</Text>
            <TouchableOpacity style={styles.slotListItem} onPress={loadDefaultTree}>
              <Text style={styles.slotListTitle}>Default</Text>
              <Text style={styles.slotListMeta}>INIT</Text>
            </TouchableOpacity>
            {savedTrees.map((entry) => (
              <TouchableOpacity key={entry.id} style={styles.slotListItem} onPress={() => switchToTree(entry.id)}>
                <Text style={styles.slotListTitle}>{entry.name}</Text>
                <Text style={styles.slotListMeta}>{new Date(entry.updatedAt || Date.now()).toLocaleDateString()}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.slotBtn} onPress={() => setLibraryVisible(false)}><Text style={styles.slotBtnT}>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  treeMgrWrap: {
    backgroundColor: Colors.background.secondary,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border.default,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  treeMgrHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  treeMgrTitle: { color: Colors.text.tertiary, fontSize: 10, letterSpacing: 1.4, fontWeight: '700' },
  treeMgrCurrent: { color: Colors.text.secondary, fontSize: 11, fontWeight: '700' },
  treeMgrActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  miniBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border.default,
    backgroundColor: Colors.background.cardAlt,
  },
  miniBtnT: { color: Colors.text.secondary, fontSize: 11, fontWeight: '700' },
  slotModalBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 24 },
  slotModalCard: { backgroundColor: Colors.background.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border.default, padding: 16, gap: 10 },
  slotModalTitle: { color: Colors.text.secondary, fontSize: 13, fontWeight: '800', letterSpacing: 1.2 },
  slotInput: { borderWidth: 1, borderColor: Colors.border.default, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, color: Colors.text.primary, backgroundColor: Colors.background.cardAlt },
  slotRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  slotBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.border.default, backgroundColor: Colors.background.cardAlt, alignSelf: 'flex-end' },
  slotBtnT: { color: Colors.text.secondary, fontWeight: '700' },
  slotListItem: { borderWidth: 1, borderColor: Colors.border.default, borderRadius: 8, padding: 10, backgroundColor: Colors.background.cardAlt, gap: 2 },
  slotListTitle: { color: Colors.text.secondary, fontWeight: '700' },
  slotListMeta: { color: Colors.text.tertiary, fontSize: 11 },
  canvas: { flex: 1, backgroundColor: '#0A0A0A', overflow: 'hidden' },
  legend: {
    flexDirection: 'row', justifyContent: 'center', gap: 28, paddingVertical: 12,
    backgroundColor: '#060A10', borderTopWidth: 1, borderColor: Colors.border.default,
  },
  lr: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  lt: { color: Colors.text.secondary, fontSize: 11, letterSpacing: 1 },
});
