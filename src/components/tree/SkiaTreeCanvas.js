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
} from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { BRANCH_COLORS } from '../../theme/colors';
import { NODE_R, USE_GLOW } from '../../constants/tree';
import { resolveEdgeBranch, toRGBA } from '../../utils/treeUtils';
import { mulberry32, buildEdgePath } from '../../utils/skiaTreeUtils';

const BG_COLOR = '#000000';

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
    const dustColors = ['#ffffff', '#fbfdff', '#f4f8ff', '#edf4ff', '#fff5e8'];
    const starColors = ['#ffffff', '#f8fbff', '#eef5ff', '#fff4df', '#eefdf7', '#f7efff', '#ffeceb'];
    const accentColors = ['#b9d8ff', '#d8c2ff', '#ffc8b8', '#bfffe0', '#ffe4a8', '#c7f1ff'];

    for (let i = 0; i < 6600; i++) {
      stars.push({
        x: cx + (rand() - 0.5) * worldWidth,
        y: cy + (rand() - 0.5) * worldHeight,
        r: 0.46 + rand() * 0.5,
        color: dustColors[Math.floor(rand() * dustColors.length)],
        opacity: 0.12 + rand() * 0.11,
      });
    }

    for (let i = 0; i < 2550; i++) {
      stars.push({
        x: cx + (rand() - 0.5) * worldWidth,
        y: cy + (rand() - 0.5) * worldHeight,
        r: 0.88 + rand() * 0.66,
        color: starColors[Math.floor(rand() * starColors.length)],
        opacity: 0.22 + rand() * 0.16,
        glowRadius: 1.9 + rand() * 1.25,
        glowOpacity: 0.025 + rand() * 0.03,
      });
    }

    for (let i = 0; i < 520; i++) {
      stars.push({
        x: cx + (rand() - 0.5) * worldWidth,
        y: cy + (rand() - 0.5) * worldHeight,
        r: 1.2 + rand() * 0.84,
        color: rand() < 0.78
          ? starColors[Math.floor(rand() * starColors.length)]
          : accentColors[Math.floor(rand() * accentColors.length)],
        opacity: 0.34 + rand() * 0.16,
        glowRadius: 2.9 + rand() * 1.8,
        glowOpacity: 0.04 + rand() * 0.045,
      });
    }

    for (let i = 0; i < 120; i++) {
      const color = accentColors[Math.floor(rand() * accentColors.length)];
      stars.push({
        x: cx + (rand() - 0.5) * worldWidth,
        y: cy + (rand() - 0.5) * worldHeight,
        r: 1.45 + rand() * 0.9,
        color,
        opacity: 0.26 + rand() * 0.12,
        glowRadius: 4.2 + rand() * 2.4,
        glowOpacity: 0.028 + rand() * 0.024,
      });
    }

    return stars;
  }, [starBounds]);

  const visibleStars = useMemo(() => {
    if (!visibleBounds) return spaceStars;

    const pad = LOD.isFar ? 220 : 320;
    const left = visibleBounds.left - pad;
    const right = visibleBounds.right + pad;
    const top = visibleBounds.top - pad;
    const bottom = visibleBounds.bottom + pad;
    const brightNodes = visibleNodes.filter((node) => {
      const status = nodeStatusMap[node.id];
      return status === 'start' || status === 'mastered' || status === 'ready';
    });

    return spaceStars.filter((star) => {
      if (!(star.x >= left && star.x <= right && star.y >= top && star.y <= bottom)) return false;
      return !brightNodes.some((node) => Math.hypot(node.x - star.x, node.y - star.y) < NODE_R * 0.18);
    });
  }, [LOD.isFar, nodeStatusMap, spaceStars, visibleBounds, visibleNodes]);

  const regionalGlowFields = useMemo(() => {
    const buildCluster = (statuses, color, baseRadius, opacityScale) => {
      const points = visibleNodes.filter((node) => statuses.includes(nodeStatusMap[node.id]));
      if (!points.length) return null;

      let weightSum = 0;
      let cx = 0;
      let cy = 0;
      for (const node of points) {
        const status = nodeStatusMap[node.id];
        const weight = status === 'start' ? 1.9 : status === 'mastered' ? 1.35 : 1.1;
        weightSum += weight;
        cx += node.x * weight;
        cy += node.y * weight;
      }

      cx /= weightSum;
      cy /= weightSum;

      let maxDist = 0;
      for (const node of points) {
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
      buildCluster(['start', 'mastered'], '#34D366', 240, 0.42),
      buildCluster(['ready'], '#FACC15', 220, 0.34),
    ].filter(Boolean);
  }, [nodeStatusMap, visibleNodes]);

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
    };
  }).filter(Boolean), [bld, nodeMap, nodeStatusMap, visibleEdges]);

  const edgeSegments = useMemo(() => {
    const cache = edgePathCache.current;
    const seen = new Set();

    const segments = edgeData.map(({
      id, fromNode, toNode, status, branchColor,
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
    const isLit = isStart || isMastered || isReady;

    return {
      n,
      visual,
      lines: wrappedLabels[n.id] || [n.name],
      isStart,
      isMastered,
      isReady,
      isLocked,
      isLit,
    };
  }).filter(Boolean), [dragId, nodeStatusMap, nodeStyles, visibleNodes, wrappedLabels]);

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
    const isLit = isStart || isMastered || isReady;

    return {
      visual,
      lines: wrappedLabels[dragId] || [n.name],
      isStart,
      isMastered,
      isReady,
      isLocked,
      isLit,
    };
  }, [dragId, nodeStatusMap, nodeStyles, nodes, wrappedLabels]);

  const farNodeR = NODE_R * 0.34;
  const starOpacityScale = LOD.isNear ? 1.08 : LOD.isMid ? 1 : 0.92;

  const renderNodeShell = (meta, x, y, isFarNode) => {
    const renderR = isFarNode ? farNodeR : meta.isStart ? NODE_R * 1.14 : NODE_R;
    const primaryRingR = isFarNode ? NODE_R * 0.3 : renderR - 1.5;
    const haloRingR = isFarNode ? NODE_R * 0.43 : renderR + (meta.isStart ? 18 : 12);
    const innerGlowR = isFarNode ? NODE_R * 0.38 : renderR * (meta.isStart ? 1.28 : 1.18);
    const outerGlowR = isFarNode ? NODE_R * 0.48 : renderR * (meta.isStart ? 1.52 : 1.36);
    const ambientR = isFarNode ? NODE_R * 0.54 : renderR * (meta.isStart ? 2.08 : 1.64);
    const cx = x;
    const cy = y;

    if (isFarNode) {
      return (
        <Group>
          <Circle cx={cx} cy={cy} r={NODE_R * 0.43} color={meta.visual.farAura || toRGBA(meta.visual.stroke, 0.14)} />
          <Circle cx={cx} cy={cy} r={NODE_R * 0.28} color={meta.visual.farBody || toRGBA(meta.visual.stroke, 0.28)} />
          <Circle cx={cx} cy={cy} r={NODE_R * 0.13} color={meta.visual.farCore || toRGBA(meta.visual.ring, 0.44)} />
          <Circle cx={cx} cy={cy} r={NODE_R * 0.30} style="stroke" strokeWidth={0.72} color={toRGBA(meta.visual.stroke, 0.42)} />
        </Group>
      );
    }

    return (
      <Group>
        {USE_GLOW && !meta.isLocked && (
          <Circle cx={cx} cy={cy} r={ambientR} color={meta.visual.ambient || toRGBA(meta.visual.stroke, meta.isStart ? 0.05 : 0.03)} />
        )}
        {USE_GLOW && !meta.isLocked && (
          <Circle cx={cx} cy={cy} r={outerGlowR} color={meta.visual.glowOuter || toRGBA(meta.visual.stroke, meta.isStart ? 0.1 : 0.07)} />
        )}
        {USE_GLOW && !meta.isLocked && (
          <Circle cx={cx} cy={cy} r={innerGlowR} color={meta.visual.glowInner || toRGBA(meta.visual.ring, meta.isStart ? 0.16 : 0.12)} />
        )}

        {LOD.showOuterRing && (
          <Circle
            cx={cx}
            cy={cy}
            r={haloRingR}
            style="stroke"
            strokeWidth={meta.isStart ? 1.12 : 0.82}
            color={meta.visual.outerRim || toRGBA(meta.visual.ring, meta.isLit ? 0.24 : 0.1)}
          />
        )}

        {LOD.showOuterRing && bld && connA === meta.n?.id && (
          <Circle cx={cx} cy={cy} r={NODE_R + 17} style="stroke" strokeWidth={1.8} color={BRANCH_COLORS.neutral.edgeHex} />
        )}

        <Circle cx={cx} cy={cy} r={renderR} color={meta.visual.fill || (meta.isLocked ? '#13100E' : '#091018')} />
        {!meta.isLocked && (
          <Circle cx={cx} cy={cy} r={renderR - 4.2} color={meta.visual.innerFill || '#0B1320'} />
        )}
        {!meta.isLocked && (
          <Circle cx={cx} cy={cy} r={Math.max(renderR - 17, renderR * 0.16)} color={meta.visual.core || 'rgba(255,255,255,0.03)'} />
        )}
        <Circle cx={cx} cy={cy} r={renderR - 4.9} style="stroke" strokeWidth={0.72} color={meta.visual.innerRingSoft || toRGBA(meta.visual.ring, meta.isLocked ? 0.08 : 0.22)} />
        <Circle
          cx={cx}
          cy={cy}
          r={primaryRingR}
          style="stroke"
          strokeWidth={meta.isStart ? meta.visual.sw + 0.38 : meta.visual.sw}
          color={meta.visual.stroke}
        />
        {!meta.isLocked && (
          <Circle
            cx={cx}
            cy={cy}
            r={primaryRingR - 4}
            style="stroke"
            strokeWidth={meta.isStart ? 0.95 : 0.74}
            color={meta.visual.innerRing || toRGBA(meta.visual.ring, meta.isStart ? 0.32 : 0.22)}
          />
        )}
      </Group>
    );
  };

  return (
    <Canvas style={{ width: canvasSize.width, height: canvasSize.height }}>
      <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} color={BG_COLOR} />

      <Group transform={sceneTransform}>
        {regionalGlowFields.map((glow, index) => (
          <Group key={`glow_${index}`}>
            <Circle cx={glow.cx} cy={glow.cy} r={glow.radius * 1.16} color={toRGBA(glow.color, 0.018 * glow.opacityScale)} />
            <Circle cx={glow.cx} cy={glow.cy} r={glow.radius * 0.82} color={toRGBA(glow.color, 0.03 * glow.opacityScale)} />
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

          return (
            <Group key={edge.id}>
              {LOD.showEdgeGlow && !isInteracting && !bld && !isLocked && (
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

        {nodeRenderData.map((item) => {
          const rx = item.n.x;
          const ry = item.n.y;
          const isFarNode = LOD.isFar;

          return (
            <Group key={item.n.id}>
              {renderNodeShell(item, rx, ry, isFarNode)}

              {LOD.showLabels && labelFont && item.lines.map((line, lineIndex) => {
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

        {draggedNodeMeta !== null && (
          <Group transform={draggedTransform}>
            {renderNodeShell(draggedNodeMeta, 0, 0, LOD.isFar)}

            {LOD.showLabels && labelFont && draggedNodeMeta.lines.map((line, lineIndex) => {
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
