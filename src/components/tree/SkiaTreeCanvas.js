import React, { useMemo, useRef } from 'react';
import {
  Blur,
  Atlas,
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Path,
  Skia,
  Text as SkiaText,
  matchFont,
} from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { BRANCH_COLORS } from '../../theme/colors';
import { NODE_R, USE_GLOW, GLOW_QUALITY } from '../../constants/tree';
import { resolveBranch, toRGBA } from '../../utils/treeUtils';
import { mulberry32, buildEdgePath } from '../../utils/skiaTreeUtils';

const SkiaTreeCanvas = React.memo(function SkiaTreeCanvas({
  nodes, visibleNodes, visibleEdges, nodeStatusMap, wrappedLabels,
  txV, tyV, scV,
  dragId, dragXV, dragYV,
  LOD, edgeVisual,
  bld, connA, isInteracting,
  canvasSize, nodeStyles,
}) {
  const labelFont = useMemo(() => matchFont({ fontSize: 10, fontStyle: 'bold' }), []);
  const sceneTransform = useDerivedValue(() => ([
    { translateX: txV.value },
    { translateY: tyV.value },
    { scale: scV.value },
  ]), []);

  const draggedTransform = useDerivedValue(() => ([
    { translateX: dragXV.value },
    { translateY: dragYV.value },
  ]), []);

  const draggedNodeMeta = useMemo(() => {
    if (!dragId) return null;
    const n = nodes.find((nn) => nn.id === dragId);
    if (!n) return null;
    const visual = nodeStyles[dragId];
    if (!visual) return null;
    const lines = wrappedLabels[dragId] || [n.name];
    const status = nodeStatusMap[dragId] || 'locked';
    const isLit = status === 'start' || status === 'mastered' || status === 'ready';
    const isReady = status === 'ready';
    const auraColor = status === 'locked'
      ? visual.glowOuter
      : toRGBA(visual.stroke, isReady ? 0.24 : 0.18);
    const auraR = isLit ? NODE_R * 1.16 : NODE_R * 1.06;
    return {
      visual, lines, isLit, auraColor, auraR,
    };
  }, [dragId, nodes, nodeStyles, wrappedLabels, nodeStatusMap]);

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
    const status = bld ? 'locked' : (fromLit && toLit ? 'mastered' : ((fromLit && !toLit) || toReady ? 'ready' : 'locked'));
    const branch = resolveBranch(tn);
    const branchColor = BRANCH_COLORS[branch] || BRANCH_COLORS.neutral;
    return {
      id: `${e.from}_${e.to}_${idx}`, fn, tn, status, branchColor,
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
        id, path, status, branchColor,
      };
    });

    for (const key of cache.keys()) {
      if (!seen.has(key)) cache.delete(key);
    }

    return segments;
  }, [edgeData]);

  const farNodeR = NODE_R * 0.34;
  return (
    <Canvas style={{ width: canvasSize.width, height: canvasSize.height }}>
      <Group transform={sceneTransform}>
        {LOD.showDust && <Atlas image={dustAtlas.image} sprites={dustAtlas.sprites} transforms={dustAtlas.transforms} />}
        {edgeSegments.map((edge) => {
          const w = edge.status === 'mastered' ? edgeVisual.masteredW : edge.status === 'ready' ? edgeVisual.readyW : edgeVisual.lockedW;
          const o = edge.status === 'mastered' ? edgeVisual.masteredO : edge.status === 'ready' ? edgeVisual.readyO : edgeVisual.lockedO;
          const boostedO = Math.min(0.95, o + (edge.status === 'locked' ? 0.06 : 0.12));
          const color = edge.status === 'locked'
            ? toRGBA(edge.branchColor.edgeHex, Math.min(0.52, boostedO * 0.78))
            : toRGBA(edge.branchColor.edgeHex, boostedO);
          return (
            <Group key={edge.id}>
              {LOD.showEdgeGlow && !isInteracting && edge.status !== 'locked' && (
                <Path path={edge.path} style="stroke" strokeWidth={w + 4.8} color={toRGBA(edge.branchColor.main, edge.status === 'mastered' ? 0.32 : 0.22)} strokeCap="round" />
              )}
              {edge.status === 'mastered' && LOD.interactionTier !== 'heavy' && <Path path={edge.path} style="stroke" strokeWidth={w + 1.5} color={toRGBA(edge.branchColor.main, LOD.interactionTier === 'medium' ? 0.28 : 0.38)} strokeCap="round" />}
              <Path path={edge.path} style="stroke" strokeWidth={w} color={color} strokeCap="round">
                {LOD.useDashedReady && edge.status === 'ready' && !bld && <DashPathEffect intervals={[12, 10]} />}
              </Path>
            </Group>
          );
        })}

        {visibleNodes.map((n) => {
          if (n.id === dragId) return null;
          const visual = nodeStyles[n.id];
          if (!visual) return null;
          const rx = n.x;
          const ry = n.y;
          const lines = wrappedLabels[n.id] || [n.name];
          const lh = 13;
          const sy = ry + NODE_R + 14;
          const status = nodeStatusMap[n.id] || 'locked';
          const isLit = status === 'start' || status === 'mastered' || status === 'ready';
          const isReady = status === 'ready';
          const renderR = LOD.isFar ? farNodeR : NODE_R;
          const nodeStrokeWidth = LOD.isFar ? Math.max(0.8, visual.sw - 0.5) : visual.sw;
          const auraOpacity = status === 'locked' ? (LOD.isFar ? 0.12 : 0.10) : (isReady ? 0.24 : 0.18);
          const auraColor = toRGBA(visual.stroke, auraOpacity);
          const auraR = LOD.isFar ? NODE_R * 0.90 : (isLit ? NODE_R * 1.16 : NODE_R * 1.08);
          return (
            <Group key={n.id}>
              {LOD.showOuterRing && <Circle cx={rx} cy={ry} r={NODE_R + 13} style="stroke" strokeWidth={1.1} color={visual.ring} />}
              {LOD.showOuterRing && bld && connA === n.id && <Circle cx={rx} cy={ry} r={NODE_R + 16} style="stroke" strokeWidth={1.8} color={BRANCH_COLORS.neutral.edgeHex} />}
              {USE_GLOW && <Circle cx={rx} cy={ry} r={auraR} color={auraColor} />}
              {USE_GLOW && LOD.isFar && <Circle cx={rx} cy={ry} r={NODE_R * 0.50} style="stroke" strokeWidth={0.9} color={toRGBA(visual.stroke, 0.30)} />}
              {LOD.showNodeGlowBlur && !isInteracting && USE_GLOW && isLit && (
                <Group>
                  <Circle cx={rx} cy={ry} r={NODE_R * 1.10} color={visual.glowOuter}><Blur blur={GLOW_QUALITY === 'high' ? 18 : 12} /></Circle>
                  <Circle cx={rx} cy={ry} r={NODE_R * 0.82} color={visual.glowInner}><Blur blur={5} /></Circle>
                </Group>
              )}
              <Circle cx={rx} cy={ry} r={renderR + 2} color={visual.outerRim} />
              <Circle cx={rx} cy={ry} r={renderR} color={visual.fill} opacity={visual.opacity} />
              {!LOD.simplifyNodeStack && <Circle cx={rx} cy={ry} r={renderR - 3} color={visual.innerFill} opacity={0.92} />}
              <Circle cx={rx} cy={ry} r={renderR - 7} style="stroke" strokeWidth={nodeStrokeWidth} color={visual.stroke} opacity={visual.opacity} />
              {LOD.showInnerRing && <Circle cx={rx} cy={ry} r={NODE_R - 13} style="stroke" strokeWidth={1} color={visual.ring} opacity={0.55} />}
              {LOD.showNodeHighlight && <Circle cx={rx - 10} cy={ry - 11} r={NODE_R * 0.13} color="rgba(255,255,255,0.22)" />}
              {LOD.showLabels && !isInteracting && lines.map((ln, li) => {
                const x = rx - (ln.length * 2.8);
                const y = sy + li * lh;
                const mainColor = isLit ? '#F8FAFC' : '#8898AA';
                const glow1 = isLit ? toRGBA(visual.stroke, 0.28) : 'rgba(100,120,148,0.10)';
                return (
                  <Group key={`${n.id}_${li}`}>
                    <SkiaText x={x} y={y} text={ln} font={labelFont} color={glow1} />
                    <SkiaText x={x} y={y} text={ln} font={labelFont} color={mainColor} />
                  </Group>
                );
              })}
            </Group>
          );
        })}

        {draggedNodeMeta !== null && (
          <Group transform={draggedTransform}>
            {LOD.showOuterRing && <Circle cx={0} cy={0} r={NODE_R + 13} style="stroke" strokeWidth={1.1} color={draggedNodeMeta.visual.ring} />}
            {USE_GLOW && <Circle cx={0} cy={0} r={draggedNodeMeta.auraR} color={draggedNodeMeta.auraColor} />}
            <Circle cx={0} cy={0} r={NODE_R + 2} color={draggedNodeMeta.visual.outerRim} />
            <Circle cx={0} cy={0} r={NODE_R} color={draggedNodeMeta.visual.fill} opacity={draggedNodeMeta.visual.opacity} />
            {!LOD.simplifyNodeStack && <Circle cx={0} cy={0} r={NODE_R - 3} color={draggedNodeMeta.visual.innerFill} opacity={0.92} />}
            <Circle cx={0} cy={0} r={NODE_R - 7} style="stroke" strokeWidth={draggedNodeMeta.visual.sw} color={draggedNodeMeta.visual.stroke} opacity={draggedNodeMeta.visual.opacity} />
            {LOD.showInnerRing && <Circle cx={0} cy={0} r={NODE_R - 13} style="stroke" strokeWidth={1} color={draggedNodeMeta.visual.ring} opacity={0.55} />}
            {LOD.showNodeHighlight && <Circle cx={-10} cy={-11} r={NODE_R * 0.13} color="rgba(255,255,255,0.22)" />}
            {LOD.showLabels && !isInteracting && draggedNodeMeta.lines.map((ln, li) => {
              const glow1 = draggedNodeMeta.isLit ? toRGBA(draggedNodeMeta.visual.stroke, 0.28) : 'rgba(100,120,148,0.10)';
              const mainColor = draggedNodeMeta.isLit ? '#F8FAFC' : '#8898AA';
              return (
                <Group key={`dl_${li}`}>
                  <SkiaText x={-(ln.length * 2.8)} y={NODE_R + 14 + li * 13} text={ln} font={labelFont} color={glow1} />
                  <SkiaText x={-(ln.length * 2.8)} y={NODE_R + 14 + li * 13} text={ln} font={labelFont} color={mainColor} />
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
