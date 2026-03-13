import React, { useMemo, useRef } from 'react';
import {
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Path,
  Rect,
  Text as SkiaText,
  matchFont,
  useClock,
} from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { BRANCH_COLORS } from '../../theme/colors';
import { NODE_R, USE_GLOW } from '../../constants/tree';
import { resolveEdgeBranch, toRGBA } from '../../utils/treeUtils';
import { mulberry32, buildEdgePath } from '../../utils/skiaTreeUtils';

const BG_COLOR = '#000000';
const TAU = Math.PI * 2;
const FOCUS_PULSE_MIN_SCALE = 0.92;
const FOCUS_PULSE_MAX_VISIBLE_NODES = 8;
const FOCUS_PULSE_CYCLE_MS = 3800;
const FOCUS_PULSE_DRIFT_MS = 1420;
const STAR_NODE_CULL_RADIUS_SQ = (NODE_R * 0.18) ** 2;

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
}) {
  const labelFont = useMemo(() => {
    try {
      return matchFont({ fontFamily: 'sans-serif', fontSize: 15, fontWeight: 'bold' });
    } catch {
      return matchFont({ fontSize: 15 });
    }
  }, []);

  const sceneTransform = useDerivedValue(() => ([
    { translateX: txV.value },
    { translateY: tyV.value },
    { scale: scV.value },
  ]), []);

  const draggedTransform = useDerivedValue(() => ([
    { translateX: dragXV.value },
    { translateY: dragYV.value },
  ]), []);
  const pulseClock = useClock();

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
    for (let i = 0; i < 7000; i++) {
      stars.push({
        x: cx + (rand() - 0.5) * worldWidth,
        y: cy + (rand() - 0.5) * worldHeight,
        r: 0.6 + rand() * 0.7,
        color: dustColors[Math.floor(rand() * dustColors.length)],
        opacity: 0.15 + rand() * 0.18,
      });
    }

    // Layer 2: Visible small stars — always present
    for (let i = 0; i < 3800; i++) {
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
    for (let i = 0; i < 900; i++) {
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
    for (let i = 0; i < 280; i++) {
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
    for (let i = 0; i < 80; i++) {
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
  const focusedPulseFieldOpacity = useDerivedValue(() => {
    if (!focusedPulseCandidate || scV.value < FOCUS_PULSE_MIN_SCALE) return 1;
    return 0.58 + (focusedPulseStrength.value * 0.42);
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

  const visibleStars = useMemo(() => {
    if (!visibleBounds) return spaceStars;

    const pad = LOD.isFar ? 220 : 320;
    const left = visibleBounds.left - pad;
    const right = visibleBounds.right + pad;
    const top = visibleBounds.top - pad;
    const bottom = visibleBounds.bottom + pad;
    const brightNodes = glowFieldSources.bright;

    return spaceStars.filter((star) => {
      if (!(star.x >= left && star.x <= right && star.y >= top && star.y <= bottom)) return false;
      if (brightNodes.length === 0) return true;

      for (let i = 0; i < brightNodes.length; i += 1) {
        const { node } = brightNodes[i];
        const dx = node.x - star.x;
        const dy = node.y - star.y;
        if ((dx * dx) + (dy * dy) < STAR_NODE_CULL_RADIUS_SQ) return false;
      }

      return true;
    });
  }, [LOD.isFar, glowFieldSources, spaceStars, visibleBounds]);

  const regionalGlowFields = useMemo(() => {
    const buildCluster = (points, color, baseRadius, opacityScale) => {
      if (!points.length) return null;

      let weightSum = 0;
      let cx = 0;
      let cy = 0;
      for (const point of points) {
        const { node, status } = point;
        const weight = status === 'start' ? 1.9 : status === 'mastered' ? 1.35 : 1.1;
        weightSum += weight;
        cx += node.x * weight;
        cy += node.y * weight;
      }

      cx /= weightSum;
      cy /= weightSum;

      let maxDist = 0;
      for (const point of points) {
        const { node } = point;
        maxDist = Math.max(maxDist, Math.hypot(node.x - cx, node.y - cy));
      }

      return {
        cx,
        cy,
        color,
        radius: Math.max(baseRadius, maxDist + baseRadius * 0.45),
        opacityScale,
      };
    };

    return [
      buildCluster(glowFieldSources.mastered, '#34D366', 280, 0.28),
      buildCluster(glowFieldSources.ready, '#FACC15', 260, 0.22),
    ].filter(Boolean);
  }, [glowFieldSources]);

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
      useFocusedPulse: focusedPulseCandidate && status !== 'locked',
    };
  }).filter(Boolean), [bld, focusedPulseCandidate, nodeMap, nodeStatusMap, visibleEdges]);

  const edgeSegments = useMemo(() => {
    const cache = edgePathCache.current;
    const seen = new Set();

    const segments = edgeData.map(({
      id, fromNode, toNode, status, branchColor, useFocusedPulse,
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
        path,
        status,
        branchColor,
        useFocusedPulse,
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
    Object.entries(wrappedLabels).forEach(([nodeId, lines]) => {
      metrics[nodeId] = lines.map((line) => labelFont.measureText(line).width);
    });
    return metrics;
  }, [labelFont, wrappedLabels]);

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

  const farNodeR = NODE_R * 0.34;
  const starOpacityScale = LOD.isNear ? 1.1 : LOD.isMid ? 1.15 : 1.3;

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

    if (isFarNode) {
      const farR = meta.isStart ? NODE_R * 0.7 : NODE_R * 0.55;
      return (
        <Group>
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
          <Circle cx={cx} cy={cy} r={farR} color={meta.visual.farAura || toRGBA(meta.visual.stroke, 0.18)} />
          <Circle cx={cx} cy={cy} r={farR * 0.65} color={meta.visual.farBody || toRGBA(meta.visual.stroke, 0.36)} />
          <Circle cx={cx} cy={cy} r={farR * 0.33} color={meta.visual.farCore || toRGBA(meta.visual.ring, 0.56)} />
          <Circle cx={cx} cy={cy} r={farR * 0.7} style="stroke" strokeWidth={meta.isStart ? 1.2 : 0.9} color={toRGBA(meta.visual.stroke, 0.52)} />
        </Group>
      );
    }

    return (
      <Group>
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
        {meta.isLit && (
          <Circle cx={cx} cy={cy} r={Math.max(renderR - 17, renderR * 0.16)} color={meta.visual.core || 'rgba(255,255,255,0.03)'} />
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
            return <Path key={`sa_${i}`} path={d} style="stroke" strokeWidth={sw} color={c} strokeCap="round" />;
          });
        })()}
      </Group>
    );
  };

  return (
    <Canvas style={{ width: canvasSize.width, height: canvasSize.height }}>
      <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} color={BG_COLOR} />

      <Group transform={sceneTransform}>
        {regionalGlowFields.map((glow, index) => (
          <Group key={`glow_${index}`} opacity={focusedPulseCandidate ? focusedPulseFieldOpacity : 1}>
            <Circle cx={glow.cx} cy={glow.cy} r={glow.radius * 1.4} color={toRGBA(glow.color, 0.008 * glow.opacityScale)} />
            <Circle cx={glow.cx} cy={glow.cy} r={glow.radius * 1.1} color={toRGBA(glow.color, 0.015 * glow.opacityScale)} />
            <Circle cx={glow.cx} cy={glow.cy} r={glow.radius * 0.75} color={toRGBA(glow.color, 0.024 * glow.opacityScale)} />
          </Group>
        ))}

        {visibleStars.map((star, index) => (
          <Group key={`s${index}`}>
            {star.glowRadius && (
              <Circle
                cx={star.x}
                cy={star.y}
                r={star.glowRadius}
                color={star.color}
                opacity={star.glowOpacity * starOpacityScale}
              />
            )}
            <Circle
              cx={star.x}
              cy={star.y}
              r={star.r}
              color={star.color}
              opacity={star.opacity * starOpacityScale}
            />
          </Group>
        ))}

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

          return (
            <Group key={edge.id}>
              {!bld && isMastered && (
                <Group>
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

              <Path path={edge.path} style="stroke" strokeWidth={width} color={mainColor} strokeCap="round">
                {!isMastered && !bld && <DashPathEffect intervals={dashIntervals} />}
              </Path>
            </Group>
          );
        })}

        {/* ── Nodes ── */}
        {nodeRenderData.map((item) => {
          const rx = item.n.x;
          const ry = item.n.y;
          const isFarNode = LOD.isFar;

          return (
            <Group key={item.n.id}>
              {renderNodeShell(item, rx, ry, isFarNode)}

              {LOD.showLabels && labelFont && !item.isLocked && item.lines.map((line, lineIndex) => {
                const width = labelMetrics[item.n.id]?.[lineIndex] ?? labelFont.measureText(line).width;
                const x = rx - width / 2;
                const y = ry + 5 + (lineIndex - ((item.lines.length - 1) / 2)) * 16;
                const mainColor = item.isLit ? '#F7F2EA' : '#D4CDC4';

                return (
                  <Group key={`${item.n.id}_${lineIndex}`}>
                    <SkiaText x={x + 1.45} y={y + 1.45} text={line} font={labelFont} color="rgba(0,0,0,0.99)" />
                    <SkiaText x={x + 0.75} y={y + 0.75} text={line} font={labelFont} color="rgba(8,12,18,0.96)" />
                    <SkiaText x={x} y={y} text={line} font={labelFont} color={mainColor} />
                  </Group>
                );
              })}
            </Group>
          );
        })}

        {/* ── Dragged node ── */}
        {draggedNodeMeta !== null && (
          <Group transform={draggedTransform}>
            {renderNodeShell(draggedNodeMeta, 0, 0, LOD.isFar)}

            {LOD.showLabels && labelFont && !draggedNodeMeta.isLocked && draggedNodeMeta.lines.map((line, lineIndex) => {
              const width = labelMetrics[dragId]?.[lineIndex] ?? labelFont.measureText(line).width;
              const x = -width / 2;
              const y = 5 + (lineIndex - ((draggedNodeMeta.lines.length - 1) / 2)) * 16;
              const mainColor = draggedNodeMeta.isLit ? '#F7F2EA' : '#D4CDC4';

              return (
                <Group key={`drag_label_${lineIndex}`}>
                  <SkiaText x={x + 1.45} y={y + 1.45} text={line} font={labelFont} color="rgba(0,0,0,0.99)" />
                  <SkiaText x={x + 0.75} y={y + 0.75} text={line} font={labelFont} color="rgba(8,12,18,0.96)" />
                  <SkiaText x={x} y={y} text={line} font={labelFont} color={mainColor} />
                </Group>
              );
            })}
          </Group>
        )}
      </Group>
    </Canvas>
  );
});

export default SkiaTreeCanvas;
