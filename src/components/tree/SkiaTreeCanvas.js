import React, { useMemo, useRef } from 'react';
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
import { useDerivedValue } from 'react-native-reanimated';
import { BRANCH_COLORS } from '../../theme/colors';
import { NODE_R, USE_GLOW } from '../../constants/tree';
import { resolveEdgeBranch, toRGBA } from '../../utils/treeUtils';
import { mulberry32, buildEdgePath } from '../../utils/skiaTreeUtils';

// ===== BACKGROUND COLOR =====
const BG_COLOR = '#000000';
// ============================

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

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // --- Space background stars — all live in the scene so they move with pan/zoom ---
  // Dynamically sized: extends 2000 units beyond the outermost nodes in every direction.
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
    for (let i = 0; i < 2700; i++) {
      stars.push({
        x: cx + (rand() - 0.5) * W,
        y: cy + (rand() - 0.5) * H,
        r: 1 + rand() * 1.5,
        color: colors[Math.floor(rand() * 3)],
        opacity: 0.12 + rand() * 0.18,
      });
    }

    // Layer 2: Small stars — visible, scattered
    for (let i = 0; i < 1350; i++) {
      stars.push({
        x: cx + (rand() - 0.5) * W,
        y: cy + (rand() - 0.5) * H,
        r: 2 + rand() * 2,
        color: colors[Math.floor(rand() * colors.length)],
        opacity: 0.25 + rand() * 0.35,
      });
    }

    // Layer 3: Medium stars — clearly visible, some color tint
    for (let i = 0; i < 450; i++) {
      stars.push({
        x: cx + (rand() - 0.5) * W,
        y: cy + (rand() - 0.5) * H,
        r: 3 + rand() * 2.5,
        color: colors[Math.floor(rand() * colors.length)],
        opacity: 0.4 + rand() * 0.35,
      });
    }

    // Layer 4: Bright accent stars — rare, colorful, with a glow halo
    for (let i = 0; i < 135; i++) {
      const x = cx + (rand() - 0.5) * W;
      const y = cy + (rand() - 0.5) * H;
      const color = colors[3 + Math.floor(rand() * (colors.length - 3))];
      stars.push({ x, y, r: 10 + rand() * 8, color, opacity: 0.04 + rand() * 0.04 });
      stars.push({ x, y, r: 3.5 + rand() * 2.5, color, opacity: 0.7 + rand() * 0.3 });
    }

    return stars;
  }, [starBounds]);

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

    return {
      id: `${e.from}_${e.to}_${idx}`,
      fn,
      tn,
      status,
      branchColor,
    };
  }).filter(Boolean), [bld, nodeMap, nodeStatusMap, visibleEdges]);

  const edgeSegments = useMemo(() => {
    const cache = edgePathCache.current;
    const seen = new Set();

    const segments = edgeData.map(({
      id, fn, tn, status, branchColor,
    }) => {
      const key = `${fn.id}->${tn.id}:${fn.x},${fn.y}|${tn.x},${tn.y}`;
      seen.add(key);
      let path = cache.get(key);
      if (!path) {
        path = buildEdgePath(fn, tn);
        cache.set(key, path);
      }
      return {
        id,
        path,
        status,
        branchColor,
      };
    });

    for (const key of cache.keys()) {
      if (!seen.has(key)) cache.delete(key);
    }

    return segments;
  }, [edgeData]);

  const nodeRenderData = useMemo(() => {
    const isFarMode = LOD.isFar;
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

      return {
        n,
        visual,
        lines: wrappedLabels[n.id] || [n.name],
        status,
        isStart,
        isMastered,
        isReady,
        isLocked,
        isLit,
      };
    }).filter(Boolean);
  }, [LOD.isFar, dragId, nodeStatusMap, nodeStyles, visibleNodes, wrappedLabels]);

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

    return {
      visual,
      lines: wrappedLabels[dragId] || [n.name],
      isLit,
      isStart,
      isMastered,
      isReady,
      isLocked,
    };
  }, [LOD.isFar, dragId, nodeStatusMap, nodeStyles, nodes, wrappedLabels]);

  const farNodeR = NODE_R * 0.34;

  return (
    <Canvas style={{ width: canvasSize.width, height: canvasSize.height }}>
      <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} color={BG_COLOR} />

      <Group transform={sceneTransform}>
        {/* Space stars — move with the world */}
        {spaceStars.map((s, i) => (
          <Circle key={`s${i}`} cx={s.x} cy={s.y} r={s.r} color={s.color} opacity={s.opacity} />
        ))}

        {edgeSegments.map((edge) => {
          const isMastered = edge.status === 'mastered';
          const isReady = edge.status === 'ready';
          const isLocked = edge.status === 'locked';
          const width = isMastered ? edgeVisual.masteredW : isReady ? edgeVisual.readyW : edgeVisual.lockedW;
          const opacityBase = isMastered ? edgeVisual.masteredO : isReady ? edgeVisual.readyO : edgeVisual.lockedO;
          const mainColor = isLocked
            ? 'rgba(87,78,67,0.34)'
            : toRGBA(edge.branchColor.edgeHex, Math.min(0.92, opacityBase + (isReady ? 0.06 : 0.08)));
          const dashIntervals = LOD.isFar ? [7, 8] : [11, 9];

          return (
            <Group key={edge.id}>
              {isMastered && LOD.showEdgeGlow && !isInteracting && (
                <Path
                  path={edge.path}
                  style="stroke"
                  strokeWidth={width + 4.3}
                  color={toRGBA(edge.branchColor.main, 0.27)}
                  strokeCap="round"
                />
              )}

              {isMastered && LOD.interactionTier !== 'heavy' && (
                <Path
                  path={edge.path}
                  style="stroke"
                  strokeWidth={width + 1.2}
                  color={toRGBA(edge.branchColor.main, LOD.interactionTier === 'medium' ? 0.24 : 0.33)}
                  strokeCap="round"
                />
              )}

              <Path path={edge.path} style="stroke" strokeWidth={width} color={mainColor} strokeCap="round">
                {!isMastered && !bld && <DashPathEffect intervals={dashIntervals} />}
              </Path>
            </Group>
          );
        })}

        {nodeRenderData.map((item) => {
          const {
            n,
            visual,
            lines,
            isLocked,
            isLit,
          } = item;

          const rx = n.x;
          const ry = n.y;
          const isFarNode = LOD.isFar;
          const renderR = isFarNode ? farNodeR : NODE_R;

          return (
            <Group key={n.id}>
              {isFarNode ? (
                <Group>
                  <Circle cx={rx} cy={ry} r={NODE_R * 0.43} color={visual.farAura || toRGBA(visual.stroke, 0.16)} />
                  <Circle cx={rx} cy={ry} r={NODE_R * 0.28} color={visual.farBody || toRGBA(visual.stroke, 0.36)} />
                  <Circle cx={rx} cy={ry} r={NODE_R * 0.13} color={visual.farCore || toRGBA(visual.ring, 0.56)} />
                  <Circle cx={rx} cy={ry} r={NODE_R * 0.30} style="stroke" strokeWidth={0.72} color={toRGBA(visual.stroke, 0.5)} />
                </Group>
              ) : (
                <Group>
                  {/* Smooth glow — always on, no flicker */}
                  {USE_GLOW && !isLocked && (
                    <Circle cx={rx} cy={ry} r={NODE_R * 1.5} color={toRGBA(visual.stroke, 0.07)} />
                  )}
                  {USE_GLOW && (
                    <Circle cx={rx} cy={ry} r={NODE_R * 1.15} color={toRGBA(visual.stroke, isLocked ? 0.06 : 0.12)} />
                  )}

                  {/* Outer ring */}
                  {LOD.showOuterRing && (
                    <Circle cx={rx} cy={ry} r={NODE_R + 12} style="stroke" strokeWidth={0.8} color={toRGBA(visual.ring, isLit ? 0.4 : 0.2)} />
                  )}

                  {/* Build-mode selection ring */}
                  {LOD.showOuterRing && bld && connA === n.id && (
                    <Circle cx={rx} cy={ry} r={NODE_R + 17} style="stroke" strokeWidth={1.8} color={BRANCH_COLORS.neutral.edgeHex} />
                  )}

                  {/* Dark body fill */}
                  <Circle cx={rx} cy={ry} r={renderR} color={isLocked ? '#181818' : '#141a22'} />

                  {/* Main colored stroke ring */}
                  <Circle cx={rx} cy={ry} r={renderR - 1} style="stroke" strokeWidth={visual.sw} color={visual.stroke} />
                </Group>
              )}

              {LOD.showLabels && labelFont && lines.map((ln, li) => {
                const tw = labelFont.measureText(ln).width;
                const x = rx - tw / 2;
                const y = ry + 5 + (li - ((lines.length - 1) / 2)) * 14;
                const mainColor = isLit ? '#E2E6EE' : '#8A8580';
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

        {draggedNodeMeta !== null && (
          <Group transform={draggedTransform}>
            {LOD.isFar ? (
              <Group>
                <Circle cx={0} cy={0} r={NODE_R * 0.43} color={draggedNodeMeta.visual.farAura || toRGBA(draggedNodeMeta.visual.stroke, 0.16)} />
                <Circle cx={0} cy={0} r={NODE_R * 0.28} color={draggedNodeMeta.visual.farBody || toRGBA(draggedNodeMeta.visual.stroke, 0.36)} />
                <Circle cx={0} cy={0} r={NODE_R * 0.13} color={draggedNodeMeta.visual.farCore || toRGBA(draggedNodeMeta.visual.ring, 0.56)} />
                <Circle cx={0} cy={0} r={NODE_R * 0.30} style="stroke" strokeWidth={0.72} color={toRGBA(draggedNodeMeta.visual.stroke, 0.5)} />
              </Group>
            ) : (
              <Group>
                {USE_GLOW && !draggedNodeMeta.isLocked && (
                  <Circle cx={0} cy={0} r={NODE_R * 1.5} color={toRGBA(draggedNodeMeta.visual.stroke, 0.07)} />
                )}
                {USE_GLOW && (
                  <Circle cx={0} cy={0} r={NODE_R * 1.15} color={toRGBA(draggedNodeMeta.visual.stroke, draggedNodeMeta.isLocked ? 0.06 : 0.12)} />
                )}

                {LOD.showOuterRing && (
                  <Circle cx={0} cy={0} r={NODE_R + 12} style="stroke" strokeWidth={0.8} color={toRGBA(draggedNodeMeta.visual.ring, draggedNodeMeta.isLit ? 0.4 : 0.2)} />
                )}

                <Circle cx={0} cy={0} r={NODE_R} color={draggedNodeMeta.isLocked ? '#181818' : '#141a22'} />
                <Circle cx={0} cy={0} r={NODE_R - 1} style="stroke" strokeWidth={draggedNodeMeta.visual.sw} color={draggedNodeMeta.visual.stroke} />
              </Group>
            )}

            {LOD.showLabels && labelFont && draggedNodeMeta.lines.map((ln, li) => {
              const tw = labelFont.measureText(ln).width;
              const mainColor = draggedNodeMeta.isLit ? '#E2E6EE' : '#8A8580';
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
