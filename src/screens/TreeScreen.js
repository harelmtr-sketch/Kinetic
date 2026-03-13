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
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import NamePrompt from '../components/tree/NamePrompt';
import SkillCard from '../components/tree/SkillCard';
import SkiaTreeCanvas from '../components/tree/SkiaTreeCanvas';
import { BRANCH_COLORS, Colors } from '../theme/colors';
import {
  STORAGE_KEY, SAVED_TREES_KEY, SELECTED_TREE_KEY, NODE_R, MIN_SC, MAX_SC, DEV_PERF_LOG,
} from '../constants/tree';
import { INIT } from '../data/initialTree';
import {
  normalizeTree, segDist, resolveBranch, segmentIntersectsRect, toRGBA, getTreeStats,
} from '../utils/treeUtils';
import {
  applyUnlockedNodesToTree,
  buildUnlockedNodeRows,
  getProgressFromUnlockedCount,
  getUnlockedNodeIdsFromTree,
  replaceUnlockedNodes,
  saveXp,
  unlockNode,
} from '../services/progressService';

export default function TreeScreen({
  onTreeChange,
  treeActionsRef,
  onNavigate,
  userId,
  userData,
  onCloudDataChange,
}) {
  const initialTree = normalizeTree(INIT);
  const insets = useSafeAreaInsets();
  const [tree, _setTree] = useState(initialTree);
  const tR = useRef(initialTree);
  const setTree = (t) => { tR.current = t; _setTree(t); };
  const hist = useRef([initialTree]); const hi = useRef(0);
  const [canUndo, setCU] = useState(false); const [canRedo, setCR] = useState(false);
  const [savedTrees, setSavedTrees] = useState([]);
  const [selectedTreeId, setSelectedTreeId] = useState(null);
  const [namePromptVisible, setNamePromptVisible] = useState(false);
  const [treeNameDraft, setTreeNameDraft] = useState('');
  const [libraryVisible, setLibraryVisible] = useState(false);
  const cloudUnlockedNodes = userData?.unlockedNodes || [];

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
  const applyCloudProgressToTree = (baseTree) => applyUnlockedNodesToTree(baseTree, cloudUnlockedNodes);
  const syncCloudData = (nodeIds) => {
    onCloudDataChange?.((current) => ({
      ...(current || {
        profile: null,
        progress: { xp: 0, level: 1 },
        unlockedNodes: [],
      }),
      progress: getProgressFromUnlockedCount(nodeIds.length),
      unlockedNodes: buildUnlockedNodeRows(nodeIds),
    }));
  };
  const commitCloudProgress = async (nextTree, remoteSave) => {
    const previousTree = tR.current;
    const previousUnlockedIds = getUnlockedNodeIdsFromTree(previousTree);
    const nextUnlockedIds = getUnlockedNodeIdsFromTree(nextTree);

    commit(nextTree);
    setSel((prev) => (
      prev ? { ...prev, unlocked: nextUnlockedIds.includes(prev.id) } : null
    ));

    if (!userId) {
      return;
    }

    syncCloudData(nextUnlockedIds);

    try {
      await remoteSave(getProgressFromUnlockedCount(nextUnlockedIds.length), nextUnlockedIds);
    } catch (error) {
      resetHistoryWithTree(previousTree);
      syncCloudData(previousUnlockedIds);
      setSel((prev) => (
        prev ? { ...prev, unlocked: previousUnlockedIds.includes(prev.id) } : null
      ));
      Alert.alert('Sync failed', error?.message || 'Unable to save progress right now.');
    }
  };

  useEffect(() => {
    const boot = async () => {
      const defaultTree = applyCloudProgressToTree(normalizeTree(INIT));
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
          resolvedTree = applyCloudProgressToTree(normalizeTree(selectedTree.tree));
          resolvedSelectedId = selectedTree.id;
        } else {
          const rawWorking = await AsyncStorage.getItem(STORAGE_KEY);
          if (rawWorking) {
            const parsedWorking = JSON.parse(rawWorking);
            if (parsedWorking?.nodes && parsedWorking?.edges) {
              resolvedTree = applyCloudProgressToTree(normalizeTree(parsedWorking));
            }
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

  useEffect(() => {
    const nextTree = applyCloudProgressToTree(tR.current);
    const hasProgressChanges = nextTree.nodes.some(
      (node, index) => node.unlocked !== tR.current.nodes[index]?.unlocked,
    );

    if (hasProgressChanges) {
      resetHistoryWithTree(nextTree);
      persistWorkingTree(nextTree);
    }
  }, [cloudUnlockedNodes]);

  useEffect(() => { onTreeChange?.(tree); }, [onTreeChange, tree]);

  const commit = (t) => {
    const h = hist.current.slice(0, hi.current + 1); h.push(t);
    hist.current = h; hi.current = h.length - 1; setTree(t); setCU(true); setCR(false);
    persistWorkingTree(t);
  };
  const undo = () => { if (!hi.current) return; hi.current -= 1; const t = hist.current[hi.current]; setTree(t); setCU(hi.current > 0); setCR(true); };
  const redo = () => { if (hi.current >= hist.current.length - 1) return; hi.current += 1; const t = hist.current[hi.current]; setTree(t); setCU(true); setCR(hi.current < hist.current.length - 1); };

  // Expose reset to parent (Settings screen)
  useEffect(() => {
    if (!treeActionsRef) return;

    treeActionsRef.current = {
      reset: () => {
        const t = { ...tR.current, nodes: tR.current.nodes.map((n) => (n.isStart ? n : { ...n, unlocked: false })) };
        void commitCloudProgress(t, (nextProgress) => Promise.all([
          replaceUnlockedNodes(userId, []),
          saveXp(userId, nextProgress.xp, nextProgress.level),
        ]));
      },
      unlockAll: () => {
        const t = { ...tR.current, nodes: tR.current.nodes.map((n) => ({ ...n, unlocked: true })) };
        void commitCloudProgress(t, (nextProgress, nextUnlockedIds) => Promise.all([
          replaceUnlockedNodes(userId, nextUnlockedIds),
          saveXp(userId, nextProgress.xp, nextProgress.level),
        ]));
      },
      enterEditMode: () => { setBld(true); setConnA(null); },
    };
  });

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

  // Map bounds as shared values so worklets can clamp on UI thread (no snap-back)
  const boundsMinX = useSharedValue(-2000);
  const boundsMaxX = useSharedValue(2000);
  const boundsMinY = useSharedValue(-2000);
  const boundsMaxY = useSharedValue(2000);
  const canvasWV = useSharedValue(400);
  const canvasHV = useSharedValue(800);

  // Keep bounds in sync with tree
  useEffect(() => {
    const nodes = tR.current.nodes;
    if (nodes.length === 0) {
      boundsMinX.value = -3000; boundsMaxX.value = 3000;
      boundsMinY.value = -3000; boundsMaxY.value = 3000;
      return;
    }
    let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
    for (const n of nodes) {
      if (n.x < mnX) mnX = n.x; if (n.x > mxX) mxX = n.x;
      if (n.y < mnY) mnY = n.y; if (n.y > mxY) mxY = n.y;
    }
    const pad = 2000;
    const cx = (mnX + mxX) / 2, cy = (mnY + mxY) / 2;
    const hw = Math.max(6000, mxX - mnX + pad * 2) / 2;
    const hh = Math.max(6000, mxY - mnY + pad * 2) / 2;
    boundsMinX.value = cx - hw; boundsMaxX.value = cx + hw;
    boundsMinY.value = mnY - 2000;
    // Tight bottom: start node is the bottommost, only 260 padding below it
    const startN = nodes.find((n) => n.isStart);
    boundsMaxY.value = startN ? startN.y + 260 : cy + hh;
  }, [tree]);

  const clampTx = (tx, sc) => {
    'worklet';
    const cw = canvasWV.value;
    const minTx = cw - boundsMaxX.value * sc;
    const maxTx = -boundsMinX.value * sc;
    // If map fits inside viewport, center it
    if (minTx > maxTx) return (minTx + maxTx) / 2;
    return Math.min(Math.max(tx, minTx), maxTx);
  };
  const clampTy = (ty, sc) => {
    'worklet';
    const ch = canvasHV.value;
    const minTy = ch - boundsMaxY.value * sc;
    const maxTy = -boundsMinY.value * sc;
    // When content fits: anchor to bottom so start node stays low
    if (minTy > maxTy) return minTy;
    return Math.min(Math.max(ty, minTy), maxTy);
  };

  const setLiveXform = (tx, ty, sc) => {
    const cw = canvasSize.width || 400;
    const ch = canvasSize.height || 800;
    const minTx = cw - boundsMaxX.value * sc;
    const maxTx = -boundsMinX.value * sc;
    const minTy = ch - boundsMaxY.value * sc;
    const maxTy = -boundsMinY.value * sc;
    const cTx = minTx > maxTx ? (minTx + maxTx) / 2 : Math.min(Math.max(tx, minTx), maxTx);
    const cTy = minTy > maxTy ? minTy : Math.min(Math.max(ty, minTy), maxTy);
    txN.current = cTx; tyN.current = cTy; scN.current = sc;
    txV.value = cTx; tyV.value = cTy; scV.value = sc;
  };
  const commitLiveXform = () => {
    const next = { tx: txN.current, ty: tyN.current, sc: scN.current };
    setXform((prev) => (prev.tx === next.tx && prev.ty === next.ty && prev.sc === next.sc ? prev : next));
  };

  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    canvasWV.value = canvasSize.width || 400;
    canvasHV.value = canvasSize.height || 800;
  }, [canvasSize.width, canvasSize.height]);

  const handleGoHome = () => {
    const startNode = tR.current.nodes.find((n) => n.isStart);
    if (!startNode) return;
    const sc = 0.7;
    const cx = canvasSize.width / 2;
    const ch = canvasSize.height;
    const tx = cx - startNode.x * sc;
    const ty = ch / 2 - startNode.y * sc;
    setLiveXform(tx, ty, sc);
    commitLiveXform();
  };

  // TEMP: Zoom buttons for testing on emulator (remove before release)
  const handleZoom = (direction) => {
    const zoomFactor = direction === 'in' ? 1.3 : 0.7;
    const curSc = scN.current;
    const nextSc = Math.min(Math.max(curSc * zoomFactor, MIN_SC), MAX_SC);
    const cx = canvasSize.width / 2;
    const cy = canvasSize.height / 2;
    const svgX = (cx - txN.current) / curSc;
    const svgY = (cy - tyN.current) / curSc;
    const nextTx = cx - svgX * nextSc;
    const nextTy = cy - svgY * nextSc;
    setLiveXform(nextTx, nextTy, nextSc);
    commitLiveXform();
  };

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

  const commitSharedXform = (rawTx, rawTy, sc) => {
    const cw = canvasSize.width || 400;
    const ch = canvasSize.height || 800;
    const minTx = cw - boundsMaxX.value * sc;
    const maxTx = -boundsMinX.value * sc;
    const minTy = ch - boundsMaxY.value * sc;
    const maxTy = -boundsMinY.value * sc;
    const cTx = minTx > maxTx ? (minTx + maxTx) / 2 : Math.min(Math.max(rawTx, minTx), maxTx);
    const cTy = minTy > maxTy ? minTy : Math.min(Math.max(rawTy, minTy), maxTy);
    txN.current = cTx; tyN.current = cTy; scN.current = sc;
    txV.value = cTx; tyV.value = cTy; scV.value = sc;
    setXform((prev) => (
      prev.tx === cTx && prev.ty === cTy && prev.sc === sc
        ? prev
        : { tx: cTx, ty: cTy, sc }
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
        const sc = panStartSc.value;
        txV.value = clampTx(panStartTx.value + evt.translationX, sc);
        tyV.value = clampTy(panStartTy.value + evt.translationY, sc);
        scV.value = sc;
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
        txV.value = clampTx(fx - pinchStartSvgFx.value * nextSc, nextSc);
        tyV.value = clampTy(fy - pinchStartSvgFy.value * nextSc, nextSc);
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
  const record = async (id) => {
    const t = { ...tR.current, nodes: tR.current.nodes.map((n) => (n.id === id ? { ...n, unlocked: true } : n)) };
    await commitCloudProgress(t, (nextProgress) => Promise.all([
      unlockNode(userId, id),
      saveXp(userId, nextProgress.xp, nextProgress.level),
    ]));
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
      const t = applyCloudProgressToTree(normalizeTree(parsed));
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
    const next = applyCloudProgressToTree(normalizeTree(target.tree));
    resetHistoryWithTree(next);
    persistWorkingTree(next);
    persistSelectedTree(treeId);
    setLibraryVisible(false);
  };

  const loadDefaultTree = () => {
    const next = applyCloudProgressToTree(normalizeTree(INIT));
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
        const ready = prereqs.length > 0 && prereqs.some((pid) => nodeMap.get(pid)?.unlocked || nodeMap.get(pid)?.isStart);
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
      if (sc < 0.38) next = 'mid';
    } else if (prev === 'mid') {
      if (sc < 0.23) next = 'far';
      else if (sc > 0.46) next = 'near';
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

    return {
      isFar,
      isMid,
      isNear,
      interactionTier,
      showLabels: !isFar,
      showOuterRing: !isFar,
      showEdgeGlow: isNear && interactionTier === 'idle',
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
          fill: 'rgba(20,18,16,0.86)',
          innerFill: 'rgba(9,8,7,0.96)',
          core: 'rgba(1,1,1,0.94)',
          outerRim: 'rgba(118,104,89,0.22)',
          stroke: toRGBA(bc.main, 0.38),
          ring: 'rgba(124,111,97,0.24)',
          glowInner: toRGBA(bc.main, 0.06),
          glowOuter: toRGBA(bc.main, 0.03),
          ambient: toRGBA(bc.main, 0.015),
          farAura: toRGBA(bc.main, 0.12),
          farBody: toRGBA(bc.main, 0.24),
          farCore: toRGBA(bc.ring, 0.26),
          innerRing: 'rgba(112,100,86,0.24)',
          innerRingSoft: 'rgba(80,72,63,0.2)',
          specular: 'rgba(226,214,198,0.06)',
          sw: 1.6,
          opacity: 0.88,
        };
      }

      const resolved = bc;
      const isMastered = status === 'mastered';
      const isReady = status === 'ready';

      if (isReady) {
        return {
          fill: 'rgba(20,18,16,0.86)',
          innerFill: 'rgba(9,8,7,0.96)',
          core: 'rgba(1,1,1,0.94)',
          outerRim: 'rgba(118,104,89,0.22)',
          stroke: toRGBA(resolved.main, 0.38),
          ring: 'rgba(124,111,97,0.24)',
          glowInner: toRGBA(resolved.main, 0.06),
          glowOuter: toRGBA(resolved.main, 0.03),
          ambient: toRGBA(resolved.main, 0.015),
          farAura: toRGBA(resolved.main, 0.12),
          farBody: toRGBA(resolved.main, 0.24),
          farCore: toRGBA(resolved.ring, 0.26),
          innerRing: 'rgba(112,100,86,0.24)',
          innerRingSoft: 'rgba(80,72,63,0.2)',
          specular: 'rgba(226,214,198,0.06)',
          sw: 1.6,
          opacity: 0.88,
        };
      }

      return {
        fill: 'rgba(8,14,24,0.96)',
        innerFill: 'rgba(7,12,20,0.98)',
        core: 'rgba(1,2,4,0.96)',
        outerRim: toRGBA(resolved.ring, 0.14),
        stroke: toRGBA(resolved.main, 0.94),
        ring: toRGBA(resolved.ring, 0.7),
        glowInner: toRGBA(resolved.ring, 0.2),
        glowOuter: toRGBA(resolved.main, 0.12),
        ambient: toRGBA(resolved.main, 0.045),
        farAura: toRGBA(resolved.main, 0.28),
        farBody: toRGBA(resolved.main, 0.58),
        farCore: toRGBA(resolved.ring, 0.85),
        innerRing: toRGBA(resolved.main, 0.2),
        innerRingSoft: toRGBA(resolved.ring, 0.15),
        specular: 'rgba(240,246,255,0.12)',
        sw: 2.35,
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
          fill: '#08111C',
          innerFill: '#0D1B2C',
          core: 'rgba(1,2,4,0.96)',
          outerRim: 'rgba(191,219,254,0.34)',
          stroke: toRGBA(nb.main, 0.95),
          ring: toRGBA(nb.ring, 0.92),
          glowInner: toRGBA(nb.main, 0.46),
          glowOuter: toRGBA(nb.main, 0.24),
          ambient: toRGBA(nb.main, 0.08),
          sw: 2.7,
        };
      } else if (status === 'start') {
        map[n.id] = {
          fill: 'rgba(6,10,18,0.97)',
          innerFill: 'rgba(8,14,24,0.97)',
          core: 'rgba(200,220,255,0.06)',
          outerRim: 'rgba(200,220,240,0.18)',
          stroke: 'rgba(220,230,255,0.88)',
          ring: 'rgba(200,215,240,0.44)',
          glowInner: 'rgba(180,210,255,0.12)',
          glowOuter: 'rgba(160,200,255,0.06)',
          ambient: 'rgba(140,180,240,0.03)',
          farAura: 'rgba(200,215,240,0.22)',
          farBody: 'rgba(200,215,240,0.48)',
          farCore: 'rgba(220,230,255,0.7)',
          innerRing: 'rgba(200,215,240,0.14)',
          innerRingSoft: 'rgba(200,215,240,0.1)',
          specular: 'rgba(240,246,255,0.12)',
          sw: 2.8,
          opacity: 0.98,
        };
      } else {
        map[n.id] = makeVisual(branch, bc, status);
      }
    }
    return map;
  }, [visibleNodes, nodeStatusMap, bld, connA]);

  const edgeVisual = useMemo(() => {
    if (LOD.isFar) return {
      masteredW: 1.6, readyW: 1.1, lockedW: 0.7, masteredO: 0.88, readyO: 0.56, lockedO: 0.16,
    };
    if (LOD.isMid) return {
      masteredW: 1.8, readyW: 1.28, lockedW: 0.82, masteredO: 0.86, readyO: 0.56, lockedO: 0.17,
    };
    return {
      masteredW: 4.8, readyW: 3.2, lockedW: 1.6, masteredO: 0.94, readyO: 0.68, lockedO: 0.22,
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
    move: 'Drag nodes to reposition - Tap empty space to add',
    connect: connA ? 'Now tap second node to connect' : 'Tap first node to begin branch',
    delete: 'Tap a node or line to delete it',
  };

  const treeStats = useMemo(() => getTreeStats(tree), [tree]);
  const eloRating = useMemo(() => {
    const base = 800;
    const perSkill = 45;
    return base + (treeStats.unlocked * perSkill);
  }, [treeStats.unlocked]);

  return (
    <View style={styles.root}>
      {!bld && (
        <View style={[styles.bar, { paddingTop: insets.top + 10 }]}>
          <View style={styles.barContent}>
            <TouchableOpacity style={styles.barIconBtn} onPress={() => onNavigate?.('Profile')} activeOpacity={0.7}>
              <Ionicons name="person-outline" size={22} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
            <View style={styles.eloWrap}>
              <Text style={styles.eloIcon}>🏆</Text>
              <Text style={styles.eloText}>{eloRating}</Text>
            </View>
            <TouchableOpacity style={styles.barIconBtn} onPress={() => onNavigate?.('Settings')} activeOpacity={0.7}>
              <Ionicons name="settings-outline" size={22} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {bld && (
        <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
          <View style={styles.barContent}>
            <View style={styles.barSide} />
            <View pointerEvents="none" style={styles.titleSlot}>
              <Text style={styles.title}>EDIT MODE</Text>
            </View>
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => { setBld(false); setConnA(null); dId.current = null; }}
              activeOpacity={0.7}
            >
              <Text style={styles.doneBtnT}>DONE</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {bld && (
        <View style={[styles.toolbar, { paddingTop: insets.top + 56 }]}>
          <View style={styles.toolPills}>
            {[['move', 'Move'], ['connect', 'Link'], ['delete', 'Delete']].map(([id, lbl]) => (
              <TouchableOpacity key={id} style={[styles.toolPill, tool === id && styles.toolPillOn]} onPress={() => { setTool(id); setConnA(null); }}>
                <Text style={[styles.toolPillT, tool === id && styles.toolPillTOn]}>{lbl}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.toolDivider} />
            <TouchableOpacity style={[styles.toolPill, !canUndo && styles.dim]} onPress={undo} disabled={!canUndo}><Text style={styles.toolPillT}>↩</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.toolPill, !canRedo && styles.dim]} onPress={redo} disabled={!canRedo}><Text style={styles.toolPillT}>↪</Text></TouchableOpacity>
          </View>
          <Text style={styles.hintT}>{hints[tool]}</Text>
          <View style={styles.treeMgrRow}>
            <Text style={styles.treeMgrLabel}>{selectedTreeId ? (savedTrees.find((t) => t.id === selectedTreeId)?.name || 'Saved') : 'Default'}</Text>
            <View style={styles.treeMgrActions}>
              <TouchableOpacity style={styles.mgBtn} onPress={saveCurrentTreeAs}><Text style={styles.mgBtnT}>Save</Text></TouchableOpacity>
              <TouchableOpacity style={styles.mgBtn} onPress={overwriteSelectedTree}><Text style={styles.mgBtnT}>Overwrite</Text></TouchableOpacity>
              <TouchableOpacity style={styles.mgBtn} onPress={() => setLibraryVisible(true)}><Text style={styles.mgBtnT}>Switch</Text></TouchableOpacity>
              <TouchableOpacity style={styles.mgBtn} onPress={loadDefaultTree}><Text style={styles.mgBtnT}>Default</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.mgBtn, !selectedTreeId && styles.dim]} onPress={deleteSelectedTree} disabled={!selectedTreeId}><Text style={styles.mgBtnT}>Delete</Text></TouchableOpacity>
            </View>
          </View>
          <View style={styles.ioRow}>
            <TouchableOpacity style={styles.ioBtn} onPress={exportTree}><Text style={styles.ioBtnT}>Export</Text></TouchableOpacity>
            <TouchableOpacity style={styles.ioBtn} onPress={importTree}><Text style={styles.ioBtnT}>Import</Text></TouchableOpacity>
          </View>
        </View>
      )}

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
              visibleBounds={visibleBounds}
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
                visibleBounds={visibleBounds}
              />
            )}
          </View>
        </GestureDetector>
      )}

      <View style={styles.zoomBtns}>
        <TouchableOpacity style={styles.zoomBtn} onPress={() => handleZoom('in')} activeOpacity={0.7}>
          <Text style={styles.zoomBtnText}>+</Text>
        </TouchableOpacity>
        <View style={styles.zoomDivider} />
        <TouchableOpacity style={styles.zoomBtn} onPress={() => handleZoom('out')} activeOpacity={0.7}>
          <Text style={styles.zoomBtnText}>−</Text>
        </TouchableOpacity>
        <View style={styles.zoomDivider} />
        <TouchableOpacity style={styles.zoomBtn} onPress={handleGoHome} activeOpacity={0.7}>
          <Text style={styles.zoomBtnText}>⌖</Text>
        </TouchableOpacity>
      </View>

      {/* Legend removed - cleaner UI */}

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
  zoomBtns: {
    position: 'absolute',
    right: 16,
    bottom: 40,
    zIndex: 50,
    backgroundColor: 'rgba(15,15,20,0.75)',
    borderRadius: 24,
    overflow: 'hidden',
  },
  zoomBtn: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 20,
    fontWeight: '500',
  },
  zoomDivider: {
    height: 1,
    marginHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  barContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 50,
  },
  barSide: {
    width: 44,
  },
  barIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,30,40,0.75)',
  },
  titleSlot: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  title: {
    color: 'rgba(200,220,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 3,
  },
  eloWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,200,50,0.08)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 22,
  },
  eloIcon: {
    fontSize: 22,
  },
  eloText: {
    color: '#FFD700',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
  },
  doneBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(96,165,250,0.2)',
    zIndex: 1,
  },
  doneBtnT: {
    color: 'rgba(150,200,255,0.95)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  toolbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 35,
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 10,
    backgroundColor: 'rgba(8,8,12,0.82)',
  },
  toolPills: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    padding: 3,
    gap: 2,
  },
  toolPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  toolPillOn: {
    backgroundColor: 'rgba(96,165,250,0.22)',
  },
  toolPillT: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
  },
  toolPillTOn: { color: 'rgba(180,215,255,0.95)' },
  toolDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 4,
  },
  hintT: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    textAlign: 'center',
  },
  treeMgrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  treeMgrLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  treeMgrActions: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  mgBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  mgBtnT: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '600',
  },
  dim: { opacity: 0.25 },
  ioRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 8,
  },
  ioBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  ioBtnT: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  slotModalBack: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  slotModalCard: {
    backgroundColor: 'rgba(18,18,24,0.95)',
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  slotModalTitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  slotInput: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  slotRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  slotBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  slotBtnT: {
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    fontSize: 14,
  },
  slotListItem: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    gap: 2,
  },
  slotListTitle: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
    fontSize: 15,
  },
  slotListMeta: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  canvas: { flex: 1, backgroundColor: '#0A0A0A', overflow: 'hidden' },
  legend: {
    flexDirection: 'row', justifyContent: 'center', gap: 28, paddingVertical: 12,
    backgroundColor: '#060A10', borderTopWidth: 1, borderColor: Colors.border.default,
  },
  lr: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  lt: { color: Colors.text.secondary, fontSize: 11, letterSpacing: 1 },
});
