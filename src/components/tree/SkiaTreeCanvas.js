import React, {
  useMemo, useRef,
} from 'react';
import {
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Path,
  Text as SkiaText,
  matchFont,
  useClock,
} from '@shopify/react-native-skia';
import { useDerivedValue, withTiming } from 'react-native-reanimated';
import { BRANCH_COLORS } from '../../theme/colors';
import { NODE_R, USE_GLOW } from '../../constants/tree';
import { resolveBranch, resolveEdgeBranch, toRGBA } from '../../utils/treeUtils';
import { buildEdgePath, mulberry32, pointOnQuadraticEdge } from '../../utils/skiaTreeUtils';
 
const TAU = Math.PI * 2;
const FOCUS_PULSE_MIN_SCALE = 0.92;
const FOCUS_PULSE_MAX_VISIBLE_NODES = 8;
const FOCUS_PULSE_CYCLE_MS = 3800;
const FOCUS_PULSE_DRIFT_MS = 1420;
const STAR_NODE_CULL_RADIUS_SQ = (NODE_R * 0.18) ** 2;
const MAX_SELECTED_PATH_EDGES_VISIBLE = 20;

function clamp01(value) {
  'worklet';
  return Math.max(0, Math.min(1, value));
}

function lerp(from, to, t) {
  'worklet';
  return from + ((to - from) * t);
}

function easeOutCubic(t) {
  'worklet';
  return 1 - ((1 - t) ** 3);
}

function easeOutQuad(t) {
  'worklet';
  return 1 - ((1 - t) ** 2);
}

function easeInOutSine(t) {
  'worklet';
  return 0.5 - (Math.cos(Math.PI * clamp01(t)) * 0.5);
}

function softWave01(ms, primaryMs, secondaryMs, primaryPhase = 0, secondaryPhase = 0, primaryAmp = 0.22, secondaryAmp = 0.11) {
  'worklet';
  return clamp01(
    0.5
      + (Math.sin((ms / primaryMs) + primaryPhase) * primaryAmp)
      + (Math.cos((ms / secondaryMs) + secondaryPhase) * secondaryAmp),
  );
}

function loop01(ms, cycleMs, phase = 0) {
  'worklet';
  const raw = (ms / cycleMs) + phase;
  return raw - Math.floor(raw);
}

function pulse01(ms, cycleMs, phase = 0) {
  'worklet';
  return 0.5 - (Math.cos(((ms / cycleMs) + phase) * TAU) * 0.5);
}

function layeredWave(ms, primaryMs, secondaryMs, primaryPhase, secondaryPhase, primaryAmp, secondaryAmp) {
  'worklet';
  return (Math.sin((ms / primaryMs) + primaryPhase) * primaryAmp)
    + (Math.cos((ms / secondaryMs) + secondaryPhase) * secondaryAmp);
}

function buildLayerTransform(tx, ty, sc, travel, zoomStrength, driftX = 0, driftY = 0) {
  'worklet';
  return [
    { translateX: (tx * travel) + driftX },
    { translateY: (ty * travel) + driftY },
    { scale: 1 + ((sc - 1) * zoomStrength) },
  ];
}

function particleSeed(id = '') {
  let seed = 2166136261;

  for (let i = 0; i < id.length; i += 1) {
    seed ^= id.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }

  return seed >>> 0;
}

const EdgeMotionOverlay = React.memo(function EdgeMotionOverlay({
  id,
  path,
  branchColor,
  width,
  status,
  pulseClock,
  showAmbient,
  selectedDepth,
}) {
  const phase = useMemo(() => {
    const rand = mulberry32(particleSeed(`edge_motion:${id}`));
    return rand();
  }, [id]);
  const selectedPhase = useMemo(() => (
    selectedDepth === null || selectedDepth === undefined
      ? 0
      : Math.min(selectedDepth, 6) * 0.13
  ), [selectedDepth]);
  const ambientHead = useDerivedValue(() => {
    if (!showAmbient || (status !== 'mastered' && status !== 'ready')) {
      return 0;
    }

    return loop01(pulseClock.value, status === 'mastered' ? 5200 : 4200, phase);
  }, [phase, showAmbient, status]);
  const ambientTail = useDerivedValue(() => {
    if (!showAmbient || (status !== 'mastered' && status !== 'ready')) {
      return 0;
    }

    return Math.max(0, ambientHead.value - (status === 'mastered' ? 0.18 : 0.14));
  }, [showAmbient, status]);
  const ambientOpacity = useDerivedValue(() => {
    if (!showAmbient) {
      return 0;
    }

    if (status === 'mastered') {
      return 0.12 + (pulse01(pulseClock.value, 6100, phase) * 0.08);
    }

    if (status === 'ready') {
      const cycle = loop01(pulseClock.value, 4200, phase);
      const fadeIn = easeOutCubic(clamp01((cycle - 0.08) / 0.2));
      const fadeOut = 1 - clamp01((cycle - 0.42) / 0.22);
      return fadeIn * fadeOut * 0.28;
    }

    return 0;
  }, [phase, showAmbient, status]);
  const selectedOpacity = useDerivedValue(() => {
    if (selectedDepth === null || selectedDepth === undefined) {
      return 0;
    }

    const cycle = loop01(pulseClock.value, 2600, 0.12 + selectedPhase);
    const fadeIn = easeOutCubic(clamp01(cycle / 0.16));
    const fadeOut = 1 - clamp01((cycle - 0.34) / 0.2);
    return fadeIn * fadeOut * 0.34;
  }, [selectedDepth, selectedPhase]);

  if ((!showAmbient || (status !== 'mastered' && status !== 'ready'))
    && (selectedDepth === null || selectedDepth === undefined)) {
    return null;
  }

  return (
    <Group>
      {showAmbient && status === 'mastered' && (
        <>
          <Path
            path={path}
            style="stroke"
            strokeWidth={width + 3.8}
            color={branchColor.glow}
            strokeCap="round"
            start={ambientTail}
            end={ambientHead}
            opacity={ambientOpacity}
          />
          <Path
            path={path}
            style="stroke"
            strokeWidth={width + 1.4}
            color={toRGBA(branchColor.ring, 0.9)}
            strokeCap="round"
            start={ambientTail}
            end={ambientHead}
            opacity={ambientOpacity}
          />
        </>
      )}

      {showAmbient && status === 'ready' && (
        <>
          <Path
            path={path}
            style="stroke"
            strokeWidth={width + 2.2}
            color={toRGBA(branchColor.main, 0.34)}
            strokeCap="round"
            start={ambientTail}
            end={ambientHead}
            opacity={ambientOpacity}
          />
          <Path
            path={path}
            style="stroke"
            strokeWidth={width + 0.76}
            color={toRGBA(branchColor.ring, 0.96)}
            strokeCap="round"
            start={ambientTail}
            end={ambientHead}
            opacity={ambientOpacity}
          />
        </>
      )}

      {selectedDepth !== null && selectedDepth !== undefined && (
        <>
          <Path
            path={path}
            style="stroke"
            strokeWidth={width + 4.2}
            color={toRGBA(branchColor.glow || branchColor.main, 0.26)}
            strokeCap="round"
            opacity={selectedOpacity}
          />
          <Path
            path={path}
            style="stroke"
            strokeWidth={width + 1.05}
            color={toRGBA(branchColor.main, 0.9)}
            strokeCap="round"
            opacity={selectedOpacity}
          />
        </>
      )}
    </Group>
  );
});

