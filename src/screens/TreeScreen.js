import React, {
  startTransition, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing,
  PanResponder, Alert, Modal, TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue, withTiming } from 'react-native-reanimated';
import AuthBackdrop from '../components/AuthBackdrop';
import NamePrompt from '../components/tree/NamePrompt';
import NodeEditorModal from '../components/tree/NodeEditorModal';
import SkillCard from '../components/tree/SkillCard.js';
import SkiaTreeCanvas from '../components/tree/SkiaTreeCanvas';
import { BRANCH_COLORS, Colors } from '../theme/colors';
import {
  STORAGE_KEY, SAVED_TREES_KEY, SELECTED_TREE_KEY, NODE_R, MIN_SC, MAX_SC, DEV_PERF_LOG,
} from '../constants/tree';
import { INIT } from '../data/initialTree';
import {
  normalizeTree, segDist, resolveBranch, segmentIntersectsRect, toRGBA, getTreeStats,
} from '../utils/treeUtils';
import { buildBackdropRocks, getBackdropRockState } from '../utils/treeBackdropUtils';
import {
  buildTreeSpatialIndex,
  querySpatialEdges,
  querySpatialNodes,
} from '../utils/treeSpatialIndex';
import {
  applyUnlockedNodesToTree,
  buildUnlockedNodeRows,
  getProgressFromUnlockedCount,
  getUnlockedNodeIdsFromTree,
  replaceUnlockedNodes,
  saveXp,
  unlockNode,
} from '../services/progressService';

const HOME_VIEW_SCALE = 0.95;
const HOME_VIEW_Y_RATIO = 0.76;
const PAN_STATE_SYNC_DELAY_MS = 220;
const PAN_STATE_SYNC_MIN_SCREEN_DELTA = 160;
const PAN_STATE_SYNC_MIN_SCALE_DELTA = 0.12;
const INTERACTION_IDLE_DELAY_MS = 180;
const NODE_HIT_RADIUS = NODE_R + 60;
const DRAG_MOVE_THRESHOLD = 10;
const TAP_MOVE_TOLERANCE = 20;
const UNLOCK_FX_DURATION_MS = 2000;
const UNLOCK_FX_CLEANUP_BUFFER_MS = 260;
const UNLOCK_FOCUS_ZOOM_DURATION_MS = 300; // baseline; actual duration is dynamic
const UNLOCK_ZOOM_RETURN_DURATION_MS = 500;
const ELO_BASE_RATING = 800;
const ELO_PER_UNLOCK = 45;
const INITIAL_TREE = normalizeTree(INIT);

// Precompute node visual styles once at module load — avoids 750+ toRGBA() calls per render
const _buildBranchStyles = (bc) => ({
  locked: {
    fill: 'rgba(26,30,50,1.0)',
    innerFill: 'rgba(18,22,40,1.0)',
    core: 'rgba(10,12,24,1.0)',
    outerRim: 'rgba(118,104,89,0.22)',
    stroke: toRGBA(bc.main, 0.52),
    ring: toRGBA(bc.ring, 0.34),
    glowInner: toRGBA(bc.main, 0.18),
    glowOuter: toRGBA(bc.main, 0.1),
    ambient: toRGBA(bc.main, 0.06),
    farAura: toRGBA(bc.main, 0.22),
    farBody: toRGBA(bc.main, 0.34),
    farCore: toRGBA(bc.ring, 0.34),
    innerRing: 'rgba(142,126,108,0.3)',
    innerRingSoft: 'rgba(98,87,74,0.24)',
    specular: 'rgba(226,214,198,0.06)',
    sw: 1.6,
    opacity: 0.94,
  },
  ready: {
    fill: 'rgba(26,30,50,1.0)',
    innerFill: 'rgba(18,22,40,1.0)',
    core: 'rgba(10,12,24,1.0)',
    outerRim: 'rgba(118,104,89,0.22)',
    stroke: toRGBA(bc.main, 0.76),
    ring: toRGBA(bc.ring, 0.52),
    glowInner: toRGBA(bc.main, 0.28),
    glowOuter: toRGBA(bc.main, 0.16),
    ambient: toRGBA(bc.main, 0.10),
    farAura: toRGBA(bc.main, 0.32),
    farBody: toRGBA(bc.main, 0.46),
    farCore: toRGBA(bc.ring, 0.52),
    innerRing: 'rgba(142,126,108,0.3)',
    innerRingSoft: 'rgba(98,87,74,0.24)',
    specular: 'rgba(226,214,198,0.06)',
    sw: 2.2,
    opacity: 0.98,
  },
  mastered: {
    fill: 'rgba(10,18,36,1.0)',
    innerFill: 'rgba(8,14,30,1.0)',
    core: 'rgba(4,8,18,1.0)',
    outerRim: toRGBA(bc.ring, 0.14),
    stroke: toRGBA(bc.main, 0.94),
    ring: toRGBA(bc.ring, 0.7),
    glowInner: toRGBA(bc.ring, 0.28),
    glowOuter: toRGBA(bc.main, 0.18),
    ambient: toRGBA(bc.main, 0.08),
    farAura: toRGBA(bc.main, 0.28),
    farBody: toRGBA(bc.main, 0.58),
    farCore: toRGBA(bc.ring, 0.85),
    innerRing: toRGBA(bc.main, 0.2),
    innerRingSoft: toRGBA(bc.ring, 0.15),
    specular: 'rgba(240,246,255,0.12)',
    sw: 2.35,
    opacity: 0.98,
  },
});
const NODE_VISUAL_STYLES = {
  neutral: _buildBranchStyles(BRANCH_COLORS.neutral),
  push: _buildBranchStyles(BRANCH_COLORS.push),
  pull: _buildBranchStyles(BRANCH_COLORS.pull),
  core: _buildBranchStyles(BRANCH_COLORS.core),
};
const NODE_START_STYLE = {
  fill: 'rgba(10,16,30,1.0)',
  innerFill: 'rgba(8,14,26,1.0)',
  core: 'rgba(200,220,255,0.06)',
  outerRim: 'rgba(200,220,240,0.18)',
  stroke: 'rgba(220,230,255,0.88)',
  ring: 'rgba(200,215,240,0.44)',
  glowInner: 'rgba(180,210,255,0.24)',
  glowOuter: 'rgba(160,200,255,0.14)',
  ambient: 'rgba(140,180,240,0.08)',
  farAura: 'rgba(200,215,240,0.22)',
  farBody: 'rgba(200,215,240,0.48)',
  farCore: 'rgba(220,230,255,0.7)',
  innerRing: 'rgba(200,215,240,0.14)',
  innerRingSoft: 'rgba(200,215,240,0.1)',
  specular: 'rgba(240,246,255,0.12)',
  sw: 2.8,
  opacity: 0.98,
};
const _nb = BRANCH_COLORS.neutral;
const NODE_CONN_A_STYLE = {
  ...NODE_VISUAL_STYLES.neutral.ready,
  fill: '#08111C',
  innerFill: '#0D1B2C',
  core: 'rgba(1,2,4,0.96)',
  outerRim: 'rgba(191,219,254,0.34)',
  stroke: toRGBA(_nb.main, 0.95),
  ring: toRGBA(_nb.ring, 0.92),
  glowInner: toRGBA(_nb.main, 0.46),
  glowOuter: toRGBA(_nb.main, 0.24),
  ambient: toRGBA(_nb.main, 0.08),
  sw: 2.7,
};

