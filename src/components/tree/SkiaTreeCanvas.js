import React, { useEffect, useMemo, useRef } from 'react';
import {
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Path,
  Rect,
  Skia,
  Text as SkiaText,
  matchFont,
} from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { BRANCH_COLORS } from '../../theme/colors';
import { NODE_R, USE_GLOW } from '../../constants/tree';
import { resolveEdgeBranch, toRGBA } from '../../utils/treeUtils';
import { mulberry32, buildEdgePath } from '../../utils/skiaTreeUtils';

const SkiaTreeCanvas = React.memo(function SkiaTreeCanvas({
  nodes, visibleNodes, visibleEdges, nodeStatusMap, wrappedLabels,
  txV, tyV, scV,
  dragId, dragXV, dragYV,
  LOD, edgeVisual,
  bld, connA, isInteracting,
  canvasSize, nodeStyles,
}) {
  const labelFont = useMemo(() => {
    try {
      return matchFont({ fontFamily: 'sans-serif', fontSize: 13, fontWeight: 'bold' });
    } catch {
      return matchFont({ fontSize: 13 });
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

  // ── Breathing pulse — runs entirely on UI thread at 60fps ──
  const pulseV = useSharedValue(0);
  useEffect(() => {
    pulseV.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1,  // infinite
      true, // reverse
    );
  }, []);

  // Scale transform for aura breathing: 1.0 → 1.07 → 1.0
  const auraPulseTransform = useDerivedValue(() => [
    { scale: 1.0 + pulseV.value * 0.07 },
  ]);

  // Slightly different pulse for far-mode glow (smaller amplitude)
  const farPulseTransform = useDerivedValue(() => [
    { scale: 1.0 + pulseV.value * 0.10 },
  ]);

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // ── Starfield — subtle deep-space dust ──
  const starBounds = useMemo(() => {
    if (nodes.length === 0) return { cx: 0, cy: 0, w: 4000, h: 4000 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
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
    const { cx, cy, w: W, h: H } = starBounds;
    const rand = mulberry32(1337);
    const stars = [];
    const colors = [
      '#ffffff', '#ffffff', '#ffffff',
      '#d4c8ff', '#b4dcff', '#ffd4d4',
      '#d4ffe4', '#ffe6c8', '#c8ffff',
    ];

    // Layer 1: Dim dust — tiny, everywhere
    for (let i = 0; i < 2400; i++) {
      stars.push({
        x: cx + (rand() - 0.5) * W,
        y: cy + (rand() - 0.5) * H,
        r: 1 + rand() * 1.5,
        color: colors[Math.floor(rand() * 3)],
        opacity: 0.10 + rand() * 0.15,
      });
    }

    // Layer 2: Small stars — visible, scattered
    for (let i = 0; i < 1200; i++) {
      stars.push({
        x: cx + (rand() - 0.5) * W,
        y: cy + (rand() - 0.5) * H,
        r: 2 + rand() * 2,
        color: colors[Math.floor(rand() * colors.length)],
        opacity: 0.2 + rand() * 0.3,
      });
    }

    // Layer 3: Medium stars — clearly visible, some color tint
    for (let i = 0; i < 400; i++) {
      stars.push({
        x: cx + (rand() - 0.5) * W,
        y: cy + (rand() - 0.5) * H,
        r: 3 + rand() * 2.5,
        color: colors[Math.floor(rand() * colors.length)],
        opacity: 0.35 + rand() * 0.3,
      });
    }

    // Layer 4: Bright accent stars — rare, colorful, with a glow halo
    for (let i = 0; i < 100; i++) {
      const x = cx + (rand() - 0.5) * W;
      const y = cy + (rand() - 0.5) * H;
      const color = colors[3 + Math.floor(rand() * (colors.length - 3))];
      stars.push({ x, y, r: 8 + rand() * 7, color, opacity: 0.03 + rand() * 0.04 });
      stars.push({ x, y, r: 3 + rand() * 2.5, color, opacity: 0.6 + rand() * 0.3 });
    }

    return stars;
  }, [starBounds]);

  // ── Edge data ──
  const edgePathCache = useRef(new Map());

  const edgeData = useMemo(() => visibleEdges.map((e, idx) => {
    const fn = nodeMap.get(e.from);
    const tn = nodeMap.get(e.to);
    if (!fn || !tn) return null;

    const fromState = nodeStatusMap[fn.id] || 'locked';
    const toState = nodeStatusMap[tn.id] || 'locked';
    const fromLit = fromState === 'start' || fromState === 'mastered';
    const toLit = toState === 'start' || toState === 'mastered';
    const toReady = toState === 'ready';
    const status = bld
      ? 'locked'
      : (fromLit && toLit ? 'mastered' : ((fromLit && !toLit) || toReady ? 'ready' : 'locked'));

    const branch = resolveEdgeBranch(fn, tn);
    const branchColor = BRANCH_COLORS[branch] || BRANCH_COLORS.neutral;

    return { id: `${e.from}_${e.to}_${idx}`, fn, tn, status, branchColor };
  }).filter(Boolean), [bld, nodeMap, nodeStatusMap, visibleEdges]);

  const edgeSegments = useMemo(() => {
    const cache = edgePathCache.current;
    const seen = new Set();

    const segments = edgeData.map(({ id, fn, tn, status, branchColor }) => {
      const key = `${fn.id}->${tn.id}:${fn.x},${fn.y}|${tn.x},${tn.y}`;
      seen.add(key);
      let path = cache.get(key);
      if (!path) {
        path = buildEdgePath(fn, tn);
        cache.set(key, path);
      }
      return { id, path, status, branchColor };
    });

    for (const key of cache.keys()) {
      if (!seen.has(key)) cache.delete(key);
    }

    return segments;
  }, [edgeData]);

  // ── Connection counts per node (for glow intensity) ──
  const connCounts = useMemo(() => {
    const counts = {};
    for (const e of visibleEdges) {
      counts[e.from] = (counts[e.from] || 0) + 1;
      counts[e.to] = (counts[e.to] || 0) + 1;
    }
    return counts;
  }, [visibleEdges]);

  // ── Node data ──
  const nodeRenderData = useMemo(() => {
    return visibleNodes.map((n) => {
      if (n.id === dragId) return null;
      const visual = nodeStyles[n.id];
      if (!visual) return null;

      const status = nodeStatusMap[n.id] || 'locked';
      const isStart = status === 'start';
      const isMastered = status === 'mastered';
      const isReady = status === 'ready';
      const isLocked = status === 'locked';
      const isLit = isStart || isMastered || isReady;
      const conns = connCounts[n.id] || 1;

      return { n, visual, lines: wrappedLabels[n.id] || [n.name], status, isStart, isMastered, isReady, isLocked, isLit, conns };
    }).filter(Boolean);
  }, [LOD.isFar, dragId, nodeStatusMap, nodeStyles, visibleNodes, wrappedLabels, connCounts]);

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
    const isLit = isStart || isMastered || isReady;

    return { visual, lines: wrappedLabels[dragId] || [n.name], isLit, isStart, isMastered, isReady, isLocked };
  }, [LOD.isFar, dragId, nodeStatusMap, nodeStyles, nodes, wrappedLabels]);

  const farNodeR = NODE_R * 0.34;

  // ── Helper: render a cosmic node at (cx, cy) ──
  // connBoost: 1.0 for 1 connection, up to ~1.4 for heavily connected nodes
  const renderNode = (cx, cy, visual, isLocked, isLit, isStart, keyPrefix, conns) => {
    const isFarNode = LOD.isFar;
    const showingLabels = LOD.showLabels;
    // Boost glow when zoomed out (no labels) — more connections = more glow
    const cb = Math.min(1.4, 1.0 + (conns - 1) * 0.08);
    const zoomOutBoost = showingLabels ? 1.0 : 1.6;
    const glowMult = cb * zoomOutBoost;

    if (isFarNode) {
      // Far mode — constellation dots
      const baseGlowR = isStart ? NODE_R * 0.5 : NODE_R * 0.4;
      const glowR = baseGlowR * Math.min(1.3, cb);
      const bodyR = isStart ? NODE_R * 0.28 : NODE_R * 0.22;
      const coreR = isStart ? NODE_R * 0.08 : NODE_R * 0.06;
      const glowA = isLocked ? 0.08 : Math.min(0.35, 0.16 * glowMult);
      const bodyA = isLocked ? 0.22 : Math.min(0.8, 0.55 * cb);
      return (
        <Group>
          {!isLocked && (
            <Group transform={[{ translateX: cx }, { translateY: cy }]}>
              <Group transform={farPulseTransform}>
                <Circle cx={0} cy={0} r={glowR} color={toRGBA(visual.stroke, glowA)} />
              </Group>
            </Group>
          )}
          {isLocked && (
            <Circle cx={cx} cy={cy} r={glowR * 0.7} color={toRGBA(visual.stroke, 0.08)} />
          )}
          <Circle cx={cx} cy={cy} r={bodyR} color={toRGBA(visual.stroke, bodyA)} />
          {!isLocked && <Circle cx={cx} cy={cy} r={coreR} color={`rgba(255,255,255,${Math.min(0.7, 0.5 * cb)})`} />}
        </Group>
      );
    }

    // Near/mid mode — cosmic energy orb
    const outerAuraR = (isStart ? NODE_R * 1.35 : NODE_R * 1.2) * Math.min(1.15, cb);
    const innerGlowR = NODE_R * 0.85;
    const bodyR = NODE_R;
    const strokeR = NODE_R - 1.5;
    const coreR = isStart ? 5 : 4;
    const baseGlowAlpha = isLocked ? 0.04 : (isStart ? 0.14 : 0.10);
    const glowAlpha = Math.min(0.28, baseGlowAlpha * glowMult);
    const auraAlpha = isStart ? 0.12 : Math.min(0.2, 0.08 * glowMult);

    return (
      <Group>
        {/* Outer aura — breathing pulse */}
        {USE_GLOW && !isLocked && (
          <Group transform={[{ translateX: cx }, { translateY: cy }]}>
            <Group transform={auraPulseTransform}>
              <Circle cx={0} cy={0} r={outerAuraR} color={toRGBA(visual.stroke, auraAlpha)} />
              <Circle cx={0} cy={0} r={innerGlowR} color={toRGBA(visual.stroke, glowAlpha)} />
            </Group>
          </Group>
        )}
        {USE_GLOW && isLocked && (
          <Circle cx={cx} cy={cy} r={NODE_R * 1.3} color={toRGBA(visual.stroke, 0.03)} />
        )}

        {/* Inner glow (locked only — unlocked is in pulse group above) */}
        {isLocked && <Circle cx={cx} cy={cy} r={innerGlowR} color={toRGBA(visual.stroke, glowAlpha)} />}

        {/* Outer ring */}
        {LOD.showOuterRing && (
          <Circle cx={cx} cy={cy} r={NODE_R + 12} style="stroke" strokeWidth={0.7}
            color={toRGBA(visual.ring, isLit ? 0.35 : 0.12)} />
        )}

        {/* Build-mode selection ring */}
        {LOD.showOuterRing && bld && connA === `${keyPrefix}` && (
          <Circle cx={cx} cy={cy} r={NODE_R + 17} style="stroke" strokeWidth={1.8} color={BRANCH_COLORS.neutral.edgeHex} />
        )}

        {/* Dark body */}
        <Circle cx={cx} cy={cy} r={bodyR} color={isLocked ? '#0C0E14' : '#0A0F1A'} />

        {/* Colored stroke ring */}
        <Circle cx={cx} cy={cy} r={strokeR} style="stroke" strokeWidth={visual.sw} color={visual.stroke} />

        {/* Bright core highlight */}
        {!isLocked && (
          <Circle cx={cx} cy={cy} r={coreR} color={isStart ? 'rgba(255,255,255,0.55)' : `rgba(255,255,255,${Math.min(0.5, 0.35 * cb)})`} />
        )}
        {isLocked && (
          <Circle cx={cx} cy={cy} r={3} color="rgba(100,100,120,0.15)" />
        )}
      </Group>
    );
  };

  return (
    <Canvas style={{ width: canvasSize.width, height: canvasSize.height }}>
      {/* Deep space background */}
      <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} color="#000000" />

      <Group transform={sceneTransform}>
        {/* Stars */}
        {spaceStars.map((s, i) => (
          <Circle key={`s${i}`} cx={s.x} cy={s.y} r={s.r} color={s.color} opacity={s.opacity} />
        ))}

        {/* ── Edges — energy connections ── */}
        {edgeSegments.map((edge) => {
          const isMastered = edge.status === 'mastered';
          const isReady = edge.status === 'ready';
          const isLocked = edge.status === 'locked';
          const w = isMastered ? edgeVisual.masteredW : isReady ? edgeVisual.readyW : edgeVisual.lockedW;
          const edgeBoost = LOD.showLabels ? 1.0 : 1.4;
          const mainAlpha = isLocked ? 0.3 : (isMastered ? Math.min(1, 0.85 * edgeBoost) : Math.min(0.85, 0.6 * edgeBoost));
          const mainColor = isLocked
            ? 'rgba(40,50,70,0.3)'
            : toRGBA(edge.branchColor.edgeHex, mainAlpha);
          const dashIntervals = LOD.isFar ? [7, 8] : [11, 9];
          const glowAlpha = isMastered ? Math.min(0.3, 0.18 * edgeBoost) : Math.min(0.2, 0.10 * edgeBoost);

          return (
            <Group key={edge.id}>
              {/* Edge glow underneath */}
              {!isLocked && (
                <Path
                  path={edge.path}
                  style="stroke"
                  strokeWidth={w + (isMastered ? 6 : 3)}
                  color={toRGBA(edge.branchColor.glowHex || edge.branchColor.main, glowAlpha)}
                  strokeCap="round"
                />
              )}

              {/* Main edge line */}
              <Path path={edge.path} style="stroke" strokeWidth={w} color={mainColor} strokeCap="round">
                {!isMastered && !bld && <DashPathEffect intervals={dashIntervals} />}
              </Path>
            </Group>
          );
        })}

        {/* ── Nodes — cosmic energy orbs ── */}
        {nodeRenderData.map((item) => {
          const { n, visual, lines, isLocked, isLit, isStart, conns } = item;
          const rx = n.x;
          const ry = n.y;

          return (
            <Group key={n.id}>
              {renderNode(rx, ry, visual, isLocked, isLit, isStart, n.id, conns)}

              {/* Labels */}
              {LOD.showLabels && labelFont && lines.map((ln, li) => {
                const tw = labelFont.measureText(ln).width;
                const x = rx - tw / 2;
                const y = ry + 5 + (li - ((lines.length - 1) / 2)) * 14;
                const mainColor = isLit ? '#E2E6EE' : '#6A6A76';
                return (
                  <Group key={`${n.id}_${li}`}>
                    <SkiaText x={x + 0.7} y={y + 0.7} text={ln} font={labelFont} color="rgba(0,0,0,0.9)" />
                    <SkiaText x={x} y={y} text={ln} font={labelFont} color={mainColor} />
                  </Group>
                );
              })}
            </Group>
          );
        })}

        {/* ── Dragged node ── */}
        {draggedNodeMeta !== null && (
          <Group transform={draggedTransform}>
            {renderNode(0, 0, draggedNodeMeta.visual, draggedNodeMeta.isLocked, draggedNodeMeta.isLit, draggedNodeMeta.isStart, '__drag', connCounts[dragId] || 1)}

            {LOD.showLabels && labelFont && draggedNodeMeta.lines.map((ln, li) => {
              const tw = labelFont.measureText(ln).width;
              const mainColor = draggedNodeMeta.isLit ? '#E2E6EE' : '#6A6A76';
              const y = 5 + (li - ((draggedNodeMeta.lines.length - 1) / 2)) * 14;
              const x = -tw / 2;
              return (
                <Group key={`dl_${li}`}>
                  <SkiaText x={x + 0.7} y={y + 0.7} text={ln} font={labelFont} color="rgba(0,0,0,0.9)" />
                  <SkiaText x={x} y={y} text={ln} font={labelFont} color={mainColor} />
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