const SkiaTreeCanvas = React.memo(function SkiaTreeCanvas({
  nodes,
  visibleNodes,
  visibleEdges,
  nodeStatusMap,
  wrappedLabels,
  txV,
  tyV,
  scV,
  dragId,
  dragXV,
  dragYV,
  LOD,
  edgeVisual,
  bld,
  connA,
  isInteracting,
  canvasSize,
  nodeStyles,
  visibleBounds,
  unlockFx,
  unlockFxProgressV,
  rockBurstFx,
  rockBurstProgressV,
  selectedPathEdgeDepths,
  selectedPathEdgeCount,
}) {
  const labelFont = useMemo(() => {
    try {
      return matchFont({ fontFamily: 'sans-serif', fontSize: 15, fontWeight: 'bold' });
    } catch {
      return matchFont({ fontSize: 15 });
    }
  }, []);
  const pulseClock = useClock();
  const preserveInteractionLighting = false;

  const sceneTransform = useDerivedValue(() => ([
    { translateX: txV.value },
    { translateY: tyV.value },
    { scale: scV.value },
  ]), []);
  const backgroundMotionMix = useDerivedValue(() => (
    withTiming(isInteracting && !preserveInteractionLighting ? 0.82 : 1, {
      duration: isInteracting && !preserveInteractionLighting ? 240 : 760,
    })
  ), [isInteracting, preserveInteractionLighting]);
  const sceneFadeMix = useDerivedValue(() => (
    withTiming(isInteracting && !preserveInteractionLighting ? 0.97 : 1, {
      duration: isInteracting && !preserveInteractionLighting ? 200 : 620,
    })
  ), [isInteracting, preserveInteractionLighting]);
  const farLayerOpacity = useDerivedValue(() => (
    (0.94 + (softWave01(pulseClock.value, 11800, 6400, 0.1, 0.48, 0.08, 0.04) * 0.04 * backgroundMotionMix.value)) * sceneFadeMix.value
  ), []);
  const midLayerOpacity = useDerivedValue(() => (
    (0.95 + (softWave01(pulseClock.value, 9400, 5600, 0.32, 0.74, 0.08, 0.04) * 0.04 * backgroundMotionMix.value)) * sceneFadeMix.value
  ), []);
  const farSpaceTransform = useDerivedValue(() => {
    const driftMix = backgroundMotionMix.value;
    const driftX = layeredWave(pulseClock.value, 24000, 11800, 0.18, 0.62, 13, 4.4) * driftMix;
    const driftY = layeredWave(pulseClock.value, 28000, 15600, 0.92, 0.24, 10, 3.2) * driftMix;
    return buildLayerTransform(txV.value, tyV.value, scV.value, 0.16, 0.1, driftX, driftY);
  }, []);
  const midSpaceTransform = useDerivedValue(() => {
    const driftMix = backgroundMotionMix.value;
    const driftX = layeredWave(pulseClock.value, 17000, 9200, 0.8, 0.22, 9.5, 3.6) * driftMix;
    const driftY = layeredWave(pulseClock.value, 19800, 11400, 0.46, 0.94, 7.2, 2.8) * driftMix;
    return buildLayerTransform(txV.value, tyV.value, scV.value, 0.34, 0.22, driftX, driftY);
  }, []);
  const labelRevealT = useDerivedValue(() => (
    easeInOutSine(clamp01((scV.value - 0.22) / 0.38))
  ), []);
  const labelMainOpacity = useDerivedValue(() => (
    0.84 + (labelRevealT.value * 0.16)
  ), []);
  const labelGlowOpacity = useDerivedValue(() => (
    (0.28 + (labelRevealT.value * 0.14)) * sceneFadeMix.value
  ), []);

  const draggedTransform = useDerivedValue(() => ([
    { translateX: dragXV.value },
    { translateY: dragYV.value },
  ]), []);

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const starBounds = useMemo(() => {
    if (nodes.length === 0) return { cx: 0, cy: 0, w: 4000, h: 4000 };
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const n of nodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }

    const pad = 2000;
    return {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      w: Math.max(6000, maxX - minX + pad * 2),
      h: Math.max(6000, maxY - minY + pad * 2),
    };
  }, [nodes]);

  const spaceStars = useMemo(() => {
    const { cx, cy, w: worldWidth, h: worldHeight } = starBounds;
    const rand = mulberry32(1337);
    const stars = [];
    const dustColors = ['#ffffff', '#fbfdff', '#f4f8ff', '#edf4ff', '#fff5e8', '#f0f4ff'];
    const starColors = ['#ffffff', '#f8fbff', '#eef5ff', '#fff4df', '#eefdf7', '#f7efff', '#ffeceb', '#fdf8ff'];
    const accentColors = ['#b9d8ff', '#d8c2ff', '#ffc8b8', '#bfffe0', '#ffe4a8', '#c7f1ff', '#a8c8ff', '#ffb8d8'];
    const warmColors = ['#ffd4a8', '#ffcbb8', '#ffe8c4', '#fff0d8'];
    const coolColors = ['#a8d4ff', '#b8e0ff', '#c4e8ff', '#d0f0ff'];

    // Layer 1: Dense background dust field
    for (let i = 0; i < 1100; i++) {
      stars.push({
        x: cx + (rand() - 0.5) * worldWidth,
        y: cy + (rand() - 0.5) * worldHeight,
        r: 0.6 + rand() * 0.7,
        color: dustColors[Math.floor(rand() * dustColors.length)],
        opacity: 0.15 + rand() * 0.18,
      });
    }

    // Layer 2: Visible small stars — always present
    for (let i = 0; i < 540; i++) {
      const isWarm = rand() < 0.15;
      const isCool = !isWarm && rand() < 0.12;
      const color = isWarm
        ? warmColors[Math.floor(rand() * warmColors.length)]
        : isCool
          ? coolColors[Math.floor(rand() * coolColors.length)]
          : starColors[Math.floor(rand() * starColors.length)];
      stars.push({
        x: cx + (rand() - 0.5) * worldWidth,
        y: cy + (rand() - 0.5) * worldHeight,
        r: 1.1 + rand() * 1.0,
        color,
        opacity: 0.28 + rand() * 0.22,
        glowRadius: 2.8 + rand() * 2.2,
        glowOpacity: 0.04 + rand() * 0.04,
      });
    }

    // Layer 3: Medium bright stars with halos
    for (let i = 0; i < 160; i++) {
      stars.push({
        x: cx + (rand() - 0.5) * worldWidth,
        y: cy + (rand() - 0.5) * worldHeight,
        r: 1.6 + rand() * 1.2,
        color: rand() < 0.65
          ? starColors[Math.floor(rand() * starColors.length)]
          : accentColors[Math.floor(rand() * accentColors.length)],
        opacity: 0.38 + rand() * 0.22,
        glowRadius: 5.0 + rand() * 4.0,
        glowOpacity: 0.06 + rand() * 0.06,
      });
    }

    // Layer 4: Bright feature stars — galaxy landmarks
    for (let i = 0; i < 44; i++) {
      const color = rand() < 0.45
        ? accentColors[Math.floor(rand() * accentColors.length)]
        : starColors[Math.floor(rand() * starColors.length)];
      stars.push({
        x: cx + (rand() - 0.5) * worldWidth,
        y: cy + (rand() - 0.5) * worldHeight,
        r: 2.2 + rand() * 1.6,
        color,
        opacity: 0.4 + rand() * 0.25,
        glowRadius: 8.0 + rand() * 6.0,
        glowOpacity: 0.05 + rand() * 0.06,
      });
    }

    // Layer 5: Brilliant beacon stars with big soft halos
    for (let i = 0; i < 12; i++) {
      const color = accentColors[Math.floor(rand() * accentColors.length)];
      stars.push({
        x: cx + (rand() - 0.5) * worldWidth,
        y: cy + (rand() - 0.5) * worldHeight,
        r: 2.8 + rand() * 1.8,
        color,
        opacity: 0.38 + rand() * 0.2,
        glowRadius: 12.0 + rand() * 8.0,
        glowOpacity: 0.04 + rand() * 0.05,
      });
    }

    return stars;
  }, [starBounds]);
  const rockBurstMeta = useMemo(() => {
    if (!rockBurstFx?.id) {
      return null;
    }

    const rand = mulberry32(particleSeed(rockBurstFx.id));
    const particles = [];

    for (let i = 0; i < 9; i += 1) {
      particles.push({
        angle: rand() * TAU,
        distance: 20 + (rand() * 26),
        radius: 1.8 + (rand() * 2.8),
        color: i % 3 === 0 ? '#F8FBFF' : i % 2 === 0 ? '#C4E8FF' : '#93C5FD',
      });
    }

    return {
      ...rockBurstFx,
      particles,
    };
  }, [rockBurstFx]);
  const rockBurstProgress = useDerivedValue(() => (
    rockBurstMeta ? clamp01(rockBurstProgressV?.value ?? 1) : 1
  ), [rockBurstMeta, rockBurstProgressV]);
  const rockBurstOuterRadius = useDerivedValue(() => (
    rockBurstMeta ? lerp(8, 42, easeOutCubic(rockBurstProgress.value)) : 0
  ), [rockBurstMeta]);
  const rockBurstOuterOpacity = useDerivedValue(() => (
    rockBurstMeta ? 0.34 * (1 - easeOutQuad(rockBurstProgress.value)) : 0
  ), [rockBurstMeta]);
  const rockBurstCoreRadius = useDerivedValue(() => (
    rockBurstMeta ? lerp(6, 18, easeOutCubic(clamp01(rockBurstProgress.value / 0.36))) : 0
  ), [rockBurstMeta]);
  const rockBurstCoreOpacity = useDerivedValue(() => {
    if (!rockBurstMeta) return 0;
    const burst = clamp01(rockBurstProgress.value / 0.4);
    return 0.28 * (1 - easeOutQuad(burst));
  }, [rockBurstMeta]);
  const rockBurstParticleOpacity = useDerivedValue(() => {
    if (!rockBurstMeta) return 0;
    return 0.92 * (1 - clamp01((rockBurstProgress.value - 0.06) / 0.72));
  }, [rockBurstMeta]);
  const rockBurstParticleScale = useDerivedValue(() => (
    rockBurstMeta ? lerp(0.4, 1.08, easeOutCubic(clamp01((rockBurstProgress.value - 0.02) / 0.68))) : 1
  ), [rockBurstMeta]);
  const rockBurstParticleTransform = useDerivedValue(() => {
    if (!rockBurstMeta) {
      return [{ scale: 1 }];
    }

    return [
      { translateX: rockBurstMeta.x },
      { translateY: rockBurstMeta.y },
      { scale: rockBurstParticleScale.value },
      { translateX: -rockBurstMeta.x },
      { translateY: -rockBurstMeta.y },
    ];
  }, [rockBurstMeta]);

  const glowFieldSources = useMemo(() => {
    const mastered = [];
    const ready = [];
    const bright = [];

    for (const node of visibleNodes) {
      const status = nodeStatusMap[node.id];
      if (status === 'start' || status === 'mastered') {
        const point = { node, status };
        mastered.push(point);
        bright.push(point);
      } else if (status === 'ready') {
        const point = { node, status };
        ready.push(point);
      }
    }

    return { mastered, ready, bright };
  }, [nodeStatusMap, visibleNodes]);
  const focusedPulseCandidate = !bld
    && !isInteracting
    && LOD.isNear
    && glowFieldSources.bright.length > 0
    && glowFieldSources.bright.length <= FOCUS_PULSE_MAX_VISIBLE_NODES;
  const focusedPulseStrength = useDerivedValue(() => {
    if (!focusedPulseCandidate || scV.value < FOCUS_PULSE_MIN_SCALE) return 0;

    const cycle = (pulseClock.value % FOCUS_PULSE_CYCLE_MS) / FOCUS_PULSE_CYCLE_MS;
    const drift = (pulseClock.value % FOCUS_PULSE_DRIFT_MS) / FOCUS_PULSE_DRIFT_MS;
    const primary = 0.5 - (Math.cos(cycle * TAU) * 0.5);
    const secondary = 0.5 - (Math.cos((drift * TAU) + 0.72) * 0.5);
    return (primary * 0.82) + (secondary * 0.18);
  }, [focusedPulseCandidate]);
  const focusedPulseNodeGlowOpacity = useDerivedValue(() => {
    if (!focusedPulseCandidate || scV.value < FOCUS_PULSE_MIN_SCALE) return 1;
    return 0.24 + (focusedPulseStrength.value * 0.76);
  }, [focusedPulseCandidate]);
  const focusedPulseNodeRingOpacity = useDerivedValue(() => {
    if (!focusedPulseCandidate || scV.value < FOCUS_PULSE_MIN_SCALE) return 1;
    return 0.46 + (focusedPulseStrength.value * 0.54);
  }, [focusedPulseCandidate]);
  const focusedPulseNodeStrokeOpacity = useDerivedValue(() => {
    if (!focusedPulseCandidate || scV.value < FOCUS_PULSE_MIN_SCALE) return 1;
    return 0.76 + (focusedPulseStrength.value * 0.24);
  }, [focusedPulseCandidate]);
  const focusedPulseNodeCoreOpacity = useDerivedValue(() => {
    if (!focusedPulseCandidate || scV.value < FOCUS_PULSE_MIN_SCALE) return 0;
    return 0.05 + (focusedPulseStrength.value * 0.22);
  }, [focusedPulseCandidate]);
  const focusedPulseNodeBloomOpacity = useDerivedValue(() => {
    if (!focusedPulseCandidate || scV.value < FOCUS_PULSE_MIN_SCALE) return 0;
    return 0.04 + (focusedPulseStrength.value * 0.18);
  }, [focusedPulseCandidate]);
  const focusedPulseHaloBloomOpacity = useDerivedValue(() => {
    if (!focusedPulseCandidate || scV.value < FOCUS_PULSE_MIN_SCALE) return 0;
    return 0.06 + (focusedPulseStrength.value * 0.16);
  }, [focusedPulseCandidate]);
  const focusedPulseEdgeGlowOpacity = useDerivedValue(() => {
    if (!focusedPulseCandidate || scV.value < FOCUS_PULSE_MIN_SCALE) return 1;
    return 0.28 + (focusedPulseStrength.value * 0.72);
  }, [focusedPulseCandidate]);
  const focusedPulseEdgeMainOpacity = useDerivedValue(() => {
    if (!focusedPulseCandidate || scV.value < FOCUS_PULSE_MIN_SCALE) return 1;
    return 0.84 + (focusedPulseStrength.value * 0.16);
  }, [focusedPulseCandidate]);
  const nodeLifeMix = useDerivedValue(() => (
    withTiming(isInteracting && !preserveInteractionLighting ? 0.94 : 1, {
      duration: isInteracting && !preserveInteractionLighting ? 220 : 680,
    })
  ), [isInteracting, preserveInteractionLighting]);
  const litNodeBreathBase = useDerivedValue(() => (
    softWave01(pulseClock.value, 6200, 3400, 0.12, 0.64, 0.24, 0.1)
  ), []);
  const litNodeOuterAuraRadius = useDerivedValue(() => (
    lerp(NODE_R * 1.42, NODE_R * 1.62, litNodeBreathBase.value)
  ), []);
  const startNodeOuterAuraRadius = useDerivedValue(() => (
    lerp(NODE_R * 1.78, NODE_R * 1.98, litNodeBreathBase.value)
  ), []);
  const litNodeInnerAuraRadius = useDerivedValue(() => (
    lerp(NODE_R * 1.12, NODE_R * 1.24, litNodeBreathBase.value)
  ), []);
  const startNodeInnerAuraRadius = useDerivedValue(() => (
    lerp(NODE_R * 1.34, NODE_R * 1.5, litNodeBreathBase.value)
  ), []);
  const litNodeAuraOpacity = useDerivedValue(() => (
    (0.022 + (litNodeBreathBase.value * 0.04)) * nodeLifeMix.value
  ), []);
  const litNodeInnerAuraOpacity = useDerivedValue(() => (
    (0.03 + (litNodeBreathBase.value * 0.06)) * nodeLifeMix.value
  ), []);
  const litNodeCoreAliveRadius = useDerivedValue(() => (
    lerp(NODE_R * 0.2, NODE_R * 0.29, litNodeBreathBase.value)
  ), []);
  const litNodeCoreAliveOpacity = useDerivedValue(() => (
    (0.018 + (litNodeBreathBase.value * 0.05)) * nodeLifeMix.value
  ), []);
  const litNodeSpecularRadius = useDerivedValue(() => (
    lerp(NODE_R * 0.1, NODE_R * 0.16, litNodeBreathBase.value)
  ), []);
  const litNodeSpecularOpacity = useDerivedValue(() => (
    (0.05 + (pulse01(pulseClock.value, 3100, 0.46) * 0.08)) * nodeLifeMix.value
  ), []);
  const startArcAliveOpacity = useDerivedValue(() => (
    0.74 + (litNodeBreathBase.value * 0.26 * nodeLifeMix.value)
  ), []);
  const readyNodeSignalBase = useDerivedValue(() => (
    softWave01(pulseClock.value, 3600, 2200, 0.31, 0.96, 0.24, 0.1)
  ), []);
  const readyNodeAuraRadius = useDerivedValue(() => (
    lerp(NODE_R * 1.08, NODE_R * 1.24, readyNodeSignalBase.value)
  ), []);
  const readyNodeAuraOpacity = useDerivedValue(() => (
    (0.024 + (readyNodeSignalBase.value * 0.05)) * nodeLifeMix.value
  ), []);
  const readyNodeRingRadius = useDerivedValue(() => (
    lerp(NODE_R * 1.08, NODE_R * 1.54, readyNodeSignalBase.value)
  ), []);
  const readyNodeRingOpacity = useDerivedValue(() => (
    (0.18 - (readyNodeSignalBase.value * 0.11)) * nodeLifeMix.value
  ), []);
  const readyNodeCoreRadius = useDerivedValue(() => (
    lerp(NODE_R * 0.18, NODE_R * 0.26, readyNodeSignalBase.value)
  ), []);
  const readyNodeCoreOpacity = useDerivedValue(() => (
    (0.028 + (readyNodeSignalBase.value * 0.052)) * nodeLifeMix.value
  ), []);
  const lockedNodeShimmerBase = useDerivedValue(() => (
    softWave01(pulseClock.value, 11200, 6200, 0.26, 0.82, 0.18, 0.06)
  ), []);
  const lockedNodeAuraOpacity = useDerivedValue(() => (
    (0.008 + (lockedNodeShimmerBase.value * 0.014)) * nodeLifeMix.value
  ), []);
  const lockedNodeRingOpacity = useDerivedValue(() => (
    (0.06 + (lockedNodeShimmerBase.value * 0.07)) * nodeLifeMix.value
  ), []);
  const lockedNodeSpecularOpacity = useDerivedValue(() => (
    (0.02 + (lockedNodeShimmerBase.value * 0.05)) * nodeLifeMix.value
  ), []);
  const masteredNodePulseBase = useDerivedValue(() => (
    softWave01(pulseClock.value, 8400, 5200, 0.18, 0.76, 0.22, 0.08)
  ), []);
  const masteredNodeHaloRadius = useDerivedValue(() => (
    lerp(NODE_R * 1.48, NODE_R * 1.72, masteredNodePulseBase.value)
  ), []);
  const masteredNodeHaloOpacity = useDerivedValue(() => (
    (0.028 + (masteredNodePulseBase.value * 0.046)) * nodeLifeMix.value
  ), []);
  const masteredNodeRingRadius = useDerivedValue(() => (
    lerp(NODE_R * 1.14, NODE_R * 1.34, masteredNodePulseBase.value)
  ), []);
  const masteredNodeRingOpacity = useDerivedValue(() => (
    (0.11 + (masteredNodePulseBase.value * 0.1)) * nodeLifeMix.value
  ), []);
  const fallbackLitAuraOpacity = useDerivedValue(() => (
    (0.1 + (litNodeBreathBase.value * 0.1)) * sceneFadeMix.value
  ), []);
  const fallbackReadyAuraOpacity = useDerivedValue(() => (
    (0.085 + (readyNodeSignalBase.value * 0.09)) * sceneFadeMix.value
  ), []);
  const fallbackLockedAuraOpacity = useDerivedValue(() => (
    (0.045 + (lockedNodeShimmerBase.value * 0.055)) * sceneFadeMix.value
  ), []);
  const farLitAuraOpacity = useDerivedValue(() => (
    (0.26 + (litNodeBreathBase.value * 0.16)) * sceneFadeMix.value
  ), []);
  const farReadyAuraOpacity = useDerivedValue(() => (
    (0.21 + (readyNodeSignalBase.value * 0.15)) * sceneFadeMix.value
  ), []);
  const farLockedAuraOpacity = useDerivedValue(() => (
    (0.12 + (lockedNodeShimmerBase.value * 0.09)) * sceneFadeMix.value
  ), []);
  const interactionMasteredEdgeOpacity = useDerivedValue(() => (
    0.74 + (pulse01(pulseClock.value, 5200, 0.18) * 0.12)
  ), []);
  const interactionReadyEdgeOpacity = useDerivedValue(() => (
    0.46 + (pulse01(pulseClock.value, 3600, 0.42) * 0.16)
  ), []);
  const persistentMasteredEdgeGlowOpacity = useDerivedValue(() => (
    (0.18 + (pulse01(pulseClock.value, 5200, 0.18) * 0.08)) * sceneFadeMix.value
  ), []);
  const persistentReadyEdgeGlowOpacity = useDerivedValue(() => (
    (0.1 + (pulse01(pulseClock.value, 3600, 0.42) * 0.08)) * sceneFadeMix.value
  ), []);
  const persistentLockedEdgeGlowOpacity = useDerivedValue(() => (
    (0.05 + (lockedNodeShimmerBase.value * 0.05)) * sceneFadeMix.value
  ), []);
  const lockedEdgeFlickerOpacity = useDerivedValue(() => (
    0.74 + (softWave01(pulseClock.value, 3200, 1800, 0.22, 0.84, 0.2, 0.12) * 0.26)
  ), []);
  const lockedEdgeSparkOpacity = useDerivedValue(() => (
    0.04 + (pulse01(pulseClock.value, 2400, 0.38) * 0.08)
  ), []);

  const visibleStarLayers = useMemo(() => {
    const throttleInteractionVisuals = isInteracting && !preserveInteractionLighting;
    const layers = {
      farDust: [],
      farStars: [],
      midStars: [],
      accentStars: [],
      beacons: [],
    };
    const brightNodes = glowFieldSources.bright;
    const edgePressureScale = visibleEdges.length > 72
      ? 0.68
      : visibleEdges.length > 42
        ? 0.84
        : 1;
    const starDensityScale = (visibleNodes.length > 54
      ? (throttleInteractionVisuals ? 0.52 : 0.68)
      : visibleNodes.length > 34
        ? (throttleInteractionVisuals ? 0.66 : 0.82)
        : (throttleInteractionVisuals ? 0.84 : 1)) * edgePressureScale;
    const capLimit = (value) => Math.max(0, Math.round(value * starDensityScale));
    const limits = LOD.isFar
      ? {
        farDust: LOD.showDust ? capLimit(240) : 0,
        farStars: capLimit(180),
        midStars: capLimit(36),
        accentStars: 0,
        beacons: 0,
      }
      : LOD.isMid
        ? {
          farDust: LOD.showDust ? capLimit(throttleInteractionVisuals ? 240 : 320) : 0,
          farStars: capLimit(throttleInteractionVisuals ? 200 : 280),
          midStars: capLimit(throttleInteractionVisuals ? 44 : 64),
          accentStars: 0,
          beacons: 0,
        }
        : {
          farDust: LOD.showDust ? capLimit(throttleInteractionVisuals ? 280 : 420) : 0,
          farStars: capLimit(throttleInteractionVisuals ? 240 : 360),
          midStars: capLimit(throttleInteractionVisuals ? 52 : 84),
          accentStars: 0,
          beacons: 0,
        };
    const pad = LOD.isFar ? 220 : 320;
    const left = visibleBounds ? visibleBounds.left - pad : -Infinity;
    const right = visibleBounds ? visibleBounds.right + pad : Infinity;
    const top = visibleBounds ? visibleBounds.top - pad : -Infinity;
    const bottom = visibleBounds ? visibleBounds.bottom + pad : Infinity;

    const classifyStar = (star) => {
      if (!star.glowRadius && star.r < 1) return 'farDust';
      if (star.glowRadius >= 11 || star.r > 2.6) return 'beacons';
      if (star.glowRadius >= 7 || star.r > 2.05) return 'accentStars';
      if (star.glowRadius >= 4.6 || star.r > 1.45) return 'midStars';
      return 'farStars';
    };

    for (let i = 0; i < spaceStars.length; i += 1) {
      const star = spaceStars[i];
      const layerKey = classifyStar(star);

      if (layers[layerKey].length >= limits[layerKey]) {
        continue;
      }

      if (!(star.x >= left && star.x <= right && star.y >= top && star.y <= bottom)) {
        continue;
      }

      let occludedByNode = false;
      for (let j = 0; j < brightNodes.length; j += 1) {
        const { node } = brightNodes[j];
        const dx = node.x - star.x;
        const dy = node.y - star.y;
        if ((dx * dx) + (dy * dy) < STAR_NODE_CULL_RADIUS_SQ) {
          occludedByNode = true;
          break;
        }
      }

      if (!occludedByNode) {
        layers[layerKey].push(star);
      }
    }

    return layers;
  }, [LOD.isFar, LOD.isMid, LOD.showDust, glowFieldSources, isInteracting, preserveInteractionLighting, spaceStars, visibleBounds, visibleEdges.length, visibleNodes.length]);
  const starOpacityScale = LOD.isNear ? 0.88 : LOD.isMid ? 0.94 : 1;

  const unlockMeta = useMemo(() => {
    if (!unlockFx?.nodeId) {
      return null;
    }

    const targetNode = nodeMap.get(unlockFx.nodeId);
    if (!targetNode) {
      return null;
    }

    const branch = unlockFx.branch || resolveBranch(targetNode);
    const branchColor = BRANCH_COLORS[branch] || BRANCH_COLORS.neutral;
    const sourceNode = unlockFx.sourceId ? nodeMap.get(unlockFx.sourceId) || null : null;
    const rand = mulberry32(particleSeed(unlockFx.id || unlockFx.nodeId));
    const particles = [];

    for (let i = 0; i < 7; i += 1) {
      particles.push({
        angle: rand() * TAU,
        radius: 2 + rand() * 3.2,
        distance: NODE_R * (1.2 + rand() * 1.8),
        delay: rand() * 0.22,
      });
    }

    return {
      branchColor,
      sourceNode,
      targetNode,
      particles,
    };
  }, [nodeMap, unlockFx]);
  const unlockProgress = useDerivedValue(() => (
    unlockMeta ? clamp01(unlockFxProgressV?.value ?? 1) : 1
  ), [unlockMeta, unlockFxProgressV]);
  const sceneNudgeTransform = useDerivedValue(() => {
    if (!unlockMeta?.targetNode || isInteracting || !canvasSize.width || !canvasSize.height) {
      return [
        { translateX: 0 },
        { translateY: 0 },
      ];
    }

    const settle = Math.sin(clamp01(unlockProgress.value / 0.82) * Math.PI);
    const targetScreenX = (unlockMeta.targetNode.x * scV.value) + txV.value;
    const targetScreenY = (unlockMeta.targetNode.y * scV.value) + tyV.value;

    return [
      { translateX: ((canvasSize.width * 0.5) - targetScreenX) * 0.02 * settle },
      { translateY: ((canvasSize.height * 0.58) - targetScreenY) * 0.028 * settle },
    ];
  }, [canvasSize.height, canvasSize.width, isInteracting, unlockMeta]);

  // ── Edge data ──
  const edgePathCache = useRef(new Map());

  const edgeData = useMemo(() => visibleEdges.map((e, idx) => {
    const fromNode = nodeMap.get(e.from);
    const toNode = nodeMap.get(e.to);
    if (!fromNode || !toNode) return null;

    const fromState = nodeStatusMap[fromNode.id] || 'locked';
    const toState = nodeStatusMap[toNode.id] || 'locked';
    const fromLit = fromState === 'start' || fromState === 'mastered';
    const toLit = toState === 'start' || toState === 'mastered';
    const toReady = toState === 'ready';
    const status = bld
      ? 'locked'
      : (fromLit && toLit ? 'mastered' : ((fromLit && !toLit) || toReady ? 'ready' : 'locked'));

    const branch = resolveEdgeBranch(fromNode, toNode);
    const branchColor = BRANCH_COLORS[branch] || BRANCH_COLORS.neutral;

    return {
      id: `${e.from}_${e.to}_${idx}`,
      fromNode,
      toNode,
      status,
      branchColor,
      isUnlockTrail: !!unlockMeta
        && unlockMeta.sourceNode?.id === fromNode.id
        && unlockMeta.targetNode.id === toNode.id,
      useFocusedPulse: focusedPulseCandidate && status !== 'locked',
      selectedDepth: selectedPathEdgeDepths?.[`${fromNode.id}->${toNode.id}`] ?? null,
    };
  }).filter(Boolean), [bld, focusedPulseCandidate, nodeMap, nodeStatusMap, selectedPathEdgeDepths, unlockMeta, visibleEdges]);

  const edgeSegments = useMemo(() => {
    const cache = edgePathCache.current;
    const seen = new Set();

    const segments = edgeData.map(({
      id, fromNode, toNode, status, branchColor, isUnlockTrail, useFocusedPulse, selectedDepth,
    }) => {
      const key = `${fromNode.id}->${toNode.id}:${fromNode.x},${fromNode.y}|${toNode.x},${toNode.y}`;
      seen.add(key);
      let path = cache.get(key);
      if (!path) {
        path = buildEdgePath(fromNode, toNode);
        cache.set(key, path);
      }

      return {
        id,
        fromNode,
        toNode,
        path,
        status,
        branchColor,
        isUnlockTrail,
        useFocusedPulse,
        selectedDepth,
      };
    });

    for (const key of cache.keys()) {
      if (!seen.has(key)) cache.delete(key);
    }

    return segments;
  }, [edgeData]);

  const nodeRenderData = useMemo(() => visibleNodes.map((n) => {
    if (n.id === dragId) return null;
    const visual = nodeStyles[n.id];
    if (!visual) return null;

    const status = nodeStatusMap[n.id] || 'locked';
    const isStart = status === 'start';
    const isMastered = status === 'mastered';
    const isReady = status === 'ready';
    const isLocked = status === 'locked';
    const isLit = isStart || isMastered;

    return {
      n,
      visual,
      lines: wrappedLabels[n.id] || [n.name],
      isStart,
      isMastered,
      isReady,
      isLocked,
      isLit,
      useFocusedPulse: focusedPulseCandidate && isLit,
    };
  }).filter(Boolean), [dragId, focusedPulseCandidate, nodeStatusMap, nodeStyles, visibleNodes, wrappedLabels]);

  const labelMetrics = useMemo(() => {
    if (!labelFont) return {};
    const metrics = {};

    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      const lines = wrappedLabels[node.id] || [node.name];
      metrics[node.id] = lines.map((line) => labelFont.measureText(line).width);
    }

    return metrics;
  }, [labelFont, nodes, wrappedLabels]);

  const draggedNodeMeta = useMemo(() => {
    if (!dragId) return null;
    const n = nodes.find((nn) => nn.id === dragId);
    if (!n) return null;
    const visual = nodeStyles[dragId];
    if (!visual) return null;

    const status = nodeStatusMap[dragId] || 'locked';
    const isStart = status === 'start';
    const isMastered = status === 'mastered';
    const isReady = status === 'ready';
    const isLocked = status === 'locked';
    const isLit = isStart || isMastered;

    return {
      visual,
      lines: wrappedLabels[dragId] || [n.name],
      isStart,
      isMastered,
      isReady,
      isLocked,
      isLit,
      useFocusedPulse: focusedPulseCandidate && isLit,
    };
  }, [dragId, focusedPulseCandidate, nodeStatusMap, nodeStyles, nodes, wrappedLabels]);
  const useEnhancedLitNodeLife = !isInteracting && !LOD.isFar && visibleNodes.length <= (LOD.isNear ? 28 : 16);
  const useEnhancedReadyNodeLife = !isInteracting && !LOD.isFar && visibleNodes.length <= (LOD.isNear ? 30 : 18);
  const useEnhancedLockedNodeLife = !isInteracting && LOD.isNear && visibleNodes.length <= 22;
  const showAnimatedEdgeLife = !bld
    && LOD.interactionTier === 'idle'
    && LOD.isNear
    && visibleEdges.length <= 16
    && visibleNodes.length <= 18;
  const showSelectedPathLife = !bld
    && !LOD.isFar
    && selectedPathEdgeCount > 0
    && selectedPathEdgeCount <= MAX_SELECTED_PATH_EDGES_VISIBLE;
  const showBaseEdgeGlow = !bld
    && LOD.interactionTier === 'idle'
    && !LOD.isFar
    && visibleEdges.length <= (LOD.isNear ? 42 : 24);
  const simplifyNodeShells = !!LOD.simplifyScene;
  const simplifyEdgeRendering = !bld || !!LOD.simplifyScene;
  const showPersistentEdgeGlow = !bld && LOD.interactionTier === 'idle';
  const persistentEdgeGlowScale = useMemo(() => {
    if (edgeSegments.length > 180) return LOD.isFar ? 0.38 : 0.34;
    if (edgeSegments.length > 128) return LOD.isFar ? 0.48 : 0.46;
    if (edgeSegments.length > 92) return LOD.isFar ? 0.62 : 0.58;
    if (edgeSegments.length > 72) return LOD.isFar ? 0.78 : 0.72;
    return 1;
  }, [LOD.isFar, edgeSegments.length]);
  const persistentMasteredEdgeGlowOpacityScaled = useDerivedValue(() => (
    persistentMasteredEdgeGlowOpacity.value * persistentEdgeGlowScale
  ), [persistentEdgeGlowScale]);
  const persistentReadyEdgeGlowOpacityScaled = useDerivedValue(() => (
    persistentReadyEdgeGlowOpacity.value * persistentEdgeGlowScale
  ), [persistentEdgeGlowScale]);
  const persistentLockedEdgeGlowOpacityScaled = useDerivedValue(() => (
    persistentLockedEdgeGlowOpacity.value * Math.max(0.58, persistentEdgeGlowScale)
  ), [persistentEdgeGlowScale]);

  const farNodeR = NODE_R * 0.34;

  const renderNodeShell = (meta, x, y, isFarNode) => {
    const renderR = isFarNode ? farNodeR : meta.isStart ? NODE_R * 1.24 : NODE_R;
    const primaryRingR = isFarNode ? NODE_R * 0.3 : renderR - 1.5;
    const haloRingR = isFarNode ? NODE_R * 0.43 : renderR + (meta.isStart ? 22 : 12);
    const innerGlowR = isFarNode ? NODE_R * 0.38 : renderR * (meta.isStart ? 1.28 : 1.18);
    const outerGlowR = isFarNode ? NODE_R * 0.48 : renderR * (meta.isStart ? 1.52 : 1.36);
    const ambientR = isFarNode ? NODE_R * 0.54 : renderR * (meta.isStart ? 2.08 : 1.64);
    const cx = x;
    const cy = y;
    const glowOpacity = meta.useFocusedPulse ? focusedPulseNodeGlowOpacity : 1;
    const ringOpacity = meta.useFocusedPulse ? focusedPulseNodeRingOpacity : 1;
    const strokeOpacity = meta.useFocusedPulse ? focusedPulseNodeStrokeOpacity : 1;
    const coreGlowOpacity = meta.useFocusedPulse ? focusedPulseNodeCoreOpacity : 0;
    const bloomOpacity = meta.useFocusedPulse ? focusedPulseNodeBloomOpacity : 0;
    const haloBloomOpacity = meta.useFocusedPulse ? focusedPulseHaloBloomOpacity : 0;
    const idleOuterAuraRadius = meta.isStart ? startNodeOuterAuraRadius : litNodeOuterAuraRadius;
    const idleInnerAuraRadius = meta.isStart ? startNodeInnerAuraRadius : litNodeInnerAuraRadius;

    if (isFarNode) {
      const farR = meta.isStart ? NODE_R * 0.7 : NODE_R * 0.55;
      const farAmbientOpacity = meta.isLit
        ? farLitAuraOpacity
        : meta.isReady
          ? farReadyAuraOpacity
          : farLockedAuraOpacity;
      const farAmbientRadius = meta.isStart
        ? NODE_R * 1.98
        : meta.isLit
          ? NODE_R * 1.52
          : meta.isReady
            ? NODE_R * 1.26
            : NODE_R * 1.02;
      const farPulseRadius = meta.isStart
        ? NODE_R * 1.28
        : meta.isLit
          ? NODE_R * 1.02
          : meta.isReady
            ? NODE_R * 0.88
            : NODE_R * 0.74;

      return (
        <Group>
          <Circle
            cx={cx}
            cy={cy}
            r={farAmbientRadius}
            color={meta.visual.farAura || toRGBA(meta.visual.stroke, 0.18)}
            opacity={farAmbientOpacity}
          />
          <Circle
            cx={cx}
            cy={cy}
            r={farPulseRadius}
            color={meta.visual.farBody || toRGBA(meta.visual.stroke, 0.28)}
            opacity={farAmbientOpacity}
          />
          {meta.isLit && (
            <Circle cx={cx} cy={cy} r={NODE_R * (meta.isStart ? 1.8 : 1.4)} color={toRGBA(meta.visual.stroke, 0.06)} />
          )}
          {meta.isStart && (
            <>
              <Circle cx={cx - 4} cy={cy - 2} r={NODE_R * 1.1} color="rgba(52,225,122,0.04)" />
              <Circle cx={cx + 4} cy={cy - 2} r={NODE_R * 1.1} color="rgba(255,216,74,0.035)" />
              <Circle cx={cx} cy={cy + 3} r={NODE_R * 1.1} color="rgba(96,165,250,0.04)" />
            </>
          )}
          {meta.isLit && (
            <Circle cx={cx} cy={cy} r={NODE_R * (meta.isStart ? 1.1 : 0.9)} color={toRGBA(meta.visual.stroke, 0.1)} />
          )}
          {useEnhancedLitNodeLife && meta.isLit && !meta.useFocusedPulse && (
            <Circle
              cx={cx}
              cy={cy}
              r={meta.isStart ? NODE_R * 1.24 : NODE_R}
              color={toRGBA(meta.visual.stroke, 0.08)}
              opacity={litNodeAuraOpacity}
            />
          )}
          {useEnhancedReadyNodeLife && meta.isReady && (
            <Circle
              cx={cx}
              cy={cy}
              r={NODE_R * 0.86}
              color={toRGBA(meta.visual.stroke, 0.12)}
              opacity={readyNodeAuraOpacity}
            />
          )}
          <Circle cx={cx} cy={cy} r={farR} color={meta.visual.farAura || toRGBA(meta.visual.stroke, 0.18)} />
          <Circle cx={cx} cy={cy} r={farR * 0.65} color={meta.visual.farBody || toRGBA(meta.visual.stroke, 0.36)} />
          <Circle cx={cx} cy={cy} r={farR * 0.33} color={meta.visual.farCore || toRGBA(meta.visual.ring, 0.56)} />
          {useEnhancedReadyNodeLife && meta.isReady && (
            <Circle
              cx={cx}
              cy={cy}
              r={farR * 0.42}
              color={toRGBA(meta.visual.stroke, 0.2)}
              opacity={readyNodeCoreOpacity}
            />
          )}
          <Circle cx={cx} cy={cy} r={farR * 0.7} style="stroke" strokeWidth={meta.isStart ? 1.2 : 0.9} color={toRGBA(meta.visual.stroke, 0.52)} />
        </Group>
      );
    }

    if (simplifyNodeShells) {
      const simplifiedOuterAuraR = meta.isStart ? renderR * 1.74 : meta.isMastered ? renderR * 1.48 : renderR * 1.34;
      const simplifiedInnerAuraR = meta.isStart ? renderR * 1.36 : meta.isMastered ? renderR * 1.22 : renderR * 1.14;
      const simplifiedReadyAuraR = renderR * 1.2;
      const simplifiedMasteredHaloR = renderR * 1.26;
      const simplifiedRingOpacity = meta.useFocusedPulse ? ringOpacity : 0.94;
      const simplifiedStrokeOpacity = meta.useFocusedPulse ? strokeOpacity : 0.96;
      const simplifiedCoreOpacity = meta.useFocusedPulse ? 0.96 : 0.84;

      return (
        <Group>
          {meta.isLit && (
            <>
              <Circle
                cx={cx}
                cy={cy}
                r={simplifiedOuterAuraR}
                color={meta.visual.glowOuter || toRGBA(meta.visual.stroke, meta.isStart ? 0.14 : 0.12)}
                opacity={meta.useFocusedPulse ? glowOpacity : fallbackLitAuraOpacity}
              />
              <Circle
                cx={cx}
                cy={cy}
                r={simplifiedInnerAuraR}
                color={meta.visual.glowInner || toRGBA(meta.visual.ring, meta.isStart ? 0.22 : 0.18)}
                opacity={meta.useFocusedPulse ? glowOpacity : litNodeInnerAuraOpacity}
              />
            </>
          )}
          {meta.isReady && (
            <>
              <Circle
                cx={cx}
                cy={cy}
                r={simplifiedReadyAuraR}
                color={toRGBA(meta.visual.stroke, 0.16)}
                opacity={fallbackReadyAuraOpacity}
              />
              <Circle
                cx={cx}
                cy={cy}
                r={renderR * 1.02}
                style="stroke"
                strokeWidth={0.9}
                color={toRGBA(meta.visual.stroke, 0.7)}
                opacity={readyNodeRingOpacity}
              />
            </>
          )}
          {meta.isLocked && (
            <Circle
              cx={cx}
              cy={cy}
              r={renderR * 1.03}
              color={toRGBA(meta.visual.stroke, 0.1)}
              opacity={fallbackLockedAuraOpacity}
            />
          )}
          {meta.isMastered && (
            <>
              <Circle
                cx={cx}
                cy={cy}
                r={simplifiedMasteredHaloR + 3}
                color={toRGBA(meta.visual.stroke, 0.08)}
                opacity={masteredNodeHaloOpacity}
              />
              <Circle
                cx={cx}
                cy={cy}
                r={simplifiedMasteredHaloR}
                style="stroke"
                strokeWidth={0.95}
                color={toRGBA(meta.visual.ring, 0.82)}
                opacity={masteredNodeRingOpacity}
              />
            </>
          )}
          <Circle cx={cx} cy={cy} r={renderR} color={meta.visual.fill || (!meta.isLit ? '#13100E' : '#091018')} />
          {meta.isLit && (
            <Circle cx={cx} cy={cy} r={renderR - 5} color={meta.visual.innerFill || '#0B1320'} />
          )}
          {meta.isReady && (
            <Circle
              cx={cx}
              cy={cy}
              r={renderR * 0.74}
              color={toRGBA(meta.visual.stroke, 0.12)}
              opacity={readyNodeCoreOpacity}
            />
          )}
          <Circle
            cx={cx}
            cy={cy}
            r={primaryRingR}
            style="stroke"
            strokeWidth={meta.isStart ? Math.max(meta.visual.sw, 2.3) : Math.max(meta.visual.sw * 0.88, 1.35)}
            color={meta.visual.stroke}
            opacity={simplifiedStrokeOpacity}
          />
          <Circle
            cx={cx}
            cy={cy}
            r={renderR - 4.8}
            style="stroke"
            strokeWidth={0.68}
            color={meta.visual.innerRingSoft || toRGBA(meta.visual.ring, !meta.isLit ? 0.08 : 0.18)}
            opacity={simplifiedRingOpacity}
          />
          {meta.isLit && (
            <Circle
              cx={cx}
              cy={cy}
              r={Math.max(renderR - 17, renderR * 0.18)}
              color={meta.visual.core || 'rgba(255,255,255,0.03)'}
              opacity={simplifiedCoreOpacity}
            />
          )}
          {meta.isLit && (
            <Circle
              cx={cx}
              cy={cy}
              r={Math.max(renderR - 12.5, renderR * 0.28)}
              color={meta.visual.glowInner || toRGBA(meta.visual.ring, 0.22)}
              opacity={meta.useFocusedPulse ? coreGlowOpacity : litNodeCoreAliveOpacity}
            />
          )}
        </Group>
      );
    }

    return (
        <Group>
        {meta.isLit && (
          <Circle
            cx={cx}
            cy={cy}
            r={renderR * (meta.isStart ? 1.78 : 1.34)}
            color={meta.visual.glowOuter || toRGBA(meta.visual.stroke, meta.isStart ? 0.1 : 0.07)}
            opacity={fallbackLitAuraOpacity}
          />
        )}
        {meta.isReady && (
          <Circle
            cx={cx}
            cy={cy}
            r={renderR * 1.18}
            color={toRGBA(meta.visual.stroke, 0.14)}
            opacity={fallbackReadyAuraOpacity}
          />
        )}
        {meta.isLocked && (
          <Circle
            cx={cx}
            cy={cy}
            r={renderR * 1.04}
            color={toRGBA(meta.visual.stroke, 0.08)}
            opacity={fallbackLockedAuraOpacity}
          />
        )}
        {useEnhancedLitNodeLife && meta.isLit && !meta.useFocusedPulse && (
          <>
            <Circle
              cx={cx}
              cy={cy}
              r={idleOuterAuraRadius}
              color={meta.visual.glowOuter || toRGBA(meta.visual.stroke, meta.isStart ? 0.1 : 0.07)}
              opacity={litNodeAuraOpacity}
            />
            <Circle
              cx={cx}
              cy={cy}
              r={idleInnerAuraRadius}
              color={meta.visual.glowInner || toRGBA(meta.visual.ring, meta.isStart ? 0.14 : 0.1)}
              opacity={litNodeInnerAuraOpacity}
            />
          </>
        )}
        {useEnhancedLockedNodeLife && meta.isLocked && (
          <>
            <Circle
              cx={cx}
              cy={cy}
              r={renderR * 1.06}
              color={toRGBA(meta.visual.stroke, 0.08)}
              opacity={lockedNodeAuraOpacity}
            />
            <Circle
              cx={cx}
              cy={cy}
              r={renderR - 5.6}
              style="stroke"
              strokeWidth={0.76}
              color={toRGBA(meta.visual.ring, 0.54)}
              opacity={lockedNodeRingOpacity}
            />
          </>
        )}
        {useEnhancedReadyNodeLife && meta.isReady && (
          <>
            <Circle
              cx={cx}
              cy={cy}
              r={readyNodeAuraRadius}
              color={toRGBA(meta.visual.stroke, 0.16)}
              opacity={readyNodeAuraOpacity}
            />
            <Circle
              cx={cx}
              cy={cy}
              r={readyNodeRingRadius}
              style="stroke"
              strokeWidth={1.18}
              color={toRGBA(meta.visual.stroke, 0.82)}
              opacity={readyNodeRingOpacity}
            />
          </>
        )}
        {useEnhancedLitNodeLife && meta.isMastered && (
          <>
            <Circle
              cx={cx}
              cy={cy}
              r={masteredNodeHaloRadius}
              color={toRGBA(meta.visual.stroke, 0.12)}
              opacity={masteredNodeHaloOpacity}
            />
            <Circle
              cx={cx}
              cy={cy}
              r={masteredNodeRingRadius}
              style="stroke"
              strokeWidth={1.08}
              color={toRGBA(meta.visual.ring, 0.88)}
              opacity={masteredNodeRingOpacity}
            />
          </>
        )}
        {meta.useFocusedPulse && USE_GLOW && meta.isLit && (
          <Circle
            cx={cx}
            cy={cy}
            r={ambientR * 1.16}
            color={meta.visual.glowOuter || toRGBA(meta.visual.stroke, meta.isStart ? 0.12 : 0.09)}
            opacity={bloomOpacity}
          />
        )}
        {meta.useFocusedPulse && USE_GLOW && meta.isLit && (
          <Circle
            cx={cx}
            cy={cy}
            r={outerGlowR * 1.11}
            color={meta.visual.glowInner || toRGBA(meta.visual.ring, meta.isStart ? 0.18 : 0.14)}
            opacity={bloomOpacity}
          />
        )}
        {USE_GLOW && meta.isLit && (
          <Circle
            cx={cx}
            cy={cy}
            r={ambientR}
            color={meta.visual.ambient || toRGBA(meta.visual.stroke, meta.isStart ? 0.05 : 0.03)}
            opacity={glowOpacity}
          />
        )}
        {USE_GLOW && meta.isLit && (
          <Circle
            cx={cx}
            cy={cy}
            r={outerGlowR}
            color={meta.visual.glowOuter || toRGBA(meta.visual.stroke, meta.isStart ? 0.1 : 0.07)}
            opacity={glowOpacity}
          />
        )}
        {USE_GLOW && meta.isLit && (
          <Circle
            cx={cx}
            cy={cy}
            r={innerGlowR}
            color={meta.visual.glowInner || toRGBA(meta.visual.ring, meta.isStart ? 0.16 : 0.12)}
            opacity={glowOpacity}
          />
        )}

        {LOD.showOuterRing && (
          <>
            {meta.useFocusedPulse && (
              <Circle
                cx={cx}
                cy={cy}
                r={haloRingR + 4.2}
                style="stroke"
                strokeWidth={meta.isStart ? 1.28 : 0.94}
                color={meta.visual.outerRim || toRGBA(meta.visual.ring, meta.isLit ? 0.3 : 0.12)}
                opacity={haloBloomOpacity}
              />
            )}
            <Circle
              cx={cx}
              cy={cy}
              r={haloRingR}
              style="stroke"
              strokeWidth={meta.isStart ? 1.12 : 0.82}
              color={meta.visual.outerRim || toRGBA(meta.visual.ring, meta.isLit ? 0.24 : 0.1)}
              opacity={ringOpacity}
            />
          </>
        )}

        {LOD.showOuterRing && bld && connA === meta.n?.id && (
          <Circle cx={cx} cy={cy} r={NODE_R + 17} style="stroke" strokeWidth={1.8} color={BRANCH_COLORS.neutral.edgeHex} />
        )}

        <Circle cx={cx} cy={cy} r={renderR} color={meta.visual.fill || (!meta.isLit ? '#13100E' : '#091018')} />
        {meta.isLit && (
          <Circle cx={cx} cy={cy} r={renderR - 4.2} color={meta.visual.innerFill || '#0B1320'} />
        )}
        {meta.isLit && meta.useFocusedPulse && (
          <Circle
            cx={cx}
            cy={cy}
            r={Math.max(renderR - 12.5, renderR * 0.32)}
            color={meta.visual.glowInner || toRGBA(meta.visual.ring, 0.24)}
            opacity={coreGlowOpacity}
          />
        )}
        {useEnhancedLitNodeLife && meta.isLit && !meta.useFocusedPulse && (
          <Circle
            cx={cx}
            cy={cy}
            r={litNodeCoreAliveRadius}
            color={meta.visual.glowInner || toRGBA(meta.visual.ring, 0.22)}
            opacity={litNodeCoreAliveOpacity}
          />
        )}
        {useEnhancedReadyNodeLife && meta.isReady && (
          <Circle
            cx={cx}
            cy={cy}
            r={readyNodeCoreRadius}
            color={toRGBA(meta.visual.stroke, 0.28)}
            opacity={readyNodeCoreOpacity}
          />
        )}
        {useEnhancedLockedNodeLife && meta.isLocked && (
          <Circle
            cx={cx - (renderR * 0.16)}
            cy={cy - (renderR * 0.22)}
            r={NODE_R * 0.055}
            color={meta.visual.specular || 'rgba(226,214,198,0.08)'}
            opacity={lockedNodeSpecularOpacity}
          />
        )}
        {useEnhancedLitNodeLife && meta.isLit && (
          <Circle cx={cx} cy={cy} r={Math.max(renderR - 17, renderR * 0.16)} color={meta.visual.core || 'rgba(255,255,255,0.03)'} />
        )}
        {meta.isLit && (
          <>
            <Circle
              cx={cx - (renderR * 0.22)}
              cy={cy - (renderR * 0.28)}
              r={litNodeSpecularRadius}
              color={meta.visual.specular || 'rgba(240,246,255,0.12)'}
              opacity={litNodeSpecularOpacity}
            />
            <Circle
              cx={cx + (renderR * 0.15)}
              cy={cy + (renderR * 0.12)}
              r={NODE_R * 0.05}
              color={toRGBA(meta.visual.ring, 0.2)}
              opacity={litNodeCoreAliveOpacity}
            />
          </>
        )}
        <Circle
          cx={cx}
          cy={cy}
          r={renderR - 4.9}
          style="stroke"
          strokeWidth={0.72}
          color={meta.visual.innerRingSoft || toRGBA(meta.visual.ring, !meta.isLit ? 0.08 : 0.22)}
          opacity={ringOpacity}
        />
        <Circle
          cx={cx}
          cy={cy}
          r={primaryRingR}
          style="stroke"
          strokeWidth={meta.isStart ? meta.visual.sw + 0.38 : meta.visual.sw}
          color={meta.visual.stroke}
          opacity={strokeOpacity}
        />
        {meta.isLit && (
          <Circle
            cx={cx}
            cy={cy}
            r={primaryRingR - 4}
            style="stroke"
            strokeWidth={meta.isStart ? 0.85 : 0.74}
            color={meta.visual.innerRing || toRGBA(meta.visual.ring, meta.isStart ? 0.16 : 0.22)}
            opacity={strokeOpacity}
          />
        )}
        {/* Tri-color ring arcs for start nodes */}
        {meta.isStart && !isFarNode && (() => {
          const r = primaryRingR;
          const sw = 1.4;
          const arcs = [
            { c: 'rgba(52,225,122,0.55)', a: -50, sweep: 80 },
            { c: 'rgba(255,216,74,0.50)', a: 70, sweep: 80 },
            { c: 'rgba(96,165,250,0.55)', a: 190, sweep: 80 },
          ];
          return arcs.map(({ c, a, sweep }, i) => {
            const s = (a * Math.PI) / 180;
            const e = ((a + sweep) * Math.PI) / 180;
            const d = `M ${cx + r * Math.cos(s)} ${cy + r * Math.sin(s)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(e)} ${cy + r * Math.sin(e)}`;
            return <Path key={`sa_${i}`} path={d} style="stroke" strokeWidth={sw} color={c} strokeCap="round" opacity={useEnhancedLitNodeLife ? startArcAliveOpacity : 0.82} />;
          });
        })()}
      </Group>
    );
  };
  const unlockTrailHeadT = useDerivedValue(() => {
    if (!unlockMeta?.sourceNode) {
      return 0;
    }

    const travel = clamp01(unlockProgress.value / 0.82);
    return easeInOutSine(travel);
  }, [unlockMeta]);
  const unlockTrailRevealT = useDerivedValue(() => (
    unlockMeta?.sourceNode ? unlockTrailHeadT.value : 0
  ), [unlockMeta]);
  const unlockTrailChargeStartT = useDerivedValue(() => (
    unlockMeta?.sourceNode ? Math.max(0, unlockTrailHeadT.value - 0.16) : 0
  ), [unlockMeta]);
  const unlockTrailGlowStartT = useDerivedValue(() => (
    unlockMeta?.sourceNode ? Math.max(0, unlockTrailHeadT.value - 0.24) : 0
  ), [unlockMeta]);
  const unlockTrailHeadX = useDerivedValue(() => {
    if (!unlockMeta?.sourceNode) {
      return 0;
    }

    return pointOnQuadraticEdge(unlockMeta.sourceNode, unlockMeta.targetNode, unlockTrailHeadT.value).x;
  }, [unlockMeta]);
  const unlockTrailHeadY = useDerivedValue(() => {
    if (!unlockMeta?.sourceNode) {
      return 0;
    }

    return pointOnQuadraticEdge(unlockMeta.sourceNode, unlockMeta.targetNode, unlockTrailHeadT.value).y;
  }, [unlockMeta]);
  const unlockTrailHeadOpacity = useDerivedValue(() => {
    if (!unlockMeta?.sourceNode) {
      return 0;
    }

    return clamp01(1 - clamp01((unlockProgress.value - 0.76) / 0.24));
  }, [unlockMeta]);
  const unlockTrailRevealOpacity = useDerivedValue(() => {
    if (!unlockMeta?.sourceNode) {
      return 0;
    }

    const fadeIn = easeOutCubic(clamp01(unlockProgress.value / 0.28));
    const fadeOut = 1 - clamp01((unlockProgress.value - 0.86) / 0.14);
    return fadeIn * fadeOut;
  }, [unlockMeta]);
  const unlockTrailChargeOpacity = useDerivedValue(() => {
    if (!unlockMeta?.sourceNode) {
      return 0;
    }

    const fadeIn = easeOutCubic(clamp01(unlockProgress.value / 0.16));
    const fadeOut = 1 - clamp01((unlockProgress.value - 0.74) / 0.26);
    return fadeIn * fadeOut;
  }, [unlockMeta]);
  const unlockTrailSettledBaseOpacity = useDerivedValue(() => {
    if (!unlockMeta?.sourceNode) {
      return 0;
    }

    return easeOutCubic(clamp01((unlockProgress.value - 0.62) / 0.22));
  }, [unlockMeta]);
  const unlockTrailSettledGlowOpacity = useDerivedValue(() => {
    if (!unlockMeta?.sourceNode) {
      return 0;
    }

    return 0.2 + (unlockTrailSettledBaseOpacity.value * 0.8);
  }, [unlockMeta]);
  const unlockOuterRingRadius = useDerivedValue(() => (
    unlockMeta ? lerp(NODE_R * 1.02, NODE_R * 2.45, easeOutCubic(unlockProgress.value)) : NODE_R
  ), [unlockMeta]);
  const unlockOuterRingOpacity = useDerivedValue(() => (
    unlockMeta ? 0.34 * (1 - easeOutQuad(unlockProgress.value)) : 0
  ), [unlockMeta]);
  const unlockInnerRingRadius = useDerivedValue(() => {
    if (!unlockMeta) return NODE_R;
    const delayed = clamp01((unlockProgress.value - 0.14) / 0.72);
    return lerp(NODE_R * 0.9, NODE_R * 1.86, easeOutCubic(delayed));
  }, [unlockMeta]);
  const unlockInnerRingOpacity = useDerivedValue(() => {
    if (!unlockMeta) return 0;
    const delayed = clamp01((unlockProgress.value - 0.14) / 0.72);
    return 0.24 * (1 - easeOutQuad(delayed));
  }, [unlockMeta]);
  const unlockCoreFlashRadius = useDerivedValue(() => (
    unlockMeta ? lerp(NODE_R * 0.32, NODE_R * 1.18, easeOutCubic(clamp01(unlockProgress.value / 0.34))) : 0
  ), [unlockMeta]);
  const unlockCoreFlashOpacity = useDerivedValue(() => {
    if (!unlockMeta) return 0;
    const burst = clamp01(unlockProgress.value / 0.42);
    return 0.22 * (1 - easeOutQuad(burst));
  }, [unlockMeta]);
  const unlockShellGlowRadius = useDerivedValue(() => (
    unlockMeta ? lerp(NODE_R * 1.08, NODE_R * 1.72, easeOutCubic(clamp01(unlockProgress.value / 0.38))) : NODE_R
  ), [unlockMeta]);
  const unlockShellGlowOpacity = useDerivedValue(() => {
    if (!unlockMeta) return 0;
    const burst = clamp01(unlockProgress.value / 0.58);
    return 0.18 * (1 - easeOutQuad(burst));
  }, [unlockMeta]);
  const unlockCoreIgniteRadius = useDerivedValue(() => (
    unlockMeta ? lerp(NODE_R * 0.18, NODE_R * 0.74, easeOutCubic(clamp01(unlockProgress.value / 0.26))) : 0
  ), [unlockMeta]);
  const unlockCoreIgniteOpacity = useDerivedValue(() => {
    if (!unlockMeta) return 0;
    const burst = clamp01(unlockProgress.value / 0.34);
    return 0.24 * (1 - easeOutQuad(burst));
  }, [unlockMeta]);
  const unlockParticleOpacity = useDerivedValue(() => {
    if (!unlockMeta) return 0;
    const burst = clamp01((unlockProgress.value - 0.08) / 0.54);
    return 0.86 * (1 - burst);
  }, [unlockMeta]);
  const unlockParticleScale = useDerivedValue(() => (
    unlockMeta ? lerp(0.32, 1.04, easeOutCubic(clamp01((unlockProgress.value - 0.04) / 0.62))) : 1
  ), [unlockMeta]);
  const unlockNodePopTransform = useDerivedValue(() => {
    if (!unlockMeta?.targetNode) {
      return [{ scale: 1 }];
    }

    const t = clamp01(unlockProgress.value / 0.42);
    const popScale = 1 + (Math.sin(t * Math.PI) * 0.08);
    const { x, y } = unlockMeta.targetNode;
    return [
      { translateX: x },
      { translateY: y },
      { scale: popScale },
      { translateX: -x },
      { translateY: -y },
    ];
  }, [unlockMeta]);
  const unlockParticleTransform = useDerivedValue(() => {
    if (!unlockMeta?.targetNode) {
      return [{ scale: 1 }];
    }

    const { x, y } = unlockMeta.targetNode;
    return [
      { translateX: x },
      { translateY: y },
      { scale: unlockParticleScale.value },
      { translateX: -x },
      { translateY: -y },
    ];
  }, [unlockMeta]);

  const renderStarLayer = (stars, keyPrefix, opacityMultiplier = 1) => stars.flatMap((star, index) => {
    const key = `${keyPrefix}_${index}`;
    const elements = [];

    if (star.glowRadius) {
      elements.push(
        <Circle
          key={`${key}_glow`}
          cx={star.x}
          cy={star.y}
          r={star.glowRadius}
          color={star.color}
          opacity={star.glowOpacity * starOpacityScale * opacityMultiplier}
        />,
      );
    }

    elements.push(
      <Circle
        key={`${key}_core`}
        cx={star.x}
        cy={star.y}
        r={star.r}
        color={star.color}
        opacity={star.opacity * starOpacityScale * opacityMultiplier}
      />,
    );

    return elements;
  });

  const renderNodeLabels = (item, labelNodeId, rx, ry) => {
    if (!LOD.showLabels || !labelFont || item.isLocked) {
      return null;
    }

    return item.lines.map((line, lineIndex) => {
      const width = labelMetrics[labelNodeId]?.[lineIndex] ?? labelFont.measureText(line).width;
      const x = rx - width / 2;
      const y = ry + 5 + (lineIndex - ((item.lines.length - 1) / 2)) * 16;
      const mainColor = item.isLit ? '#F7F2EA' : '#D4CDC4';
      const glowColor = item.isLit
        ? toRGBA(item.visual.stroke || '#BFD9FF', 0.92)
        : toRGBA(item.visual.ring || mainColor, 0.78);
      return (
        <Group key={`${labelNodeId}_${lineIndex}`} opacity={labelMainOpacity}>
          <Group opacity={labelGlowOpacity}>
            <SkiaText x={x} y={y} text={line} font={labelFont} color={glowColor} />
          </Group>
          <SkiaText x={x} y={y} text={line} font={labelFont} color={mainColor} />
        </Group>
      );
    });
  };

  return (
    <Canvas style={{ width: canvasSize.width, height: canvasSize.height }}>
      {rockBurstMeta && (
        <Group>
          <Circle
            cx={rockBurstMeta.x}
            cy={rockBurstMeta.y}
            r={rockBurstOuterRadius}
            style="stroke"
            strokeWidth={1.6}
            color="rgba(196, 232, 255, 0.94)"
            opacity={rockBurstOuterOpacity}
          />
          <Circle
            cx={rockBurstMeta.x}
            cy={rockBurstMeta.y}
            r={rockBurstCoreRadius}
            color="rgba(147, 197, 253, 0.2)"
            opacity={rockBurstCoreOpacity}
          />
          <Group transform={rockBurstParticleTransform}>
            {rockBurstMeta.particles.map((particle, index) => (
              <Circle
                key={`rb_${index}`}
                cx={rockBurstMeta.x + (Math.cos(particle.angle) * particle.distance)}
                cy={rockBurstMeta.y + (Math.sin(particle.angle) * particle.distance)}
                r={particle.radius}
                color={particle.color}
                opacity={rockBurstParticleOpacity}
              />
            ))}
          </Group>
        </Group>
      )}

      <Group transform={farSpaceTransform} opacity={farLayerOpacity}>
        {renderStarLayer(visibleStarLayers.farDust, 'fd', 0.62)}
        {renderStarLayer(visibleStarLayers.farStars, 'fs', 0.82)}
      </Group>

      <Group transform={midSpaceTransform} opacity={midLayerOpacity}>
        {renderStarLayer(visibleStarLayers.midStars, 'ms', 0.94)}
      </Group>

      <Group transform={sceneNudgeTransform}>
        <Group transform={sceneTransform}>
          <>
        {/* ── Edges ── */}
        {edgeSegments.map((edge) => {
          const isMastered = edge.status === 'mastered';
          const isReady = edge.status === 'ready';
          const isLocked = edge.status === 'locked';
          const width = isMastered ? edgeVisual.masteredW : isReady ? edgeVisual.readyW : edgeVisual.lockedW;
          const dashIntervals = LOD.isFar ? [8, 9] : [12, 10];
          const edgeBaseColor = isMastered
            ? edge.branchColor.main
            : edge.branchColor.edgeHex;
          const mainColor = isLocked
            ? toRGBA(edge.branchColor.main, 0.18)
            : toRGBA(edgeBaseColor, isMastered ? 0.9 : 0.84);
          const glowOuterWidth = isMastered ? width + 7.2 : isReady ? width + 5.1 : width + 1.8;
          const glowInnerWidth = isMastered ? width + 3.9 : isReady ? width + 2.7 : width + 0.95;
          const glowOuterColor = isMastered
            ? edge.branchColor.glow
            : isReady
              ? toRGBA(edge.branchColor.main, 0.2)
              : toRGBA(edge.branchColor.main, 0.06);
          const glowInnerColor = isMastered
            ? toRGBA(edge.branchColor.edgeHex, 0.24)
            : isReady
              ? toRGBA(edge.branchColor.edgeHex, 0.16)
              : toRGBA(edge.branchColor.edgeHex, 0.05);
          const edgeGlowOpacity = edge.useFocusedPulse ? focusedPulseEdgeGlowOpacity : 1;
          const edgeMainOpacity = edge.useFocusedPulse ? focusedPulseEdgeMainOpacity : 1;
          const baseEdgeOpacity = isLocked ? lockedEdgeFlickerOpacity : edgeMainOpacity;
          const isUnlockOpening = !bld && edge.isUnlockTrail && unlockMeta?.sourceNode;
          const closedUnlockColor = toRGBA(edge.branchColor.main, 0.18);
          const closedUnlockWidth = Math.max(edgeVisual.readyW || 1.4, 1.4);
          const simplifiedWidth = isMastered ? Math.max(1.9, width * 0.76) : isReady ? Math.max(1.35, width * 0.72) : Math.max(0.9, width * 0.68);
          const simplifiedColor = isMastered
            ? toRGBA(edge.branchColor.main, 0.82)
            : isReady
              ? toRGBA(edge.branchColor.edgeHex, 0.68)
              : toRGBA(edge.branchColor.main, 0.14);
          const simplifiedOpacity = edge.useFocusedPulse
            ? edgeMainOpacity
            : isLocked
              ? lockedEdgeFlickerOpacity
              : isMastered
                ? interactionMasteredEdgeOpacity
                : interactionReadyEdgeOpacity;

          return (
            <Group key={edge.id}>
              {!isUnlockOpening && showPersistentEdgeGlow && (
                <Path
                  path={edge.path}
                  style="stroke"
                  strokeWidth={isLocked
                    ? (LOD.isFar ? width + 0.55 : LOD.isMid ? width + 0.9 : width + 1.15)
                    : (LOD.isFar ? width + 1.2 : LOD.isMid ? width + 2.2 : width + 2.8)}
                  color={isLocked
                    ? toRGBA(edge.branchColor.main, LOD.isFar ? 0.08 : 0.11)
                    : isMastered
                      ? glowOuterColor
                      : toRGBA(edge.branchColor.main, LOD.isFar ? 0.1 : 0.14)}
                  strokeCap="round"
                  opacity={isLocked
                    ? persistentLockedEdgeGlowOpacityScaled
                    : isMastered
                      ? persistentMasteredEdgeGlowOpacityScaled
                      : persistentReadyEdgeGlowOpacityScaled}
                />
              )}
              {!simplifyEdgeRendering && !isUnlockOpening && !bld && isMastered && showBaseEdgeGlow && (
                <Group opacity={edgeGlowOpacity}>
                  <Path
                    path={edge.path}
                    style="stroke"
                    strokeWidth={glowOuterWidth}
                    color={glowOuterColor}
                    strokeCap="round"
                  />
                  <Path
                    path={edge.path}
                    style="stroke"
                    strokeWidth={glowInnerWidth}
                    color={glowInnerColor}
                    strokeCap="round"
                  />
                </Group>
              )}

              {isUnlockOpening ? (
                <>
                  {isMastered && (
                    <Group opacity={unlockTrailSettledGlowOpacity}>
                      <Path
                        path={edge.path}
                        style="stroke"
                        strokeWidth={glowOuterWidth}
                        color={glowOuterColor}
                        strokeCap="round"
                      />
                      <Path
                        path={edge.path}
                        style="stroke"
                        strokeWidth={glowInnerWidth}
                        color={glowInnerColor}
                        strokeCap="round"
                      />
                    </Group>
                  )}
                  <Path path={edge.path} style="stroke" strokeWidth={closedUnlockWidth} color={closedUnlockColor} strokeCap="round" opacity={0.92}>
                    <DashPathEffect intervals={dashIntervals} />
                  </Path>
                  <Path
                    path={edge.path}
                    style="stroke"
                    strokeWidth={width}
                    color={mainColor}
                    strokeCap="round"
                    opacity={unlockTrailSettledBaseOpacity}
                  />
                  <Path
                    path={edge.path}
                    style="stroke"
                    strokeWidth={glowOuterWidth + 1.1}
                    color={edge.branchColor.glow}
                    strokeCap="round"
                    start={0}
                    end={unlockTrailRevealT}
                    opacity={unlockTrailRevealOpacity}
                  />
                  <Path
                    path={edge.path}
                    style="stroke"
                    strokeWidth={glowInnerWidth + 0.5}
                    color={toRGBA(edge.branchColor.edgeHex, 0.28)}
                    strokeCap="round"
                    start={0}
                    end={unlockTrailRevealT}
                    opacity={unlockTrailRevealOpacity}
                  />
                  <Path
                    path={edge.path}
                    style="stroke"
                    strokeWidth={width}
                    color={toRGBA(edge.branchColor.main, 0.96)}
                    strokeCap="round"
                    start={0}
                    end={unlockTrailRevealT}
                    opacity={unlockTrailRevealOpacity}
                  />
                  <Path
                    path={edge.path}
                    style="stroke"
                    strokeWidth={width + 2.1}
                    color={toRGBA(edge.branchColor.ring, 0.62)}
                    strokeCap="round"
                    start={unlockTrailGlowStartT}
                    end={unlockTrailHeadT}
                    opacity={unlockTrailChargeOpacity}
                  />
                  <Path
                    path={edge.path}
                    style="stroke"
                    strokeWidth={width + 0.85}
                    color={toRGBA(edge.branchColor.main, 0.98)}
                    strokeCap="round"
                    start={unlockTrailChargeStartT}
                    end={unlockTrailHeadT}
                    opacity={unlockTrailChargeOpacity}
                  />
                </>
              ) : simplifyEdgeRendering ? (
                <>
                  {!isLocked && (
                    <Path
                      path={edge.path}
                      style="stroke"
                      strokeWidth={simplifiedWidth + (isMastered ? 2.2 : 1.4)}
                      color={isMastered ? toRGBA(edge.branchColor.glow, 0.22) : toRGBA(edge.branchColor.main, 0.12)}
                      strokeCap="round"
                      opacity={simplifiedOpacity}
                    />
                  )}
                  <Path
                    path={edge.path}
                    style="stroke"
                    strokeWidth={simplifiedWidth}
                    color={simplifiedColor}
                    strokeCap="round"
                    opacity={simplifiedOpacity}
                  />
                </>
              ) : (
                <>
                  <Path path={edge.path} style="stroke" strokeWidth={width} color={mainColor} strokeCap="round" opacity={baseEdgeOpacity}>
                    {!isMastered && !bld && <DashPathEffect intervals={dashIntervals} />}
                  </Path>
                  {showAnimatedEdgeLife && isLocked && (
                    <Path
                      path={edge.path}
                      style="stroke"
                      strokeWidth={width + 0.42}
                      color={toRGBA(edge.branchColor.main, 0.18)}
                      strokeCap="round"
                      opacity={lockedEdgeSparkOpacity}
                    >
                      <DashPathEffect intervals={dashIntervals} />
                    </Path>
                  )}
                </>
              )}

              {(showAnimatedEdgeLife || showSelectedPathLife) && !isUnlockOpening && (
                <EdgeMotionOverlay
                  id={edge.id}
                  path={edge.path}
                  branchColor={edge.branchColor}
                  width={width}
                  status={edge.status}
                  pulseClock={pulseClock}
                  showAmbient={showAnimatedEdgeLife}
                  selectedDepth={showSelectedPathLife ? edge.selectedDepth : null}
                />
              )}

              {!bld && edge.isUnlockTrail && unlockMeta?.sourceNode && (
                <Group>
                  <Circle
                    cx={unlockTrailHeadX}
                    cy={unlockTrailHeadY}
                    r={NODE_R * 0.58}
                    color={toRGBA(unlockMeta.branchColor.main, 0.16)}
                    opacity={unlockTrailHeadOpacity}
                  />
                  <Circle
                    cx={unlockTrailHeadX}
                    cy={unlockTrailHeadY}
                    r={NODE_R * 0.28}
                    color={unlockMeta.branchColor.ring}
                    opacity={unlockTrailHeadOpacity}
                  />
                </Group>
              )}
            </Group>
          );
        })}

        {/* ── Nodes ── */}
        {nodeRenderData.map((item) => {
          const rx = item.n.x;
          const ry = item.n.y;
          const isFarNode = LOD.isFar;
          const isUnlockTarget = !!unlockMeta && unlockMeta.targetNode.id === item.n.id;

          return (
            <Group key={item.n.id}>
              {renderNodeShell(item, rx, ry, isFarNode)}
              {isUnlockTarget && !isFarNode && (
                <Group transform={unlockNodePopTransform}>
                  <Circle
                    cx={rx}
                    cy={ry}
                    r={unlockShellGlowRadius}
                    color={toRGBA(unlockMeta.branchColor.main, 0.18)}
                    opacity={unlockShellGlowOpacity}
                  />
                  <Circle
                    cx={rx}
                    cy={ry}
                    r={unlockOuterRingRadius}
                    style="stroke"
                    strokeWidth={1.8}
                    color={toRGBA(unlockMeta.branchColor.main, 0.82)}
                    opacity={unlockOuterRingOpacity}
                  />
                  <Circle
                    cx={rx}
                    cy={ry}
                    r={unlockInnerRingRadius}
                    style="stroke"
                    strokeWidth={1.2}
                    color={toRGBA(unlockMeta.branchColor.ring, 0.8)}
                    opacity={unlockInnerRingOpacity}
                  />
                  <Circle
                    cx={rx}
                    cy={ry}
                    r={unlockCoreFlashRadius}
                    color={toRGBA(unlockMeta.branchColor.ring, 0.22)}
                    opacity={unlockCoreFlashOpacity}
                  />
                  <Circle
                    cx={rx}
                    cy={ry}
                    r={unlockCoreIgniteRadius}
                    color={toRGBA(unlockMeta.branchColor.ring, 0.24)}
                    opacity={unlockCoreIgniteOpacity}
                  />
                  {LOD.isNear && (
                    <Group transform={unlockParticleTransform}>
                      {unlockMeta.particles.map((particle, index) => (
                        <Circle
                          key={`up_${index}`}
                          cx={rx + Math.cos(particle.angle) * (particle.distance * (0.56 + (particle.delay * 0.7)))}
                          cy={ry + Math.sin(particle.angle) * (particle.distance * (0.56 + (particle.delay * 0.7)))}
                          r={particle.radius}
                          color={index % 2 === 0 ? unlockMeta.branchColor.ring : unlockMeta.branchColor.main}
                          opacity={unlockParticleOpacity}
                        />
                      ))}
                    </Group>
                  )}
                </Group>
              )}

              {renderNodeLabels(item, item.n.id, rx, ry)}
            </Group>
          );
        })}
          </>

        {/* ── Dragged node ── */}
        {draggedNodeMeta !== null && (
          <Group transform={draggedTransform}>
            {renderNodeShell(draggedNodeMeta, 0, 0, LOD.isFar)}

            {renderNodeLabels(draggedNodeMeta, dragId, 0, 0)}
          </Group>
        )}
        </Group>
      </Group>
    </Canvas>
  );
});

export default SkiaTreeCanvas;