export default function TreeScreen({
  onTreeChange,
  treeActionsRef,
  onNavigate,
  userId,
  userData,
  onCloudDataChange,
  skillVideos,
  onStartSkillAttempt,
  treePrefs,
  onSignOut,
}) {
  const initialTree = INITIAL_TREE;
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
  const [unlockFx, setUnlockFx] = useState(null);
  const unlockFxTimeoutRef = useRef(null);
  const [rockBurstFx, setRockBurstFx] = useState(null);
  const rockBurstTimeoutRef = useRef(null);
  const [pendingUnlockNodeId, setPendingUnlockNodeId] = useState(null);
  const pendingUnlockInFlightRef = useRef(false);
  const replayUnlockAnim = treePrefs?.replayUnlockAnim ?? false;
  const [displayEloRating, setDisplayEloRating] = useState(ELO_BASE_RATING);
  const [eloGainValue, setEloGainValue] = useState(0);
  const eloCounterV = useRef(new Animated.Value(ELO_BASE_RATING)).current;
  const eloPulseV = useRef(new Animated.Value(0)).current;
  const eloGainOpacityV = useRef(new Animated.Value(0)).current;
  const eloGainLiftV = useRef(new Animated.Value(0)).current;
  const eloInitializedRef = useRef(false);
  const lastEloRatingRef = useRef(ELO_BASE_RATING);
  const cloudUnlockedNodes = userData?.unlockedNodes || [];

  const resetHistoryWithTree = (nextTree) => {
    hist.current = [nextTree];
    hi.current = 0;
    setTree(nextTree);
    setCU(false);
    setCR(false);
    setPendingUnlockNodeId(null);
    pendingUnlockInFlightRef.current = false;
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
      return true;
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
      return false;
    }

    return true;
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

  useEffect(() => () => {
    if (unlockFxTimeoutRef.current) {
      clearTimeout(unlockFxTimeoutRef.current);
    }
    if (rockBurstTimeoutRef.current) {
      clearTimeout(rockBurstTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    const listenerId = eloCounterV.addListener(({ value }) => {
      setDisplayEloRating(Math.round(value));
    });

    return () => {
      eloCounterV.removeListener(listenerId);
      eloCounterV.stopAnimation();
      eloPulseV.stopAnimation();
      eloGainOpacityV.stopAnimation();
      eloGainLiftV.stopAnimation();
    };
  }, [eloCounterV, eloGainLiftV, eloGainOpacityV, eloPulseV]);

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
      completeSkill: async (id, opts) => {
        if (pendingUnlockInFlightRef.current) return false;
        // Always use completePendingUnlock so the zoom-in + burst animation
        // fires reliably whether the node was already synced from cloud or not.
        return completePendingUnlock(id);
      },
      enterEditMode: () => { setBld(true); setConnA(null); },
    };
  }, [treeActionsRef, userId, completePendingUnlock]);

  const [bld, _setBld] = useState(false); const bR = useRef(false); const setBld = (v) => { bR.current = v; _setBld(v); };
  const [tool, _setTool] = useState('move'); const tR2 = useRef('move'); const setTool = (v) => { tR2.current = v; _setTool(v); };
  const [connA, _setConnA] = useState(null); const cAR = useRef(null); const setConnA = (v) => { cAR.current = v; _setConnA(v); };
  const [sel, setSel] = useState(null);
  const [prompt, showPrompt] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [nodeEditorVisible, setNodeEditorVisible] = useState(false);
  const pendingPos = useRef({ x: 450, y: 400 });

  const txN = useRef(0); const tyN = useRef(0); const scN = useRef(1);
  const txV = useSharedValue(0); const tyV = useSharedValue(0); const scV = useSharedValue(1);
  const unlockFxProgressV = useSharedValue(0);
  const rockBurstProgressV = useSharedValue(1);
  const dragXV = useSharedValue(0); const dragYV = useSharedValue(0);
  const panStartTx = useSharedValue(0); const panStartTy = useSharedValue(0); const panStartSc = useSharedValue(1);
  const pinchStartTx = useSharedValue(0); const pinchStartTy = useSharedValue(0); const pinchStartSc = useSharedValue(1);
  const pinchStartSvgFx = useSharedValue(0); const pinchStartSvgFy = useSharedValue(0);
  const pinchActiveV = useSharedValue(0);
  const navPreviewTxV = useSharedValue(0); const navPreviewTyV = useSharedValue(0); const navPreviewScV = useSharedValue(1);
  const tapStartTxV = useSharedValue(0); const tapStartTyV = useSharedValue(0); const tapStartScV = useSharedValue(1);
  const tapBeginXV = useSharedValue(0); const tapBeginYV = useSharedValue(0);
  const canvasLeftV = useSharedValue(0); const canvasTopV = useSharedValue(0);
  const [dragId, setDragId] = useState(null);
  const [xform, setXform] = useState({ tx: 0, ty: 0, sc: 1 });
  const xformStateRef = useRef({ tx: 0, ty: 0, sc: 1 });
  const pendingXformRef = useRef(null);
  const xformPublishFrameRef = useRef(null);
  const xformIdleCommitTimeoutRef = useRef(null);
  const pendingLiveXformRef = useRef(null);
  const liveXformFrameRef = useRef(null);
  const gestureActive = useRef(false);
  const gestureVisualThrottleRef = useRef(false);
  const viewportMovedRef = useRef(false);
  const sceneEpochRef = useRef(Date.now());
  const initialViewportAppliedRef = useRef(false);
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  const isInteractingRef = useRef(false);
  const interactionSessionCountRef = useRef(0);
  const spatialIndexRef = useRef(null);
  // Map bounds as shared values so worklets can clamp on UI thread (no snap-back)
  const boundsMinX = useSharedValue(-2000);
  const boundsMaxX = useSharedValue(2000);
  const boundsMinY = useSharedValue(-2000);
  const boundsMaxY = useSharedValue(2000);
  const canvasWV = useSharedValue(400);
  const canvasHV = useSharedValue(800);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    xformStateRef.current = xform;
  }, [xform]);

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
    const startN = nodes.find((n) => n.isStart);
    boundsMaxY.value = startN ? startN.y + 1400 : cy + hh;
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

  const clampViewport = (tx, ty, sc) => {
    const { width: canvasWidth, height: canvasHeight } = canvasSizeRef.current;
    const cw = canvasWidth || 400;
    const ch = canvasHeight || 800;
    const minTx = cw - boundsMaxX.value * sc;
    const maxTx = -boundsMinX.value * sc;
    const minTy = ch - boundsMaxY.value * sc;
    const maxTy = -boundsMinY.value * sc;

    return {
      tx: minTx > maxTx ? (minTx + maxTx) / 2 : Math.min(Math.max(tx, minTx), maxTx),
      ty: minTy > maxTy ? minTy : Math.min(Math.max(ty, minTy), maxTy),
      sc,
    };
  };

  const flushLiveXform = (force = false) => {
    const flush = () => {
      liveXformFrameRef.current = null;
      const current = pendingLiveXformRef.current;
      pendingLiveXformRef.current = null;
      if (!current) {
        return;
      }
      txV.value = current.tx;
      tyV.value = current.ty;
      scV.value = current.sc;
    };

    if (force) {
      if (liveXformFrameRef.current !== null) {
        cancelAnimationFrame(liveXformFrameRef.current);
        liveXformFrameRef.current = null;
      }
      flush();
      return;
    }

    if (liveXformFrameRef.current === null) {
      liveXformFrameRef.current = requestAnimationFrame(flush);
    }
  };
  const setLiveXform = (tx, ty, sc) => {
    const next = clampViewport(tx, ty, sc);
    txN.current = next.tx; tyN.current = next.ty; scN.current = next.sc;
    pendingLiveXformRef.current = next;
    flushLiveXform(false);
  };
  const shouldPublishXformState = useCallback((next, forcePublish = false) => {
    if (forcePublish) {
      return true;
    }

    const prev = pendingXformRef.current || xformStateRef.current;
    if (!prev) {
      return true;
    }

    if (Math.abs(next.sc - prev.sc) >= PAN_STATE_SYNC_MIN_SCALE_DELTA) {
      return true;
    }

    const { width, height } = canvasSizeRef.current;
    const minScreenDelta = Math.max(
      Math.min(width || 0, height || 0) * 0.08,
      PAN_STATE_SYNC_MIN_SCREEN_DELTA,
    );

    return (
      Math.abs(next.tx - prev.tx) >= minScreenDelta
      || Math.abs(next.ty - prev.ty) >= minScreenDelta
    );
  }, []);
  const queueXformState = (next, { immediate = false, forcePublish = false } = {}) => {
    if (!shouldPublishXformState(next, forcePublish)) {
      pendingXformRef.current = null;
      return;
    }

    pendingXformRef.current = next;

    const flush = () => {
      xformPublishFrameRef.current = null;
      const current = pendingXformRef.current;
      pendingXformRef.current = null;
      if (!current) {
        return;
      }
      startTransition(() => {
        setXform((prev) => (
          prev.tx === current.tx && prev.ty === current.ty && prev.sc === current.sc
            ? prev
            : current
        ));
      });
    };

    if (immediate) {
      if (xformPublishFrameRef.current !== null) {
        cancelAnimationFrame(xformPublishFrameRef.current);
        xformPublishFrameRef.current = null;
      }
      flush();
      return;
    }

    if (xformPublishFrameRef.current === null) {
      xformPublishFrameRef.current = requestAnimationFrame(flush);
    }
  };
  const publishXform = (force = false) => {
    queueXformState(
      { tx: txN.current, ty: tyN.current, sc: scN.current },
      { immediate: force, forcePublish: force },
    );
  };
  const cancelQueuedXformState = () => {
    pendingXformRef.current = null;
    if (xformPublishFrameRef.current !== null) {
      cancelAnimationFrame(xformPublishFrameRef.current);
      xformPublishFrameRef.current = null;
    }
    if (xformIdleCommitTimeoutRef.current !== null) {
      clearTimeout(xformIdleCommitTimeoutRef.current);
      xformIdleCommitTimeoutRef.current = null;
    }
  };
  const previewXform = (tx, ty, sc) => {
    queueXformState({ tx, ty, sc }, { forcePublish: true });
  };
  const commitLiveXform = ({
    immediate = false,
    delayMs = PAN_STATE_SYNC_DELAY_MS,
    forcePublish = false,
  } = {}) => {
    pendingXformRef.current = { tx: txN.current, ty: tyN.current, sc: scN.current };

    if (xformIdleCommitTimeoutRef.current !== null) {
      clearTimeout(xformIdleCommitTimeoutRef.current);
      xformIdleCommitTimeoutRef.current = null;
    }

    if (immediate || delayMs <= 0) {
      queueXformState(
        { tx: txN.current, ty: tyN.current, sc: scN.current },
        { immediate: true, forcePublish },
      );
      return;
    }

    xformIdleCommitTimeoutRef.current = setTimeout(() => {
      xformIdleCommitTimeoutRef.current = null;
      queueXformState(
        { tx: txN.current, ty: tyN.current, sc: scN.current },
        { immediate: true, forcePublish },
      );
    }, delayMs);
  };
  const animateViewportTo = (rawTx, rawTy, rawSc, duration = 180) => {
    const next = clampViewport(rawTx, rawTy, rawSc);
    pendingLiveXformRef.current = null;
    if (liveXformFrameRef.current !== null) {
      cancelAnimationFrame(liveXformFrameRef.current);
      liveXformFrameRef.current = null;
    }
    previewXform(next.tx, next.ty, next.sc);
    txN.current = next.tx;
    tyN.current = next.ty;
    scN.current = next.sc;
    txV.value = withTiming(next.tx, { duration });
    tyV.value = withTiming(next.ty, { duration });
    scV.value = withTiming(next.sc, { duration }, (finished) => {
      if (finished) {
        runOnJS(commitSharedXform)(next.tx, next.ty, next.sc);
      }
    });
  };

  useEffect(() => {
    canvasWV.value = canvasSize.width || 400;
    canvasHV.value = canvasSize.height || 800;
    canvasSizeRef.current = canvasSize;
  }, [canvasSize.width, canvasSize.height]);

  useEffect(() => () => {
    if (xformPublishFrameRef.current !== null) {
      cancelAnimationFrame(xformPublishFrameRef.current);
    }
    if (liveXformFrameRef.current !== null) {
      cancelAnimationFrame(liveXformFrameRef.current);
    }
    if (xformIdleCommitTimeoutRef.current !== null) {
      clearTimeout(xformIdleCommitTimeoutRef.current);
    }
  }, []);

  const getHomeViewport = () => {
    const startNode = tR.current.nodes.find((n) => n.isStart);
    if (!startNode || !canvasSize.width || !canvasSize.height) return null;

    return {
      tx: (canvasSize.width / 2) - (startNode.x * HOME_VIEW_SCALE),
      ty: (canvasSize.height * HOME_VIEW_Y_RATIO) - (startNode.y * HOME_VIEW_SCALE),
      sc: HOME_VIEW_SCALE,
    };
  };

  const getNodeFocusViewport = useCallback((node, {
    scaleBoost = 1.12,
    minScale = HOME_VIEW_SCALE + 0.08,
    yRatio = 0.5,
  } = {}) => {
    if (!node || !canvasSize.width || !canvasSize.height) {
      return null;
    }

    // Always ensure we zoom in close enough to see the animation clearly.
    // If the user is far away (sc < 0.7), snap straight to a comfortable near scale.
    const isFarAway = scN.current < 0.7;
    const nextSc = isFarAway
      ? Math.min(HOME_VIEW_SCALE + 0.08, MAX_SC)
      : Math.min(
          Math.max(scN.current * scaleBoost, scN.current + 0.06, minScale),
          Math.min(MAX_SC, 1.32),
        );

    return {
      tx: (canvasSize.width / 2) - (node.x * nextSc),
      ty: (canvasSize.height * yRatio) - (node.y * nextSc),
      sc: nextSc,
    };
  }, [canvasSize.height, canvasSize.width]);

  const handleGoHome = () => {
    const nextViewport = getHomeViewport();
    if (!nextViewport) return;
    animateViewportTo(nextViewport.tx, nextViewport.ty, nextViewport.sc, 220);
  };

  useEffect(() => {
    if (initialViewportAppliedRef.current || !canvasSize.width || !canvasSize.height) {
      return;
    }

    const nextViewport = getHomeViewport();
    if (!nextViewport) {
      return;
    }

    setLiveXform(nextViewport.tx, nextViewport.ty, nextViewport.sc);
    commitLiveXform({ immediate: true, forcePublish: true });
    initialViewportAppliedRef.current = true;
  }, [canvasSize.height, canvasSize.width]);

  // TEMP: Zoom buttons for testing on emulator (remove before release)
  const handleZoom = (direction) => {
    const zoomFactor = direction === 'in' ? 1.3 : 0.7;
    const curSc = scN.current;
    const nextSc = Math.min(Math.max(curSc * zoomFactor, MIN_SC), MAX_SC);
    const cx = canvasSize.width / 2;
    const cy = canvasSize.height / 2;
    const currentTx = txN.current;
    const currentTy = tyN.current;
    const svgX = (cx - currentTx) / curSc;
    const svgY = (cy - currentTy) / curSc;
    const nextTx = cx - svgX * nextSc;
    const nextTy = cy - svgY * nextSc;
    animateViewportTo(nextTx, nextTy, nextSc, 180);
  };

  const cL = useRef(0); const cT = useRef(0); const cRef = useRef(null);
  const tapStartViewportRef = useRef({ tx: 0, ty: 0, sc: 1 });
  const tapStartNodeRef = useRef(null);
  const tapStartRockRef = useRef(null);
  const measureC = () => cRef.current?.measure((_, __, _w, _h, px, py) => {
    cL.current = px;
    cT.current = py;
    canvasLeftV.value = px;
    canvasTopV.value = py;
  });
  const handleCanvasLayout = (evt) => {
    const { width, height } = evt.nativeEvent.layout;
    const nextSize = { width, height };

    canvasSizeRef.current = nextSize;
    setCanvasSize((prev) => (
      prev.width === width && prev.height === height ? prev : nextSize
    ));
    requestAnimationFrame(measureC);
  };
  const backdropRocks = useMemo(
    () => buildBackdropRocks(canvasSize),
    [canvasSize.height, canvasSize.width],
  );
  const getLocalPointFromNativeEvent = (nativeEvent) => ({
    x: Number.isFinite(nativeEvent?.locationX) ? nativeEvent.locationX : ((nativeEvent?.pageX ?? 0) - cL.current),
    y: Number.isFinite(nativeEvent?.locationY) ? nativeEvent.locationY : ((nativeEvent?.pageY ?? 0) - cT.current),
  });

  const getNodeHitRadius = (scale = 1) => {
    const safeScale = Math.max(scale || 1, 0.001);
    return Math.max(NODE_R + 28, Math.min(NODE_R + 64, NODE_HIT_RADIUS / safeScale));
  };
  const toSVGFromLocalWithViewport = (localX, localY, viewport) => ({
    x: (localX - viewport.tx) / viewport.sc,
    y: (localY - viewport.ty) / viewport.sc,
  });
  const toSVGFromLocal = (localX, localY) => toSVGFromLocalWithViewport(localX, localY, {
    tx: txN.current,
    ty: tyN.current,
    sc: scN.current,
  });
  const toSVG = (px, py) => toSVGFromLocal(px - cL.current, py - cT.current);
  const hitNodeAtLocalWithViewport = (localX, localY, viewport) => {
    const p = toSVGFromLocalWithViewport(localX, localY, viewport);
    const hitRadius = getNodeHitRadius(viewport.sc);
    // Use tR.current so this works correctly from stale PanResponder closures
    const currentNodes = tR.current.nodes;
    const useFullTree = currentNodes.length <= 48 && tR.current.edges.length <= 96;
    const candidates = useFullTree ? currentNodes : querySpatialNodes(spatialIndexRef.current, {
      left: p.x - hitRadius,
      top: p.y - hitRadius,
      right: p.x + hitRadius,
      bottom: p.y + hitRadius,
    });

    let bestNode = null;
    let bestDistance = Infinity;

    for (const candidate of candidates) {
      const distance = Math.hypot(candidate.x - p.x, candidate.y - p.y);
      if (distance <= hitRadius && distance < bestDistance) {
        bestNode = candidate;
        bestDistance = distance;
      }
    }

    if (bestNode) {
      return bestNode;
    }

    const fallbackRadius = hitRadius + 16;
    const fallbackCandidates = useFullTree ? currentNodes : querySpatialNodes(spatialIndexRef.current, {
      left: p.x - fallbackRadius,
      top: p.y - fallbackRadius,
      right: p.x + fallbackRadius,
      bottom: p.y + fallbackRadius,
    });
    for (const candidate of fallbackCandidates) {
      const distance = Math.hypot(candidate.x - p.x, candidate.y - p.y);
      if (distance <= fallbackRadius && distance < bestDistance) {
        bestNode = candidate;
        bestDistance = distance;
      }
    }

    return bestNode;
  };
  const hitNodeAtLocal = (localX, localY) => hitNodeAtLocalWithViewport(localX, localY, {
    tx: txN.current,
    ty: tyN.current,
    sc: scN.current,
  });
  const hitNode = (px, py) => hitNodeAtLocal(px - cL.current, py - cT.current);
  const hitBackdropRockAtLocal = useCallback((localX, localY) => {
    const { width, height } = canvasSizeRef.current;
    if (!width || !height) {
      return null;
    }

    const sceneMs = Date.now() - sceneEpochRef.current;

    for (let i = backdropRocks.length - 1; i >= 0; i -= 1) {
      const rock = backdropRocks[i];
      const state = getBackdropRockState(rock, sceneMs, isInteractingRef.current ? 0.72 : 1, 1);
      if (state.opacity < 0.14) continue;

      const rx = Math.max(22, rock.width * 0.96 * state.scale);
      const ry = Math.max(14, rock.height * 1.12 * state.scale);
      const dx = localX - state.x;
      const dy = localY - state.y;
      const ellipseHit = ((dx * dx) / (rx * rx)) + ((dy * dy) / (ry * ry));

      if (ellipseHit <= 1.22) {
        return {
          id: rock.id,
          x: state.x,
          y: state.y,
        };
      }
    }

    return null;
  }, [backdropRocks]);
  const hitBackdropRock = (pageX, pageY) => hitBackdropRockAtLocal(pageX - cL.current, pageY - cT.current);

  const gSx = useRef(0); const gSy = useRef(0); const gLx = useRef(0); const gLy = useRef(0); const moved = useRef(false);
  const pOn = useRef(false); const pD0 = useRef(0); const pSc0 = useRef(1); const pTx0 = useRef(0); const pTy0 = useRef(0);
  const pMx0 = useRef(0); const pMy0 = useRef(0);
  const dId = useRef(null); const dNx = useRef(0); const dNy = useRef(0); const dPx = useRef(0); const dPy = useRef(0);
  const dragLive = useRef({ id: null, x: 0, y: 0 });
  const glowDebounceRef = useRef(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const interactionTier = useMemo(() => {
    if (!isInteracting) return 'idle';
    return xform.sc < 0.62 ? 'heavy' : 'medium';
  }, [isInteracting, xform.sc]);

  useEffect(() => () => {
    if (glowDebounceRef.current) {
      clearTimeout(glowDebounceRef.current);
    }
  }, []);

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
    interactionSessionCountRef.current += 1;
    if (xformIdleCommitTimeoutRef.current !== null) {
      clearTimeout(xformIdleCommitTimeoutRef.current);
      xformIdleCommitTimeoutRef.current = null;
    }
    if (glowDebounceRef.current) {
      clearTimeout(glowDebounceRef.current);
      glowDebounceRef.current = null;
    }
    if (isInteractingRef.current) {
      return;
    }
    isInteractingRef.current = true;
    startTransition(() => {
      setIsInteracting(true);
    });
  };
  const endInteraction = () => {
    interactionSessionCountRef.current = Math.max(0, interactionSessionCountRef.current - 1);
    if (interactionSessionCountRef.current > 0) {
      return;
    }
    if (glowDebounceRef.current) {
      clearTimeout(glowDebounceRef.current);
    }
    glowDebounceRef.current = setTimeout(() => {
      isInteractingRef.current = false;
      startTransition(() => {
        setIsInteracting(false);
      });
      glowDebounceRef.current = null;
    }, INTERACTION_IDLE_DELAY_MS);
  };
  const beginGestureInteraction = (enableVisualThrottle = false) => {
    if (!gestureActive.current) {
      gestureActive.current = true;
    }
    if (enableVisualThrottle && !gestureVisualThrottleRef.current) {
      gestureVisualThrottleRef.current = true;
      beginInteraction();
    }
  };
  const endGestureInteraction = () => {
    if (!gestureActive.current) {
      return;
    }
    gestureActive.current = false;
    flushLiveXform(true);
    commitLiveXform();
    if (gestureVisualThrottleRef.current) {
      gestureVisualThrottleRef.current = false;
      endInteraction();
    }
  };

  const handleViewTap = useCallback((
    localX,
    localY,
    pageX,
    pageY,
    fallbackLocalX = NaN,
    fallbackLocalY = NaN,
    viewport = tapStartViewportRef.current,
    preferredNode = tapStartNodeRef.current,
    preferredRock = tapStartRockRef.current,
  ) => {
    const hit = preferredNode || (Number.isFinite(localX) && Number.isFinite(localY)
      ? hitNodeAtLocalWithViewport(localX, localY, viewport)
      : hitNode(pageX, pageY));
    const resolvedHit = hit || (
      Number.isFinite(fallbackLocalX) && Number.isFinite(fallbackLocalY)
        ? hitNodeAtLocalWithViewport(fallbackLocalX, fallbackLocalY, viewport)
        : null
    );
    if (resolvedHit) {
      setSel({ ...resolvedHit });
      return;
    }

    const rockHit = preferredRock || (Number.isFinite(localX) && Number.isFinite(localY)
      ? hitBackdropRockAtLocal(localX, localY)
      : hitBackdropRock(pageX, pageY));
    const resolvedRockHit = rockHit || (
      Number.isFinite(fallbackLocalX) && Number.isFinite(fallbackLocalY)
        ? hitBackdropRockAtLocal(fallbackLocalX, fallbackLocalY)
        : null
    );
    if (!resolvedRockHit) {
      return;
    }

    const burstId = `${resolvedRockHit.id}_${Date.now()}`;
    if (rockBurstTimeoutRef.current) {
      clearTimeout(rockBurstTimeoutRef.current);
    }

    setRockBurstFx({
      id: burstId,
      rockId: resolvedRockHit.id,
      x: resolvedRockHit.x,
      y: resolvedRockHit.y,
    });
    rockBurstProgressV.value = 0;
    rockBurstProgressV.value = withTiming(1, { duration: 780 });
    rockBurstTimeoutRef.current = setTimeout(() => {
      setRockBurstFx((current) => (current?.id === burstId ? null : current));
      rockBurstTimeoutRef.current = null;
    }, 860);
  }, [hitBackdropRockAtLocal, spatialIndex]);

  const commitSharedXform = (rawTx, rawTy, sc) => {
    const next = clampViewport(rawTx, rawTy, sc);
    txN.current = next.tx; tyN.current = next.ty; scN.current = next.sc;
    pendingLiveXformRef.current = null;
    txV.value = next.tx; tyV.value = next.ty; scV.value = next.sc;
    queueXformState(next, { immediate: true, forcePublish: true });
  };
  const settleSharedXform = (rawTx, rawTy, sc, {
    delayMs = PAN_STATE_SYNC_DELAY_MS,
    forcePublish = false,
  } = {}) => {
    const next = clampViewport(rawTx, rawTy, sc);
    txN.current = next.tx; tyN.current = next.ty; scN.current = next.sc;
    pendingLiveXformRef.current = null;
    txV.value = next.tx; tyV.value = next.ty; scV.value = next.sc;
    commitLiveXform({ immediate: delayMs <= 0, delayMs, forcePublish });
  };

  const navGesture = useMemo(() => {
    // Tap wins the Race for movements < TAP_MOVE_TOLERANCE.
    // Pan only activates after TAP_MOVE_TOLERANCE, so both thresholds match
    // and there is no gap or overlap between tap and drag.
    const tap = Gesture.Tap()
      .maxDistance(TAP_MOVE_TOLERANCE)
      .onBegin((evt) => {
        tapBeginXV.value = evt.x;
        tapBeginYV.value = evt.y;
        tapStartTxV.value = txV.value;
        tapStartTyV.value = tyV.value;
        tapStartScV.value = scV.value;
      })
      .onEnd((evt, success) => {
        if (!success) return;
        runOnJS(handleViewTap)(
          tapBeginXV.value,
          tapBeginYV.value,
          evt.absoluteX,
          evt.absoluteY,
          evt.x,
          evt.y,
          { tx: tapStartTxV.value, ty: tapStartTyV.value, sc: tapStartScV.value },
          null,
          null,
        );
      });

    const pan = Gesture.Pan()
      .maxPointers(1)
      .activeOffsetX([-TAP_MOVE_TOLERANCE, TAP_MOVE_TOLERANCE])
      .activeOffsetY([-TAP_MOVE_TOLERANCE, TAP_MOVE_TOLERANCE])
      .shouldCancelWhenOutside(false)
      .onStart(() => {
        if (pinchActiveV.value) {
          return;
        }
        panStartTx.value = txV.value;
        panStartTy.value = tyV.value;
        panStartSc.value = scV.value;
        if (enableLiveViewportPreview) {
          navPreviewTxV.value = txV.value;
          navPreviewTyV.value = tyV.value;
          navPreviewScV.value = scV.value;
        }
        runOnJS(cancelQueuedXformState)();
        runOnJS(beginInteraction)();
      })
      .onUpdate((evt) => {
        'worklet';
        if (pinchActiveV.value) {
          return;
        }
        const sc = panStartSc.value;
        const rawTx = panStartTx.value + evt.translationX;
        const rawTy = panStartTy.value + evt.translationY;
        const nextTx = clampTx(rawTx, sc);
        const nextTy = clampTy(rawTy, sc);
        txV.value = nextTx;
        tyV.value = nextTy;
        scV.value = sc;

        if (enableLiveViewportPreview && (
          Math.abs(nextTx - navPreviewTxV.value) > 32
          || Math.abs(nextTy - navPreviewTyV.value) > 32
        )) {
          navPreviewTxV.value = nextTx;
          navPreviewTyV.value = nextTy;
          navPreviewScV.value = sc;
          runOnJS(previewXform)(nextTx, nextTy, sc);
        }
      })
      .onFinalize((_evt, success) => {
        if (!success || pinchActiveV.value) {
          runOnJS(endInteraction)();
          return;
        }
        runOnJS(settleSharedXform)(txV.value, tyV.value, scV.value, {
          delayMs: PAN_STATE_SYNC_DELAY_MS,
          forcePublish: false,
        });
        runOnJS(endInteraction)();
      });

    const pinch = Gesture.Pinch()
      .onStart((evt) => {
        // Set flag here (not onBegin) — onBegin fires for any touch including single-finger,
        // which would block Pan. onStart only fires when pinch actually activates (2 fingers).
        pinchActiveV.value = 1;
        pinchStartSc.value = scV.value;
        pinchStartTx.value = txV.value;
        pinchStartTy.value = tyV.value;
        const fx = evt.focalX - canvasLeftV.value;
        const fy = evt.focalY - canvasTopV.value;
        pinchStartSvgFx.value = (fx - pinchStartTx.value) / pinchStartSc.value;
        pinchStartSvgFy.value = (fy - pinchStartTy.value) / pinchStartSc.value;
        if (enableLiveViewportPreview) {
          navPreviewTxV.value = txV.value;
          navPreviewTyV.value = tyV.value;
          navPreviewScV.value = scV.value;
        }
        runOnJS(cancelQueuedXformState)();
        runOnJS(beginInteraction)();
      })
      .onUpdate((evt) => {
        const nextSc = Math.min(Math.max(pinchStartSc.value * evt.scale, MIN_SC), MAX_SC);
        const fx = evt.focalX - canvasLeftV.value;
        const fy = evt.focalY - canvasTopV.value;
        const nextTx = clampTx(fx - (pinchStartSvgFx.value * nextSc), nextSc);
        const nextTy = clampTy(fy - (pinchStartSvgFy.value * nextSc), nextSc);

        scV.value = nextSc;
        txV.value = nextTx;
        tyV.value = nextTy;

        if (enableLiveViewportPreview && (
          Math.abs(nextSc - navPreviewScV.value) > 0.05
          || Math.abs(nextTx - navPreviewTxV.value) > 32
          || Math.abs(nextTy - navPreviewTyV.value) > 32
        )) {
          navPreviewTxV.value = nextTx;
          navPreviewTyV.value = nextTy;
          navPreviewScV.value = nextSc;
          runOnJS(previewXform)(nextTx, nextTy, nextSc);
        }
      })
      .onFinalize(() => {
        pinchActiveV.value = 0;
        runOnJS(settleSharedXform)(txV.value, tyV.value, scV.value, {
          delayMs: 90,
          forcePublish: true,
        });
        runOnJS(endInteraction)();
      });

    return Gesture.Race(tap, Gesture.Simultaneous(pinch, pan));
  }, [enableLiveViewportPreview, handleViewTap]);

  const panR = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.hypot(g.dx, g.dy) > 3,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: (evt) => {
      const ts = evt.nativeEvent.touches;
      moved.current = false; pOn.current = false;
      gestureActive.current = false;
      gestureVisualThrottleRef.current = false;
      viewportMovedRef.current = false;
      tapStartNodeRef.current = null;
      tapStartRockRef.current = null;
      tapStartViewportRef.current = {
        tx: txV.value,
        ty: tyV.value,
        sc: scV.value,
      };
      cancelQueuedXformState();
      clearDragPos();
      if (ts.length >= 2) {
        beginGestureInteraction(true);
        pOn.current = true;
        pD0.current = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
        pSc0.current = scN.current; pTx0.current = txN.current; pTy0.current = tyN.current;
        pMx0.current = (ts[0].pageX + ts[1].pageX) / 2 - cL.current;
        pMy0.current = (ts[0].pageY + ts[1].pageY) / 2 - cT.current;
        return;
      }
      const t = ts[0];
      gSx.current = t.pageX; gSy.current = t.pageY; gLx.current = t.pageX; gLy.current = t.pageY;
      const { x: localX, y: localY } = getLocalPointFromNativeEvent(evt.nativeEvent);
      if (!bR.current) {
        tapStartNodeRef.current = hitNodeAtLocalWithViewport(localX, localY, tapStartViewportRef.current);
        tapStartRockRef.current = tapStartNodeRef.current ? null : hitBackdropRockAtLocal(localX, localY);
      }
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
        beginGestureInteraction(true);
        pOn.current = true;
        pD0.current = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
        pSc0.current = scN.current; pTx0.current = txN.current; pTy0.current = tyN.current;
        pMx0.current = (ts[0].pageX + ts[1].pageX) / 2 - cL.current;
        pMy0.current = (ts[0].pageY + ts[1].pageY) / 2 - cT.current;
        return;
      }
      if (pOn.current && ts.length < 2) {
        pOn.current = false;
        if (ts.length === 1) {
          gSx.current = ts[0].pageX;
          gSy.current = ts[0].pageY;
          gLx.current = ts[0].pageX;
          gLy.current = ts[0].pageY;
        }
        return;
      }
      if (pOn.current && ts.length >= 2) {
        const d = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
        const newSc = Math.min(Math.max(pSc0.current * (d / pD0.current), MIN_SC), MAX_SC);
        const curMx = (ts[0].pageX + ts[1].pageX) / 2 - cL.current;
        const curMy = (ts[0].pageY + ts[1].pageY) / 2 - cT.current;
        const svgMx = (pMx0.current - pTx0.current) / pSc0.current;
        const svgMy = (pMy0.current - pTy0.current) / pSc0.current;
        viewportMovedRef.current = true;
        setLiveXform(curMx - svgMx * newSc, curMy - svgMy * newSc, newSc);
        moved.current = true; return;
      }
      if (ts.length !== 1) return;
      const t = ts[0];
      const totalMove = Math.hypot(t.pageX - gSx.current, t.pageY - gSy.current);
      if (bR.current && tR2.current === 'move' && dId.current) {
        if (totalMove > DRAG_MOVE_THRESHOLD) moved.current = true;
        beginGestureInteraction(true);
        const p = toSVG(t.pageX, t.pageY);
        const nx = dNx.current + (p.x - dPx.current); const ny = dNy.current + (p.y - dPy.current);
        dragLive.current = { id: dId.current, x: nx, y: ny };
        dragXV.value = nx; dragYV.value = ny;
        gLx.current = t.pageX; gLy.current = t.pageY; return;
      }
      const panActivationThreshold = tapStartNodeRef.current || tapStartRockRef.current
        ? TAP_MOVE_TOLERANCE
        : DRAG_MOVE_THRESHOLD;
      if (totalMove <= panActivationThreshold) {
        return;
      }
      if (!moved.current) {
        moved.current = true;
        gLx.current = t.pageX; gLy.current = t.pageY;
        return;
      }
      beginGestureInteraction(true);
      viewportMovedRef.current = true;
      setLiveXform(txN.current + (t.pageX - gLx.current), tyN.current + (t.pageY - gLy.current), scN.current);
      gLx.current = t.pageX; gLy.current = t.pageY;
    },
    onPanResponderRelease: (evt) => {
      pOn.current = false;
      endGestureInteraction();
      if (bR.current && tR2.current === 'move' && dId.current && moved.current) {
        const live = dragLive.current;
        if (live.id) {
          commit({ ...tR.current, nodes: tR.current.nodes.map((n) => (n.id === live.id ? { ...n, x: live.x, y: live.y } : n)) });
        }
        clearDragPos();
        return;
      }
      clearDragPos();
      const { pageX, pageY } = evt.nativeEvent;
      const { x: localX, y: localY } = getLocalPointFromNativeEvent(evt.nativeEvent);
      const totalMove = Math.hypot(pageX - gSx.current, pageY - gSy.current);
      const isTapLike = !viewportMovedRef.current && (
        !!tapStartNodeRef.current
        || !!tapStartRockRef.current
        || totalMove <= TAP_MOVE_TOLERANCE
      );
      const hit = hitNode(pageX, pageY);
      if (!bR.current) {
        if (isTapLike) {
          handleViewTap(
            localX,
            localY,
            pageX,
            pageY,
            gSx.current - cL.current,
            gSy.current - cT.current,
            tapStartViewportRef.current,
            tapStartNodeRef.current,
            tapStartRockRef.current,
          );
        }
        tapStartNodeRef.current = null;
        tapStartRockRef.current = null;
        viewportMovedRef.current = false;
        return;
      }
      if (moved.current) return;
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
      if (tR2.current === 'edit' && hit) {
        setEditingNodeId(hit.id);
        setNodeEditorVisible(true);
        return;
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
      endGestureInteraction();
      tapStartNodeRef.current = null;
      tapStartRockRef.current = null;
      viewportMovedRef.current = false;
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
      info: {
        ...tR.current.info,
        [id]: {
          desc: 'No description yet.',
          str: 5,
          bal: 5,
          tec: 5,
          guideVideoUrl: '',
        },
      },
    });
    showPrompt(false);
  };
  const handleSaveNodeEdits = ({ node: nextNode, info: nextInfo }) => {
    commit({
      ...tR.current,
      nodes: tR.current.nodes.map((currentNode) => (
        currentNode.id === nextNode.id
          ? { ...currentNode, ...nextNode }
          : currentNode
      )),
      info: {
        ...(tR.current.info || {}),
        [nextNode.id]: nextInfo,
      },
    });
    setSel((current) => (current?.id === nextNode.id ? { ...current, ...nextNode } : current));
    setEditingNodeId(null);
    setNodeEditorVisible(false);
  };
  const emitUnlockFx = (nextTree, nodeId, {
    duration = UNLOCK_FX_DURATION_MS,
    intensity = 'hero',
  } = {}) => {
    const targetNode = nextTree.nodes.find((node) => node.id === nodeId);
    if (!targetNode) {
      return;
    }

    const prereqIds = nextTree.edges
      .filter((edge) => edge.to === nodeId)
      .map((edge) => edge.from);
    const qualifiedSourceIds = prereqIds.filter((candidateId) => {
      const candidateNode = nextTree.nodes.find((node) => node.id === candidateId);
      return candidateNode?.unlocked || candidateNode?.isStart;
    });
    const sourceId = qualifiedSourceIds[0] || prereqIds[0] || null;
    const sourceIds = qualifiedSourceIds.length > 0 ? qualifiedSourceIds : (sourceId ? [sourceId] : []);
    const startedAt = Date.now();
    const id = `${nodeId}_${startedAt}`;

    if (unlockFxTimeoutRef.current) {
      clearTimeout(unlockFxTimeoutRef.current);
    }

    setUnlockFx({
      id,
      nodeId,
      sourceId,
      sourceIds,
      branch: resolveBranch(targetNode),
      startedAt,
      duration,
      intensity,
    });
    unlockFxProgressV.value = 0;
    unlockFxProgressV.value = withTiming(1, { duration });

    unlockFxTimeoutRef.current = setTimeout(() => {
      setUnlockFx((current) => (current?.id === id ? null : current));
      unlockFxTimeoutRef.current = null;
    }, duration + UNLOCK_FX_CLEANUP_BUFFER_MS);
  };
  const record = async (id, {
    deferUntilClose = false,
    unlockFxDuration = UNLOCK_FX_DURATION_MS,
    unlockFxIntensity = 'hero',
    skipEmitFx = false,
  } = {}) => {
    const currentNode = tR.current.nodes.find((node) => node.id === id);
    if (!currentNode || currentNode.isStart) {
      return false;
    }

    if (deferUntilClose && !currentNode.unlocked) {
      setPendingUnlockNodeId(id);
      setSel({ ...currentNode });
      return true;
    }

    if (currentNode.unlocked) {
      setPendingUnlockNodeId((current) => (current === id ? null : current));
      // Replay unlock animation if toggle enabled (e.g., after updating attempt video)
      if (replayUnlockAnim) {
        setSel((prev) => (prev?.id === id ? null : prev));
        emitUnlockFx(tR.current, id, {
          duration: unlockFxDuration,
          intensity: unlockFxIntensity,
        });
      }
      return true;
    }

    const t = { ...tR.current, nodes: tR.current.nodes.map((n) => (n.id === id ? { ...n, unlocked: true } : n)) };

    // Auto-close skill card for this node before animation starts
    setSel((prev) => (prev?.id === id ? null : prev));

    // Fire animation BEFORE committing tree state — prevents the pre-flash
    // where the node briefly renders as "mastered" before the animation begins
    if (!skipEmitFx) {
      emitUnlockFx(t, id, {
        duration: unlockFxDuration,
        intensity: unlockFxIntensity,
      });
    }

    const didCommit = await commitCloudProgress(t, (nextProgress) => Promise.all([
      unlockNode(userId, id),
      saveXp(userId, nextProgress.xp, nextProgress.level),
    ]));

    if (didCommit) {
      setPendingUnlockNodeId((current) => (current === id ? null : current));
    } else {
      // Commit failed — roll back the animation
      setUnlockFx(null);
    }

    return didCommit;
  };

  const completePendingUnlock = useCallback(async (nodeId) => {
    if (!nodeId || pendingUnlockInFlightRef.current) {
      return;
    }

    pendingUnlockInFlightRef.current = true;

    try {
      const targetNode = tR.current.nodes.find((node) => node.id === nodeId);
      setPendingUnlockNodeId(null);
      setSel(null);

      // Save viewport so we can return to it after the animation
      const savedViewport = { tx: txN.current, ty: tyN.current, sc: scN.current };
      let didZoomIn = false;

      let focusDuration = UNLOCK_FOCUS_ZOOM_DURATION_MS;

      if (targetNode) {
        const focusViewport = getNodeFocusViewport(targetNode);
        if (focusViewport) {
          // Scale animation duration to how far the camera needs to travel.
          // Large pan + scale changes (far-away nodes) need more time to look smooth.
          const txDelta = Math.abs(focusViewport.tx - txN.current);
          const tyDelta = Math.abs(focusViewport.ty - tyN.current);
          const scDelta = Math.abs(focusViewport.sc - scN.current);
          const travelFactor = Math.max(
            txDelta / Math.max(canvasSize.width, 1),
            tyDelta / Math.max(canvasSize.height, 1),
            scDelta,
          );
          focusDuration = Math.round(Math.min(Math.max(UNLOCK_FOCUS_ZOOM_DURATION_MS, travelFactor * 980), 820));

          animateViewportTo(
            focusViewport.tx,
            focusViewport.ty,
            focusViewport.sc,
            focusDuration,
          );
          didZoomIn = true;
        }
      }

      // Wait for zoom to finish
      await new Promise((resolve) => setTimeout(resolve, focusDuration + 60));

      // Commit unlock only if the node isn't already unlocked (cloud sync may have beaten us)
      const isAlreadyUnlocked = tR.current.nodes.find((n) => n.id === nodeId)?.unlocked;
      if (!isAlreadyUnlocked) {
        await record(nodeId, { skipEmitFx: true });
      }

      // Short pause: let ELO pulse build to its peak (~280ms), then fire FX in tandem
      await new Promise((resolve) => setTimeout(resolve, 320));

      // Fire unlock FX — ELO pulse is at peak so both animations crescendo together
      emitUnlockFx(tR.current, nodeId, {
        duration: UNLOCK_FX_DURATION_MS,
        intensity: 'hero',
      });

      // Wait for unlock FX to finish
      await new Promise((resolve) => setTimeout(resolve, UNLOCK_FX_DURATION_MS + 80));

      // Zoom back — scale return duration to travel distance too
      if (didZoomIn) {
        const returnTxDelta = Math.abs(savedViewport.tx - txN.current);
        const returnTyDelta = Math.abs(savedViewport.ty - tyN.current);
        const returnScDelta = Math.abs(savedViewport.sc - scN.current);
        const returnFactor = Math.max(
          returnTxDelta / Math.max(canvasSize.width, 1),
          returnTyDelta / Math.max(canvasSize.height, 1),
          returnScDelta,
        );
        const returnDuration = Math.round(Math.min(Math.max(UNLOCK_ZOOM_RETURN_DURATION_MS, returnFactor * 820), 900));
        animateViewportTo(
          savedViewport.tx,
          savedViewport.ty,
          savedViewport.sc,
          returnDuration,
        );
        await new Promise((resolve) => setTimeout(resolve, returnDuration + 80));
      }
    } finally {
      pendingUnlockInFlightRef.current = false;
    }
  }, [canvasSize.height, canvasSize.width, getNodeFocusViewport, record]);

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
  const nodeOrderMap = useMemo(() => new Map(tree.nodes.map((n, index) => [n.id, index])), [tree.nodes]);
  const edgeOrderMap = useMemo(() => new Map(tree.edges.map((e, index) => [e, index])), [tree.edges]);
  const spatialIndex = useMemo(
    () => buildTreeSpatialIndex(tree.nodes, tree.edges, nodeMap),
    [tree.edges, tree.nodes, nodeMap],
  );
  spatialIndexRef.current = spatialIndex;
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


  const selectedPathState = useMemo(() => {
    if (bld || !sel?.id) {
      return { edgeDepths: null, edgeCount: 0 };
    }

    const edgeDepths = {};
    const queue = [{ nodeId: sel.id, depth: 0 }];
    const seenNodes = new Set([sel.id]);
    let qi = 0;

    while (qi < queue.length) {
      const current = queue[qi++];
      const prereqs = incomingByNode.get(current.nodeId) || [];

      for (let i = 0; i < prereqs.length; i += 1) {
        const fromId = prereqs[i];
        const key = `${fromId}->${current.nodeId}`;

        if (edgeDepths[key] === undefined || current.depth < edgeDepths[key]) {
          edgeDepths[key] = current.depth;
        }

        if (!seenNodes.has(fromId)) {
          seenNodes.add(fromId);
          queue.push({ nodeId: fromId, depth: current.depth + 1 });
        }
      }
    }

    const edgeKeys = Object.keys(edgeDepths);
    return edgeKeys.length
      ? { edgeDepths, edgeCount: edgeKeys.length }
      : { edgeDepths: null, edgeCount: 0 };
  }, [bld, incomingByNode, sel?.id]);

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
  const shouldRenderFullTree = tree.nodes.length <= 48 && tree.edges.length <= 96;
  const enableLiveViewportPreview = !shouldRenderFullTree;

  const visibleBounds = useMemo(() => {
    // Small trees render all nodes unconditionally; don't recompute bounds on pan
    // (only used for spatial culling of nodes/edges/stars, all of which short-circuit for full-tree mode)
    if (shouldRenderFullTree || !canvasSize.width || !canvasSize.height) return null;
    const interactionPad = Math.max(72 / xform.sc, 48);
    return {
      left: (-xform.tx) / xform.sc - interactionPad,
      top: (-xform.ty) / xform.sc - interactionPad,
      right: (canvasSize.width - xform.tx) / xform.sc + interactionPad,
      bottom: (canvasSize.height - xform.ty) / xform.sc + interactionPad,
    };
  }, [canvasSize.height, canvasSize.width, shouldRenderFullTree, xform.sc, xform.tx, xform.ty]);

  const visibleNodes = useMemo(() => {
    if (shouldRenderFullTree || !visibleBounds) return tree.nodes;
    const margin = Math.min(Math.max((NODE_R * 2) / xform.sc, NODE_R * 2), NODE_R * 12);
    const nodeBounds = {
      left: visibleBounds.left - margin,
      top: visibleBounds.top - margin,
      right: visibleBounds.right + margin,
      bottom: visibleBounds.bottom + margin,
    };

    return querySpatialNodes(spatialIndex, nodeBounds)
      .sort((a, b) => (nodeOrderMap.get(a.id) ?? 0) - (nodeOrderMap.get(b.id) ?? 0));
  }, [nodeOrderMap, shouldRenderFullTree, spatialIndex, tree.nodes, visibleBounds, xform.sc]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const visibleEdges = useMemo(() => {
    if (shouldRenderFullTree || !visibleBounds) return tree.edges;
    const edgeMargin = NODE_R * (xform.sc < 0.6 ? 1.6 : 2.2);
    const edgeRect = {
      left: visibleBounds.left - edgeMargin,
      top: visibleBounds.top - edgeMargin,
      right: visibleBounds.right + edgeMargin,
      bottom: visibleBounds.bottom + edgeMargin,
    };

    return querySpatialEdges(spatialIndex, edgeRect)
      .filter((item) => {
        if (visibleNodeIds.has(item.edge.from) || visibleNodeIds.has(item.edge.to)) return true;
        return segmentIntersectsRect(
          item.fromNode.x,
          item.fromNode.y,
          item.toNode.x,
          item.toNode.y,
          edgeRect,
        );
      })
      .sort((a, b) => (edgeOrderMap.get(a.edge) ?? 0) - (edgeOrderMap.get(b.edge) ?? 0))
      .map((item) => item.edge);
  }, [edgeOrderMap, shouldRenderFullTree, spatialIndex, tree.edges, visibleNodeIds, visibleBounds, xform.sc]);

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
    const hardInteraction = interactionTier !== 'idle';
    const simplifyLabels = hardInteraction || isFar || (isMid && visibleNodes.length > 18);

    return {
      isFar,
      isMid,
      isNear,
      interactionTier,
      simplifyScene: isFar,
      showLabels: true, // always visible — font scales with LOD
      labelFontSize: isFar ? 9 : isMid ? 11 : 15,
      simplifyLabels,
      showOuterRing: true,
      showEdgeGlow: !isFar || visibleEdges.length <= 48,
      showDust: !hardInteraction && !isFar && !shouldRenderFullTree,
    };
  }, [interactionTier, lodTier, shouldRenderFullTree, visibleEdges.length, visibleNodes.length]);

  const nodeStyles = useMemo(() => {
    const map = {};
    for (const n of visibleNodes) {
      const status = nodeStatusMap[n.id] || 'locked';
      if (bld && connA === n.id) {
        map[n.id] = NODE_CONN_A_STYLE;
      } else if (status === 'start') {
        map[n.id] = NODE_START_STYLE;
      } else {
        const branch = resolveBranch(n);
        map[n.id] = (NODE_VISUAL_STYLES[branch] || NODE_VISUAL_STYLES.neutral)[status]
          || NODE_VISUAL_STYLES.neutral.locked;
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
    edit: 'Tap a node to update its details, requirements, and guide video',
    delete: 'Tap a node or line to delete it',
  };
  const activeTreeName = selectedTreeId
    ? (savedTrees.find((entry) => entry.id === selectedTreeId)?.name || 'Saved Tree')
    : 'Default Tree';
  const builderTools = [
    { id: 'move', label: 'Move', icon: 'scan-outline' },
    { id: 'connect', label: 'Link', icon: 'git-branch-outline' },
    { id: 'edit', label: 'Edit', icon: 'create-outline' },
    { id: 'delete', label: 'Delete', icon: 'trash-outline' },
  ];
  const editingNode = useMemo(
    () => tree.nodes.find((node) => node.id === editingNodeId) || null,
    [editingNodeId, tree.nodes],
  );
  const handleStartSkillAttempt = useCallback((node) => {
    setSel(null);
    onStartSkillAttempt?.(node);
  }, [onStartSkillAttempt]);
  const handleSkillCardClose = useCallback(() => {
    if (pendingUnlockNodeId && sel?.id === pendingUnlockNodeId) {
      void completePendingUnlock(pendingUnlockNodeId);
      return;
    }

    setSel(null);
  }, [completePendingUnlock, pendingUnlockNodeId, sel?.id]);

  const treeStats = useMemo(() => getTreeStats(tree), [tree]);
  const eloRating = useMemo(() => {
    return ELO_BASE_RATING + (treeStats.unlocked * ELO_PER_UNLOCK);
  }, [treeStats.unlocked]);
  const eloPulseScale = eloPulseV.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [1, 1.07, 1],
  });
  const eloGlowOpacity = eloPulseV.interpolate({
    inputRange: [0, 1],
    outputRange: [0.78, 1],
  });
  const eloGainTranslateY = eloGainLiftV.interpolate({
    inputRange: [0, 1],
    outputRange: [8, -10],
  });
  const eloGainScale = eloGainOpacityV.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0.92, 1.04, 1],
  });

  const playEloAnimation = (previousRating, toRating) => {
    eloCounterV.stopAnimation();
    eloPulseV.stopAnimation();
    eloGainOpacityV.stopAnimation();
    eloGainLiftV.stopAnimation();

    if (toRating > previousRating) {
      const gain = toRating - previousRating;
      setEloGainValue(gain);
      eloPulseV.setValue(0);
      eloGainOpacityV.setValue(0);
      eloGainLiftV.setValue(0);

      Animated.parallel([
        Animated.timing(eloCounterV, {
          toValue: toRating,
          duration: 620,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.sequence([
          Animated.timing(eloPulseV, {
            toValue: 1,
            duration: 190,
            easing: Easing.out(Easing.back(1.6)),
            useNativeDriver: true,
          }),
          Animated.timing(eloPulseV, {
            toValue: 0,
            duration: 480,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(60),
          Animated.parallel([
            Animated.timing(eloGainOpacityV, {
              toValue: 1,
              duration: 160,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(eloGainLiftV, {
              toValue: 1,
              duration: 620,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(eloGainOpacityV, {
            toValue: 0,
            duration: 260,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]).start(({ finished }) => {
        if (finished) {
          setEloGainValue(0);
        }
      });
      return;
    }

    setEloGainValue(0);
    eloCounterV.setValue(toRating);
    setDisplayEloRating(toRating);
  };

  useEffect(() => {
    if (!eloInitializedRef.current) {
      eloInitializedRef.current = true;
      lastEloRatingRef.current = eloRating;
      eloCounterV.setValue(eloRating);
      setDisplayEloRating(eloRating);
      return;
    }

    const previousRating = lastEloRatingRef.current;
    if (eloRating === previousRating) return;

    lastEloRatingRef.current = eloRating;
    playEloAnimation(previousRating, eloRating);
  }, [eloCounterV, eloGainLiftV, eloGainOpacityV, eloPulseV, eloRating]);

  return (
    <View style={styles.root}>
      <AuthBackdrop style={styles.backdrop} rockBurstFx={rockBurstFx} treeMode />
      {!bld && (
        <View style={[styles.bar, { paddingTop: insets.top + 10 }]}>
          <View style={styles.barContent}>
            <View style={styles.barLeftCol}>
              <TouchableOpacity style={[styles.barIconBtn, styles.profileBtn]} onPress={() => onNavigate?.('Profile')} activeOpacity={0.76}>
                <Ionicons name="person-outline" size={22} color="#BFE2FF" />
              </TouchableOpacity>
              {!!onSignOut && (
                <TouchableOpacity style={[styles.barIconBtn, styles.signOutBarBtn]} onPress={onSignOut} activeOpacity={0.76}>
                  <Ionicons name="log-out-outline" size={17} color="#FCA5A5" />
                </TouchableOpacity>
              )}
            </View>
            <View pointerEvents="none" style={styles.barCenterSlot}>
              <Animated.View style={[styles.eloWrap, { transform: [{ scale: eloPulseScale }] }]}>
                <Animated.View style={[styles.eloBackdropGlow, { opacity: eloGlowOpacity }]} />
                <View style={styles.eloAccent} />
                <View style={styles.eloIconShell}>
                  <View style={styles.eloIconWrap}>
                    <Ionicons name="trophy-outline" size={18} color="#FFD36B" />
                  </View>
                </View>
                <View style={styles.eloDivider} />
                <View style={styles.eloTextWrap}>
                  <Text style={styles.eloLabel}>RANKED ELO</Text>
                  <View style={styles.eloValueRow}>
                    <Text style={styles.eloText}>{displayEloRating}</Text>
                    <View style={styles.eloMetaPill}>
                      <Text style={styles.eloMetaText}>LIVE</Text>
                    </View>
                  </View>
                  <View style={styles.eloProgressRow}>
                    <View style={styles.eloProgressTrack}>
                      <View style={[styles.eloProgressFill, { width: `${treeStats.completionPct}%` }]} />
                    </View>
                    <Text style={styles.eloProgressLabel}>{treeStats.unlocked}/{treeStats.total}</Text>
                  </View>
                  {!!eloGainValue && (
                    <Animated.View
                      style={[
                        styles.eloGainFx,
                        {
                          opacity: eloGainOpacityV,
                          transform: [{ translateY: eloGainTranslateY }, { scale: eloGainScale }],
                        },
                      ]}
                    >
                      <Text style={styles.eloGainText}>+{eloGainValue}</Text>
                    </Animated.View>
                  )}
                </View>
              </Animated.View>
            </View>
            <View style={styles.barActionCluster}>
              <TouchableOpacity style={[styles.barIconBtn, styles.settingsBtn, styles.stackedBtn]} onPress={() => onNavigate?.('Settings')} activeOpacity={0.76}>
                <Ionicons name="settings-outline" size={19} color="#FFE8A6" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.barIconBtn, styles.friendsBtn, styles.stackedBtn]} onPress={() => onNavigate?.('Friends')} activeOpacity={0.76}>
                <Ionicons name="people-outline" size={19} color="#B9F8D0" />
                <View style={styles.friendsBadge}>
                  <Ionicons name="sparkles" size={8} color="#07110D" />
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.barIconBtn, styles.chatBtn, styles.stackedBtn]} onPress={() => onNavigate?.('Chat')} activeOpacity={0.76}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#E9D5FF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {bld && (
        <View style={[styles.toolbar, { paddingTop: insets.top + 8 }]}>
          <View style={styles.editorCard}>
            <View style={styles.editorHeaderRow}>
              <View style={styles.editorTitleWrap}>
                <Text style={styles.editorEyebrow}>TREE BUILDER</Text>
                <Text style={styles.editorTitle}>Edit Mode</Text>
              </View>
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => { setBld(false); setConnA(null); dId.current = null; }}
                activeOpacity={0.78}
              >
                <Ionicons name="checkmark" size={16} color="#D9F1FF" />
                <Text style={styles.doneBtnT}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.editorMetaRow}>
              <View style={styles.activeTreeChip}>
                <Ionicons name="git-network-outline" size={14} color="#9BD8FF" />
                <Text style={styles.activeTreeChipT}>{activeTreeName}</Text>
              </View>

              <View style={styles.historyBtns}>
                <TouchableOpacity style={[styles.historyBtn, !canUndo && styles.dim]} onPress={undo} disabled={!canUndo}>
                  <Ionicons name="arrow-undo-outline" size={16} color="rgba(225,240,255,0.82)" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.historyBtn, !canRedo && styles.dim]} onPress={redo} disabled={!canRedo}>
                  <Ionicons name="arrow-redo-outline" size={16} color="rgba(225,240,255,0.82)" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.toolPills}>
              {builderTools.map(({ id, label, icon }) => {
                const selected = tool === id;
                return (
                  <TouchableOpacity
                    key={id}
                    style={[styles.toolPill, selected && styles.toolPillOn]}
                    onPress={() => { setTool(id); setConnA(null); }}
                    activeOpacity={0.76}
                  >
                    <Ionicons name={icon} size={15} color={selected ? 'rgba(210,235,255,0.98)' : 'rgba(255,255,255,0.48)'} />
                    <Text style={[styles.toolPillT, selected && styles.toolPillTOn]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.hintT}>{hints[tool]}</Text>

            <View style={styles.treeMgrRow}>
              <Text style={styles.treeMgrLabel}>Active Tree</Text>
              <Text style={styles.treeMgrValue}>{activeTreeName}</Text>
            </View>

            <View style={styles.treeMgrActions}>
              <TouchableOpacity style={[styles.mgBtn, styles.mgBtnPrimary]} onPress={saveCurrentTreeAs}><Text style={[styles.mgBtnT, styles.mgBtnPrimaryT]}>Save As</Text></TouchableOpacity>
              <TouchableOpacity style={styles.mgBtn} onPress={overwriteSelectedTree}><Text style={styles.mgBtnT}>Overwrite</Text></TouchableOpacity>
              <TouchableOpacity style={styles.mgBtn} onPress={() => setLibraryVisible(true)}><Text style={styles.mgBtnT}>Switch</Text></TouchableOpacity>
              <TouchableOpacity style={styles.mgBtn} onPress={loadDefaultTree}><Text style={styles.mgBtnT}>Default</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.mgBtn, styles.mgBtnDanger, !selectedTreeId && styles.dim]} onPress={deleteSelectedTree} disabled={!selectedTreeId}><Text style={[styles.mgBtnT, styles.mgBtnDangerT]}>Delete</Text></TouchableOpacity>
            </View>

            <View style={styles.ioRow}>
              <TouchableOpacity style={styles.ioBtn} onPress={exportTree}>
                <Ionicons name="share-outline" size={15} color="rgba(225,240,255,0.72)" />
                <Text style={styles.ioBtnT}>Export</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ioBtn} onPress={importTree}>
                <Ionicons name="download-outline" size={15} color="rgba(225,240,255,0.72)" />
                <Text style={styles.ioBtnT}>Import</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {false && bld && (
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
          collapsable={false}
          style={styles.canvas}
          onLayout={handleCanvasLayout}
          {...panR.panHandlers}
        >
          {!!canvasSize.width && !!canvasSize.height && (
            <View pointerEvents="none" style={styles.canvasRenderLayer}>
              <SkiaTreeCanvas
                nodes={tree.nodes}
                edges={tree.edges}
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
                unlockFx={unlockFx}
                unlockFxProgressV={unlockFxProgressV}
                rockBurstFx={rockBurstFx}
                rockBurstProgressV={rockBurstProgressV}
                selectedPathEdgeDepths={selectedPathState.edgeDepths}
                selectedPathEdgeCount={selectedPathState.edgeCount}
              />
            </View>
          )}
        </View>
      ) : (
        <GestureDetector gesture={navGesture}>
          <View
            ref={cRef}
            collapsable={false}
            style={styles.canvas}
            onLayout={handleCanvasLayout}
          >
            {!!canvasSize.width && !!canvasSize.height && (
              <View pointerEvents="none" style={styles.canvasRenderLayer}>
                <SkiaTreeCanvas
                  nodes={tree.nodes}
                  edges={tree.edges}
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
                  unlockFx={unlockFx}
                  unlockFxProgressV={unlockFxProgressV}
                  rockBurstFx={rockBurstFx}
                  rockBurstProgressV={rockBurstProgressV}
                  selectedPathEdgeDepths={selectedPathState.edgeDepths}
                  selectedPathEdgeCount={selectedPathState.edgeCount}
                  showParticles={(treePrefs?.showParticles ?? true) && xform.sc > 0.55}
                  highQuality={treePrefs?.highQuality ?? true}
                />
              </View>
            )}
          </View>
        </GestureDetector>
      )}

      <View style={styles.zoomBtns}>
        <TouchableOpacity style={styles.zoomBtn} onPress={() => handleZoom('in')} activeOpacity={0.7}>
          <Ionicons name="add" size={20} color="rgba(255,255,255,0.78)" />
        </TouchableOpacity>
        <View style={styles.zoomDivider} />
        <TouchableOpacity style={styles.zoomBtn} onPress={() => handleZoom('out')} activeOpacity={0.7}>
          <Ionicons name="remove" size={20} color="rgba(255,255,255,0.78)" />
        </TouchableOpacity>
        <View style={styles.zoomDivider} />
        <TouchableOpacity style={styles.zoomBtn} onPress={handleGoHome} activeOpacity={0.7}>
          <Ionicons name="locate-outline" size={18} color="rgba(255,255,255,0.78)" />
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

      <NodeEditorModal
        visible={nodeEditorVisible}
        node={editingNode}
        info={editingNode ? tree.info?.[editingNode.id] : null}
        onCancel={() => {
          setNodeEditorVisible(false);
          setEditingNodeId(null);
        }}
        onSave={handleSaveNodeEdits}
      />
      <NamePrompt visible={prompt} onConfirm={addNode} onCancel={() => showPrompt(false)} />
      {sel && !bld && (
        <SkillCard
          node={sel}
          nodes={tree.nodes}
          edges={tree.edges}
          info={tree.info?.[sel.id]}
          videoRecord={skillVideos?.[sel.id] || null}
          pendingUnlock={pendingUnlockNodeId === sel.id}
          disableBackdropClose={pendingUnlockNodeId === sel.id}
          onClose={handleSkillCardClose}
          onAttempt={handleStartSkillAttempt}
          onSelectPrereq={(prereqNode) => setSel({ ...prereqNode })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  backdrop: { ...StyleSheet.absoluteFillObject },
  zoomBtns: {
    position: 'absolute',
    right: 16,
    bottom: 40,
    zIndex: 50,
    backgroundColor: 'rgba(8,10,18,0.88)',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },
  zoomBtn: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingBottom: 4,
  },
  barContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 52,
    gap: 12,
    position: 'relative',
  },
  barCenterSlot: {
    position: 'absolute',
    left: 54,
    right: 60,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barActionCluster: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 5,
  },
  stackedBtn: {
    width: 45,
    height: 45,
    borderRadius: 22,
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
    backgroundColor: 'rgba(8,12,22,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  profileBtn: {
    backgroundColor: 'rgba(14,34,56,0.86)',
    borderColor: 'rgba(125,211,252,0.22)',
    shadowColor: '#7DD3FC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  barLeftCol: {
    alignItems: 'center',
    gap: 6,
  },
  signOutBarBtn: {
    backgroundColor: 'rgba(84,20,26,0.86)',
    borderColor: 'rgba(248,113,113,0.22)',
    shadowColor: '#FCA5A5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  friendsBtn: {
    position: 'relative',
    overflow: 'visible',
    backgroundColor: 'rgba(6,18,14,0.94)',
    borderColor: 'rgba(134,239,172,0.28)',
    shadowColor: '#86EFAC',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
  },
  chatBtn: {
    backgroundColor: 'rgba(40,8,80,0.88)',
    borderColor: 'rgba(168,85,247,0.3)',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  settingsBtn: {
    backgroundColor: 'rgba(58,42,10,0.86)',
    borderColor: 'rgba(253,230,138,0.22)',
    shadowColor: '#FFD84A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 9,
    elevation: 3,
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
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    backgroundColor: 'rgba(5,7,11,0.94)',
    paddingLeft: 8,
    paddingRight: 15,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,211,107,0.16)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 8,
  },
  eloBackdropGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,211,107,0.05)',
  },
  eloAccent: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 0,
    height: 2,
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
    backgroundColor: 'rgba(255,224,142,0.3)',
  },
  eloIconShell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  eloIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(94,67,18,0.56)',
    borderWidth: 1,
    borderColor: 'rgba(255,211,107,0.24)',
  },
  eloDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  eloTextWrap: {
    position: 'relative',
    gap: 3,
  },
  eloLabel: {
    color: 'rgba(255,236,196,0.54)',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.7,
  },
  eloValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eloText: {
    color: '#FFF0BF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  eloMetaPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,211,107,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,211,107,0.18)',
  },
  eloMetaText: {
    color: 'rgba(255,232,170,0.88)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  eloProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  eloProgressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    minWidth: 40,
    maxWidth: 60,
  },
  eloProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,211,107,0.52)',
  },
  eloProgressLabel: {
    color: 'rgba(255,236,196,0.46)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  eloGainFx: {
    position: 'absolute',
    right: 0,
    top: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(125,211,252,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.18)',
  },
  eloGainText: {
    color: '#D9F1FF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  friendsBadge: {
    position: 'absolute',
    top: -3,
    right: -2,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B9F8D0',
    borderWidth: 1,
    borderColor: 'rgba(6,18,14,0.9)',
    shadowColor: '#86EFAC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 6,
    elevation: 3,
  },
  doneBtn: {
    minHeight: 42,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: 'rgba(12,56,82,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 1,
  },
  doneBtnT: {
    color: '#D9F1FF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  toolbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 35,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  editorCard: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 640,
    backgroundColor: 'rgba(7,11,19,0.88)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.14)',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 10,
  },
  editorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  editorTitleWrap: {
    flex: 1,
    gap: 4,
  },
  editorEyebrow: {
    color: 'rgba(191,226,255,0.56)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  editorTitle: {
    color: '#F8FBFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  editorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  activeTreeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: 'rgba(125,211,252,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.14)',
    flexShrink: 1,
  },
  activeTreeChipT: {
    color: '#DDF3FF',
    fontSize: 12,
    fontWeight: '700',
  },
  historyBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyBtn: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  toolPills: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    padding: 4,
    gap: 4,
    flexWrap: 'wrap',
  },
  toolPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolPillOn: {
    backgroundColor: 'rgba(14,60,88,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.16)',
  },
  toolPillT: {
    color: 'rgba(255,255,255,0.54)',
    fontSize: 13,
    fontWeight: '700',
  },
  toolPillTOn: { color: 'rgba(180,215,255,0.95)' },
  toolDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 4,
  },
  hintT: {
    color: 'rgba(215,236,255,0.46)',
    fontSize: 12,
    lineHeight: 18,
  },
  treeMgrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
    gap: 12,
  },
  treeMgrLabel: {
    color: 'rgba(191,226,255,0.46)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  treeMgrValue: {
    flex: 1,
    color: '#F8FBFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  treeMgrActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  mgBtn: {
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  mgBtnPrimary: {
    backgroundColor: 'rgba(14,60,88,0.88)',
    borderColor: 'rgba(125,211,252,0.16)',
  },
  mgBtnDanger: {
    backgroundColor: 'rgba(76,18,28,0.72)',
    borderColor: 'rgba(248,113,113,0.14)',
  },
  mgBtnT: {
    color: 'rgba(235,244,255,0.72)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  mgBtnPrimaryT: { color: '#D9F1FF' },
  mgBtnDangerT: { color: '#FFD6D6' },
  dim: { opacity: 0.25 },
  ioRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ioBtn: {
    flex: 1,
    minHeight: 42,
    paddingVertical: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  ioBtnT: {
    color: 'rgba(225,240,255,0.68)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
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
  canvas: { flex: 1, backgroundColor: 'transparent', overflow: 'hidden' },
  canvasRenderLayer: {
    width: '100%',
    height: '100%',
  },
  legend: {
    flexDirection: 'row', justifyContent: 'center', gap: 28, paddingVertical: 12,
    backgroundColor: '#060A10', borderTopWidth: 1, borderColor: Colors.border.default,
  },
  lr: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  lt: { color: Colors.text.secondary, fontSize: 11, letterSpacing: 1 },
});
