import React, { useMemo, useRef } from 'react';
import {
  Blur,
  Atlas,
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
import { NODE_R, USE_GLOW, GLOW_QUALITY } from '../../constants/tree';
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
  const { mode, treeMetrics } = nodeStyles.__theme;
  const labelFont = useMemo(() => matchFont({ fontSize: 11, fontStyle: 'bold' }), []);

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

  const dustAtlas = useMemo(() => {
    const W = 3600;
    const H = 3600;
    const N = 900;
    const rand = mulberry32(1337);
    const spriteSize = 8;
    const surface = Skia.Surface.MakeOffscreen(spriteSize, spriteSize);
    const c = surface.getCanvas();
    c.clear(Skia.Color('rgba(0,0,0,0)'));
    const p = Skia.Paint();
    p.setColor(Skia.Color('rgba(255,255,255,0.12)'));
    c.drawRect(Skia.XYWHRect(0, 0, spriteSize, spriteSize), p);
    const image = surface.makeImageSnapshot();
    const spriteRect = Skia.XYWHRect(0, 0, spriteSize, spriteSize);
    const sprites = new Array(N);
    const transforms = new Array(N);

    for (let i = 0; i < N; i += 1) {
      const x = (rand() - 0.5) * W;
      const y = (rand() - 0.5) * H;
      const s = 0.45 + rand() * 0.9;
      sprites[i] = spriteRect;
      transforms[i] = Skia.RSXform(s, 0, x, y);
    }

    return { image, sprites, transforms };
  }, []);

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

      const useRealBlur = !isFarMode
        && !isInteracting
        && LOD.showNodeGlowBlur
        && USE_GLOW
        && (isStart || isMastered);
      const useFakeGlow = !isFarMode && USE_GLOW && (isReady || (isLit && !useRealBlur));
      const showPremiumNearStack = !isFarMode;

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
        useRealBlur,
        useFakeGlow,
        showPremiumNearStack,
      };
    }).filter(Boolean);
  }, [LOD.isFar, LOD.showNodeGlowBlur, dragId, isInteracting, nodeStatusMap, nodeStyles, visibleNodes, wrappedLabels]);

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
      useRealBlur: !LOD.isFar && !isInteracting && LOD.showNodeGlowBlur && USE_GLOW && (isStart || isMastered),
      useFakeGlow: !LOD.isFar && USE_GLOW && (isReady || (isLit && !(isStart || isMastered))),
    };
  }, [LOD.isFar, LOD.showNodeGlowBlur, dragId, isInteracting, nodeStatusMap, nodeStyles, nodes, wrappedLabels]);

  const farNodeR = NODE_R * 0.34;

  return (
    <Canvas style={{ width: canvasSize.width, height: canvasSize.height }}>
      <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} color={mode.background.panel} />
      <Circle cx={canvasSize.width / 2} cy={canvasSize.height / 2} r={Math.min(canvasSize.width, canvasSize.height) * 0.36} color={toRGBA(mode.tree.ambientBloom, treeMetrics.opacity.centralBloom * mode.tree.glowStrength)}>
        {!isInteracting && <Blur blur={LOD.isFar ? 18 : 34} />}
      </Circle>
      <Group transform={sceneTransform}>
        {LOD.showDust && !isInteracting && (
          <Atlas image={dustAtlas.image} sprites={dustAtlas.sprites} transforms={dustAtlas.transforms} />
        )}

        {edgeSegments.map((edge) => {
          const isMastered = edge.status === 'mastered';
          const isReady = edge.status === 'ready';
          const isLocked = edge.status === 'locked';
          const width = isMastered ? edgeVisual.masteredW : isReady ? edgeVisual.readyW : edgeVisual.lockedW;
          const opacityBase = isMastered ? edgeVisual.masteredO : isReady ? edgeVisual.readyO : edgeVisual.lockedO;
          const mainColor = isLocked
            ? toRGBA(mode.tree.inactiveEdge, opacityBase)
            : toRGBA(edge.branchColor.edgeHex, Math.min(treeMetrics.opacity.activeEdge, opacityBase + (isReady ? 0.06 : 0.08)));
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
            isReady,
            isLocked,
            isLit,
            useRealBlur,
            useFakeGlow,
            showPremiumNearStack,
          } = item;

          const rx = n.x;
          const ry = n.y;
          const lh = 12;
          const isFarNode = LOD.isFar;
          const renderR = isFarNode ? farNodeR : NODE_R;
          const nodeStrokeWidth = isFarNode ? Math.max(0.8, visual.sw - 0.5) : visual.sw;
          const auraOpacity = isLocked ? (isFarNode ? 0.18 : 0.11) : (isReady ? 0.26 : 0.22);
          const auraColor = toRGBA(visual.stroke, auraOpacity);
          const auraR = isFarNode ? NODE_R * 0.74 : (isLit ? NODE_R * 1.02 : NODE_R * 0.9);
          const showSpecular = LOD.showNodeHighlight && !isInteracting;
          const showInnerRing = LOD.showInnerRing && !isInteracting;

          return (
            <Group key={n.id}>
              {showPremiumNearStack && (
                <Circle cx={rx} cy={ry} r={NODE_R * 1.22} color={visual.ambient || toRGBA(visual.stroke, 0.03)} />
              )}

              {LOD.showOuterRing && (
                <Circle cx={rx} cy={ry} r={NODE_R + 13} style="stroke" strokeWidth={1.1} color={visual.ring} />
              )}

              {LOD.showOuterRing && bld && connA === n.id && (
                <Circle cx={rx} cy={ry} r={NODE_R + 16} style="stroke" strokeWidth={1.8} color={BRANCH_COLORS.neutral.edgeHex} />
              )}

              {USE_GLOW && <Circle cx={rx} cy={ry} r={auraR} color={auraColor} />}

              {useFakeGlow && (
                <Group>
                  <Circle cx={rx} cy={ry} r={NODE_R * 1.36} color={toRGBA(visual.glowOuter || visual.stroke, 0.15)} />
                  <Circle cx={rx} cy={ry} r={NODE_R * 1.04} color={toRGBA(visual.glowInner || visual.stroke, 0.12)} />
                </Group>
              )}

              {useRealBlur && (
                <Group>
                  <Circle cx={rx} cy={ry} r={NODE_R * 1.04} color={visual.glowOuter}>
                    <Blur blur={GLOW_QUALITY === 'high' ? 18 : 12} />
                  </Circle>
                  <Circle cx={rx} cy={ry} r={NODE_R * 0.76} color={visual.glowInner}>
                    <Blur blur={4.6} />
                  </Circle>
                </Group>
              )}

              {isFarNode ? (
                <Group>
                  <Circle cx={rx} cy={ry} r={NODE_R * 0.43} color={visual.farAura || toRGBA(visual.stroke, 0.16)} />
                  <Circle cx={rx} cy={ry} r={NODE_R * 0.28} color={visual.farBody || toRGBA(visual.stroke, 0.36)} />
                  <Circle cx={rx} cy={ry} r={NODE_R * 0.13} color={visual.farCore || toRGBA(visual.ring, 0.56)} />
                  <Circle cx={rx} cy={ry} r={NODE_R * 0.30} style="stroke" strokeWidth={0.72} color={toRGBA(visual.stroke, 0.5)} />
                </Group>
              ) : (
                <Group>
                  <Circle cx={rx} cy={ry} r={renderR + 2.4} color={visual.outerRim} />
                  <Circle cx={rx} cy={ry} r={renderR + 0.1} color={visual.fill} opacity={visual.opacity} />
                  <Circle cx={rx} cy={ry} r={renderR - 4.6} color={visual.innerFill} opacity={0.95} />
                  <Circle cx={rx} cy={ry} r={renderR - 6.7} style="stroke" strokeWidth={nodeStrokeWidth} color={visual.stroke} opacity={visual.opacity} />
                  {showInnerRing && (
                    <Circle cx={rx} cy={ry} r={NODE_R - 13.4} style="stroke" strokeWidth={0.95} color={visual.innerRing || visual.ring} opacity={0.58} />
                  )}
                  {showSpecular && (
                    <Circle cx={rx - 10} cy={ry - 11} r={NODE_R * 0.13} color={visual.specular || toRGBA(mode.text.primary, 0.22)} />
                  )}
                </Group>
              )}

              {LOD.showLabels && lines.map((ln, li) => {
                const x = rx - (ln.length * 3.05);
                const y = ry + 4 + (li - ((lines.length - 1) / 2)) * lh;
                const mainColor = isLit ? mode.tree.labelActive : mode.tree.labelInactive;
                const glowColor = isLit ? toRGBA(visual.stroke, 0.46) : toRGBA(mode.tree.inactiveEdge, 0.2);
                return (
                  <Group key={`${n.id}_${li}`}>
                    <SkiaText x={x} y={y} text={ln} font={labelFont} color={glowColor} />
                    <SkiaText x={x} y={y} text={ln} font={labelFont} color={mainColor} />
                  </Group>
                );
              })}
            </Group>
          );
        })}

        {draggedNodeMeta !== null && (
          <Group transform={draggedTransform}>
            {LOD.showOuterRing && (
              <Circle cx={0} cy={0} r={NODE_R + 13} style="stroke" strokeWidth={1.1} color={draggedNodeMeta.visual.ring} />
            )}
            {USE_GLOW && <Circle cx={0} cy={0} r={NODE_R * 1.04} color={toRGBA(draggedNodeMeta.visual.stroke, 0.2)} />}

            {draggedNodeMeta.useFakeGlow && (
              <Group>
                <Circle cx={0} cy={0} r={NODE_R * 1.36} color={toRGBA(draggedNodeMeta.visual.glowOuter || draggedNodeMeta.visual.stroke, 0.15)} />
                <Circle cx={0} cy={0} r={NODE_R * 1.04} color={toRGBA(draggedNodeMeta.visual.glowInner || draggedNodeMeta.visual.stroke, 0.12)} />
              </Group>
            )}

            {draggedNodeMeta.useRealBlur && (
              <Group>
                <Circle cx={0} cy={0} r={NODE_R * 1.04} color={draggedNodeMeta.visual.glowOuter}>
                  <Blur blur={GLOW_QUALITY === 'high' ? 18 : 12} />
                </Circle>
                <Circle cx={0} cy={0} r={NODE_R * 0.76} color={draggedNodeMeta.visual.glowInner}>
                  <Blur blur={4.6} />
                </Circle>
              </Group>
            )}

            {LOD.isFar ? (
              <Group>
                <Circle cx={0} cy={0} r={NODE_R * 0.43} color={draggedNodeMeta.visual.farAura || toRGBA(draggedNodeMeta.visual.stroke, 0.16)} />
                <Circle cx={0} cy={0} r={NODE_R * 0.28} color={draggedNodeMeta.visual.farBody || toRGBA(draggedNodeMeta.visual.stroke, 0.36)} />
                <Circle cx={0} cy={0} r={NODE_R * 0.13} color={draggedNodeMeta.visual.farCore || toRGBA(draggedNodeMeta.visual.ring, 0.56)} />
                <Circle cx={0} cy={0} r={NODE_R * 0.30} style="stroke" strokeWidth={0.72} color={toRGBA(draggedNodeMeta.visual.stroke, 0.5)} />
              </Group>
            ) : (
              <Group>
                <Circle cx={0} cy={0} r={NODE_R + 2.4} color={draggedNodeMeta.visual.outerRim} />
                <Circle cx={0} cy={0} r={NODE_R + 0.1} color={draggedNodeMeta.visual.fill} opacity={draggedNodeMeta.visual.opacity} />
                <Circle cx={0} cy={0} r={NODE_R - 4.6} color={draggedNodeMeta.visual.innerFill} opacity={0.95} />
                <Circle cx={0} cy={0} r={NODE_R - 6.7} style="stroke" strokeWidth={draggedNodeMeta.visual.sw} color={draggedNodeMeta.visual.stroke} opacity={draggedNodeMeta.visual.opacity} />
                {LOD.showInnerRing && !isInteracting && (
                  <Circle cx={0} cy={0} r={NODE_R - 13.4} style="stroke" strokeWidth={0.95} color={draggedNodeMeta.visual.innerRing || draggedNodeMeta.visual.ring} opacity={0.58} />
                )}
                {LOD.showNodeHighlight && !isInteracting && (
                  <Circle cx={-10} cy={-11} r={NODE_R * 0.13} color={draggedNodeMeta.visual.specular || 'rgba(255,255,255,0.22)'} />
                )}
              </Group>
            )}

            {LOD.showLabels && draggedNodeMeta.lines.map((ln, li) => {
              const glowColor = draggedNodeMeta.isLit ? toRGBA(draggedNodeMeta.visual.stroke, 0.46) : toRGBA(mode.tree.inactiveEdge, 0.2);
              const mainColor = draggedNodeMeta.isLit ? mode.tree.labelActive : mode.tree.labelInactive;
              const y = 4 + (li - ((draggedNodeMeta.lines.length - 1) / 2)) * 12;
              const x = -(ln.length * 3.05);
              return (
                <Group key={`dl_${li}`}>
                  <SkiaText x={x} y={y} text={ln} font={labelFont} color={glowColor} />
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
