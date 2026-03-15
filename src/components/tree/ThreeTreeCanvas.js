import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  NativeModules,
  PixelRatio,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import * as THREE from 'three';
import SkiaTreeCanvas from './SkiaTreeCanvas';
import { BRANCH_COLORS } from '../../theme/colors';
import { NODE_R } from '../../constants/tree';
import { resolveBranch, resolveEdgeBranch } from '../../utils/treeUtils';
import {
  mulberry32,
  particleSeed,
  pointOnQuadraticEdge,
  sampleQuadraticEdge,
} from '../../utils/treeGeometry';

global.THREE = global.THREE || THREE;

const TAU = Math.PI * 2;
const LABEL_WIDTH = 132;
const ANDROID_FRAME_INTERVAL_MS = 33;

function patchExpoGlPixelStore(gl) {
  if (!gl?.pixelStorei || gl.__kineticPixelStorePatched) {
    return;
  }

  const ignoredParams = new Set([
    gl.UNPACK_FLIP_Y_WEBGL,
    gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
    gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,
  ].filter((value) => typeof value === 'number'));
  const originalPixelStorei = gl.pixelStorei.bind(gl);

  // Expo GL logs for unsupported WebGL pixel store flags; our generated textures don't need them.
  gl.pixelStorei = (pname, param) => {
    if (ignoredParams.has(pname)) {
      return;
    }
    return originalPixelStorei(pname, param);
  };
  gl.__kineticPixelStorePatched = true;
}

function hasExpoGlRuntime() {
  if (Platform.OS === 'web') {
    return false;
  }

  const glObjectManager = requireOptionalNativeModule('ExponentGLObjectManager');
  const viewManagersMetadata = NativeModules?.NativeUnimoduleProxy?.viewManagersMetadata;
  return !!(glObjectManager && viewManagersMetadata?.ExponentGLView);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(t) {
  return 1 - ((1 - t) ** 3);
}

function parseColor(color, fallback = '#FFFFFF') {
  if (!color || typeof color !== 'string') {
    return { color: fallback, opacity: 1 };
  }

  const rgbaMatch = color.match(/rgba?\(([^)]+)\)/i);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(',').map((part) => Number(part.trim()));
    if (parts.length >= 3) {
      return {
        color: new THREE.Color(parts[0] / 255, parts[1] / 255, parts[2] / 255),
        opacity: parts.length >= 4 && Number.isFinite(parts[3]) ? parts[3] : 1,
      };
    }
  }

  try {
    return { color: new THREE.Color(color), opacity: 1 };
  } catch {
    return { color: new THREE.Color(fallback), opacity: 1 };
  }
}

function makeRadialTexture(size, innerStop = 0.2, outerStop = 1) {
  const data = new Uint8Array(size * size * 4);
  const half = size / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const dx = (x - half) / half;
      const dy = (y - half) / half;
      const dist = Math.sqrt((dx * dx) + (dy * dy));
      const t = clamp01((dist - innerStop) / Math.max(0.0001, outerStop - innerStop));
      const alpha = Math.round((1 - easeOutCubic(t)) * 255);
      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
      data[index + 3] = alpha;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function disposeMaterial(material) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }
  material.dispose?.();
}

function clearGroup(group) {
  if (!group) return;

  while (group.children.length) {
    const child = group.children[0];
    if (!child) continue;
    group.remove(child);
    clearGroup(child);
    child.geometry?.dispose?.();
    disposeMaterial(child.material);
  }
}

function buildWorldBounds(nodes) {
  if (!nodes.length) {
    return {
      cx: 0,
      cy: 0,
      width: 4800,
      height: 4800,
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.x < minX) minX = node.x;
    if (node.x > maxX) maxX = node.x;
    if (node.y < minY) minY = node.y;
    if (node.y > maxY) maxY = node.y;
  }

  const pad = 2200;

  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    width: Math.max(5600, (maxX - minX) + pad),
    height: Math.max(5600, (maxY - minY) + pad),
  };
}

function makePointsGeometry(points) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    positions.push(point.x, point.y, point.z || 0);
    colors.push(point.color.r, point.color.g, point.color.b);
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function createCircleMesh(shared, colorValue, opacity, radius, z = 0) {
  const { color, opacity: colorOpacity } = parseColor(colorValue);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: opacity * colorOpacity,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(shared.circleGeometry, material);
  mesh.scale.set(radius, radius, 1);
  mesh.position.z = z;
  mesh.frustumCulled = false;
  return mesh;
}

function createRingMesh(shared, colorValue, opacity, radius, z = 0) {
  const { color, opacity: colorOpacity } = parseColor(colorValue);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: opacity * colorOpacity,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(shared.ringGeometry, material);
  ring.scale.set(radius, radius, 1);
  ring.position.z = z;
  ring.frustumCulled = false;
  return ring;
}

function createGlowSprite(texture, colorValue, opacity, size, z = 0) {
  const { color, opacity: colorOpacity } = parseColor(colorValue);
  const material = new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    opacity: opacity * colorOpacity,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size, size, 1);
  sprite.position.z = z;
  sprite.frustumCulled = false;
  return sprite;
}

const TreeLabel = React.memo(function TreeLabel({
  node,
  lines,
  status,
  txV,
  tyV,
  scV,
  strokeColor,
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const scale = Math.max(0.78, Math.min(scV.value, 1.12));
    return {
      opacity: scV.value < 0.2 ? 0 : 1,
      transform: [
        { translateX: txV.value + (node.x * scV.value) - (LABEL_WIDTH / 2) },
        { translateY: tyV.value + ((node.y + (NODE_R * 1.08)) * scV.value) },
        { scale },
      ],
    };
  }, [node.x, node.y]);

  const labelColor = status === 'start' || status === 'mastered' ? '#F7F2EA' : '#D4CDC4';

  return (
    <Animated.View pointerEvents="none" style={[styles.labelWrap, animatedStyle]}>
      <Text style={[styles.labelGlow, { color: strokeColor }]}>{lines.join('\n')}</Text>
      <Text style={[styles.labelMain, { color: labelColor }]}>{lines.join('\n')}</Text>
    </Animated.View>
  );
});

const ThreeTreeCanvas = React.memo(function ThreeTreeCanvas(props) {
  const {
    nodes,
    edges,
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
    isInteracting,
    canvasSize,
    nodeStyles,
    unlockFx,
    unlockFxProgressV,
    selectedPathEdgeDepths,
  } = props;
  const runtimeModules = useMemo(() => {
    if (!hasExpoGlRuntime()) {
      return null;
    }

    try {
      const expoGl = require('expo-gl');
      const rendererModule = require('expo-three/build/Renderer');
      const GLView = expoGl?.GLView;
      const RendererClass = rendererModule?.default || rendererModule;

      if (!GLView || !RendererClass) {
        return null;
      }

      return { GLView, RendererClass };
    } catch {
      return null;
    }
  }, []);
  const [useFallback, setUseFallback] = useState(Platform.OS === 'web' || !runtimeModules);
  const readyRef = useRef(false);
  const rendererRef = useRef(null);
  const glRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const frameRef = useRef(null);
  const textureRef = useRef(null);
  const sharedRef = useRef(null);
  const rootsRef = useRef(null);
  const sceneDataRef = useRef({
    starLayers: [],
    nodeObjects: [],
    edgeObjects: [],
    unlockEffect: null,
  });
  const interactionRef = useRef(isInteracting);
  const dragRef = useRef(dragId);
  const dragMapRef = useRef({ x: 0, y: 0 });
  const unlockRef = useRef(unlockFx);
  const canvasSizeRef = useRef(canvasSize);
  const warnedMissingNativeRef = useRef(false);
  const lastFrameAtRef = useRef(0);

  useEffect(() => {
    if (!runtimeModules && !warnedMissingNativeRef.current && Platform.OS !== 'web') {
      warnedMissingNativeRef.current = true;
      console.warn('ThreeTreeCanvas falling back because expo-gl native modules are unavailable in this build.');
    }
  }, [runtimeModules]);

  useEffect(() => {
    interactionRef.current = isInteracting;
  }, [isInteracting]);

  useEffect(() => {
    dragRef.current = dragId;
  }, [dragId]);

  useEffect(() => {
    unlockRef.current = unlockFx;
  }, [unlockFx]);

  useEffect(() => {
    canvasSizeRef.current = canvasSize;
  }, [canvasSize]);

  const labelItems = useMemo(() => {
    if (!LOD.showLabels || isInteracting) {
      return [];
    }

    return visibleNodes
      .filter((node) => (nodeStatusMap[node.id] || 'locked') !== 'locked')
      .map((node) => ({
        node,
        lines: wrappedLabels[node.id] || [node.name],
        status: nodeStatusMap[node.id] || 'locked',
        strokeColor: nodeStyles[node.id]?.stroke || '#BFD9FF',
      }));
  }, [LOD.showLabels, isInteracting, nodeStatusMap, nodeStyles, visibleNodes, wrappedLabels]);

  const syncCamera = useCallback(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !camera) {
      return;
    }

    const width = Math.max(canvasSizeRef.current?.width || 1, 1);
    const height = Math.max(canvasSizeRef.current?.height || 1, 1);

    camera.left = 0;
    camera.right = width;
    camera.top = 0;
    camera.bottom = height;
    camera.near = -5000;
    camera.far = 5000;
    camera.position.set(0, 0, 1500);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(Platform.OS === 'android' ? 1 : Math.min(PixelRatio.get(), 1.5));
    renderer.setSize(width, height);
  }, []);
  const buildScene = useCallback(() => {
    const scene = sceneRef.current;
    const roots = rootsRef.current;
    const shared = sharedRef.current;
    const textures = textureRef.current;

    if (!scene || !roots || !shared || !textures) {
      return;
    }

    clearGroup(roots.starRoot);
    clearGroup(roots.worldRoot);
    clearGroup(roots.overlayRoot);

    const sceneNodes = visibleNodes.length ? visibleNodes : nodes;
    const sceneEdges = Array.isArray(visibleEdges) ? visibleEdges : edges;
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const worldBounds = buildWorldBounds(nodes);
    const rand = mulberry32(1337);
    const starLayers = [];
    const starConfigs = [
      {
        count: 260,
        size: 1.8,
        opacity: 0.18,
        z: -420,
        parallax: 0.16,
        zoomStrength: 0.06,
        colors: ['#F4F8FF', '#EDF4FF', '#FFF5E8', '#F0F4FF'],
      },
      {
        count: 110,
        size: 2.8,
        opacity: 0.26,
        z: -360,
        parallax: 0.24,
        zoomStrength: 0.12,
        colors: ['#FFFFFF', '#F8FBFF', '#EEF5FF', '#FFF4DF', '#EEFDF7'],
      },
      {
        count: 42,
        size: 4.1,
        opacity: 0.24,
        z: -320,
        parallax: 0.32,
        zoomStrength: 0.18,
        colors: ['#B9D8FF', '#D8C2FF', '#FFC8B8', '#BFFFE0', '#FFE4A8'],
      },
      {
        count: 10,
        size: 6.3,
        opacity: 0.2,
        z: -300,
        parallax: 0.4,
        zoomStrength: 0.22,
        colors: ['#C7F1FF', '#A8C8FF', '#FFB8D8', '#FFE4A8'],
      },
    ];

    for (let configIndex = 0; configIndex < starConfigs.length; configIndex += 1) {
      const config = starConfigs[configIndex];
      const points = [];
      for (let index = 0; index < config.count; index += 1) {
        const color = new THREE.Color(config.colors[Math.floor(rand() * config.colors.length)]);
        points.push({
          x: worldBounds.cx + ((rand() - 0.5) * worldBounds.width),
          y: worldBounds.cy + ((rand() - 0.5) * worldBounds.height),
          z: config.z,
          color,
        });
      }
      const geometry = makePointsGeometry(points);
      const material = new THREE.PointsMaterial({
        size: config.size,
        vertexColors: true,
        transparent: true,
        opacity: config.opacity,
        map: textures.starTexture,
        alphaTest: 0.01,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: false,
      });
      const layer = new THREE.Points(geometry, material);
      layer.frustumCulled = false;
      roots.starRoot.add(layer);
      starLayers.push({
        mesh: layer,
        config,
      });
    }

    const edgeObjects = [];
    for (let edgeIndex = 0; edgeIndex < sceneEdges.length; edgeIndex += 1) {
      const edge = sceneEdges[edgeIndex];
      const fromNode = nodeMap.get(edge.from);
      const toNode = nodeMap.get(edge.to);
      if (!fromNode || !toNode) continue;

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
      const curvePoints = sampleQuadraticEdge(fromNode, toNode, LOD.isFar ? 10 : 18)
        .map((point) => new THREE.Vector3(point.x, point.y, 0));
      const curve = new THREE.CatmullRomCurve3(curvePoints, false);
      const width = status === 'mastered'
        ? edgeVisual.masteredW
        : status === 'ready'
          ? edgeVisual.readyW
          : edgeVisual.lockedW;
      const coreRadius = Math.max(0.9, width * (LOD.isFar ? 0.24 : 0.34));
      const glowRadius = coreRadius * (status === 'mastered' ? 2.4 : status === 'ready' ? 1.92 : 1.34);
      const segments = LOD.isFar ? 7 : 10;
      const radialSegments = LOD.isFar ? 3 : 4;
      const curveGeometryGlow = new THREE.TubeGeometry(curve, segments, glowRadius, radialSegments, false);
      const curveGeometryCore = new THREE.TubeGeometry(curve, segments, coreRadius, radialSegments, false);

      const glowColor = status === 'mastered'
        ? branchColor.glow
        : status === 'ready'
          ? branchColor.main
          : 'rgba(255,255,255,0.08)';
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: parseColor(glowColor).color,
        transparent: true,
        opacity: status === 'mastered' ? 0.18 : status === 'ready' ? 0.12 : 0.05,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const coreMaterial = new THREE.MeshBasicMaterial({
        color: parseColor(status === 'locked' ? 'rgba(255,255,255,0.18)' : branchColor.edgeHex).color,
        transparent: true,
        opacity: status === 'mastered' ? 0.88 : status === 'ready' ? 0.72 : 0.18,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      const glowMesh = new THREE.Mesh(curveGeometryGlow, glowMaterial);
      const coreMesh = new THREE.Mesh(curveGeometryCore, coreMaterial);
      glowMesh.position.z = -60;
      coreMesh.position.z = -58;
      glowMesh.frustumCulled = false;
      coreMesh.frustumCulled = false;
      roots.worldRoot.add(glowMesh);
      roots.worldRoot.add(coreMesh);

      let motionOrb = null;
      if (!bld && status !== 'locked' && sceneEdges.length <= 18 && !LOD.isFar) {
        motionOrb = createGlowSprite(
          textures.glowTexture,
          status === 'mastered' ? branchColor.ring : branchColor.main,
          status === 'mastered' ? 0.74 : 0.64,
          status === 'mastered' ? 15 : 12,
          -40,
        );
        roots.overlayRoot.add(motionOrb);
      }

      let selectedGlow = null;
      const selectedDepth = selectedPathEdgeDepths?.[`${fromNode.id}->${toNode.id}`] ?? null;
      if (selectedDepth !== null && selectedDepth !== undefined && sceneEdges.length <= 18) {
        selectedGlow = new THREE.Mesh(
          new THREE.TubeGeometry(curve, segments, glowRadius * 0.86, radialSegments, false),
          new THREE.MeshBasicMaterial({
            color: parseColor(branchColor.main).color,
            transparent: true,
            opacity: 0.14,
            depthWrite: false,
            depthTest: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
          }),
        );
        selectedGlow.position.z = -59;
        selectedGlow.frustumCulled = false;
        roots.overlayRoot.add(selectedGlow);
      }

      edgeObjects.push({
        id: `${edge.from}_${edge.to}_${edgeIndex}`,
        fromNode,
        toNode,
        status,
        branchColor,
        glowMesh,
        coreMesh,
        motionOrb,
        selectedGlow,
        selectedDepth,
        phase: rand(),
      });
    }

    const nodeObjects = [];
    for (let nodeIndex = 0; nodeIndex < sceneNodes.length; nodeIndex += 1) {
      const node = sceneNodes[nodeIndex];
      const status = nodeStatusMap[node.id] || 'locked';
      const visual = nodeStyles[node.id] || {};
      const group = new THREE.Group();
      const renderRadius = status === 'start' ? NODE_R * 1.24 : NODE_R;
      const isLit = status === 'start' || status === 'mastered';
      const isReady = status === 'ready';
      const isLocked = status === 'locked';
      const outerGlow = createGlowSprite(textures.glowTexture, visual.glowOuter || visual.stroke || '#5CAFFF', isLit ? 0.26 : isReady ? 0.18 : 0.08, renderRadius * (status === 'start' ? 4.1 : 3.15), 4);
      const ambientGlow = createGlowSprite(textures.glowTexture, visual.ambient || visual.stroke || '#5CAFFF', isLit ? 0.1 : isReady ? 0.06 : 0.025, renderRadius * 4.6, 2);
      const fillCircle = createCircleMesh(shared, visual.fill || '#0A0F18', Math.max(0.8, visual.opacity || 1), renderRadius, 12);
      const innerCircle = createCircleMesh(shared, visual.innerFill || '#08111A', 0.98, renderRadius * 0.82, 14);
      const ringMesh = createRingMesh(shared, visual.stroke || '#FFFFFF', 0.96, renderRadius, 18);
      const coreCircle = createCircleMesh(shared, visual.core || '#05070A', isLit ? 0.86 : 0.72, Math.max(renderRadius * 0.28, 11), 24);
      const coreBloom = createGlowSprite(textures.glowTexture, visual.ring || visual.stroke || '#BFD9FF', isLit ? 0.12 : isReady ? 0.08 : 0.04, renderRadius * 1.24, 22);

      group.add(ambientGlow);
      group.add(outerGlow);
      group.add(fillCircle);
      group.add(innerCircle);
      group.add(ringMesh);
      group.add(coreBloom);
      group.add(coreCircle);

      group.position.set(node.x, node.y, 40);
      group.frustumCulled = false;
      roots.worldRoot.add(group);

      let unlockGroup = null;
      if (unlockFx?.nodeId === node.id) {
        unlockGroup = new THREE.Group();
        const ringOuter = createGlowSprite(textures.glowTexture, visual.stroke || '#FFFFFF', 0.24, renderRadius * 4.8, 30);
        const ringInner = createRingMesh(shared, visual.stroke || '#FFFFFF', 0.8, renderRadius * 1.18, 32);
        const ringCore = createGlowSprite(textures.glowTexture, visual.ring || visual.stroke || '#FFFFFF', 0.2, renderRadius * 2, 34);
        unlockGroup.add(ringOuter);
        unlockGroup.add(ringInner);
        unlockGroup.add(ringCore);
        group.add(unlockGroup);
      }

      nodeObjects.push({
        id: node.id,
        baseX: node.x,
        baseY: node.y,
        status,
        renderRadius,
        isLit,
        isReady,
        isLocked,
        group,
        outerGlow,
        ambientGlow,
        coreBloom,
        coreCircle,
        unlockGroup,
      });
    }

    let unlockEffect = null;
    if (unlockFx?.nodeId) {
      const targetNode = nodeMap.get(unlockFx.nodeId);
      const sourceNode = unlockFx.sourceId ? nodeMap.get(unlockFx.sourceId) || null : null;
      const branch = unlockFx.branch || (targetNode ? resolveBranch(targetNode) : 'neutral');
      const branchColor = BRANCH_COLORS[branch] || BRANCH_COLORS.neutral;
      if (targetNode) {
        const trailOrb = createGlowSprite(textures.glowTexture, branchColor.ring, 0.88, NODE_R * 0.86, -42);
        roots.overlayRoot.add(trailOrb);

        const particles = [];
        const particleRand = mulberry32(particleSeed(unlockFx.id || unlockFx.nodeId));
        for (let index = 0; index < 7; index += 1) {
          const particle = createGlowSprite(
            textures.glowTexture,
            index % 2 === 0 ? branchColor.ring : branchColor.main,
            0.72,
            8 + (particleRand() * 8),
            36,
          );
          roots.overlayRoot.add(particle);
          particles.push({
            sprite: particle,
            angle: particleRand() * TAU,
            distance: NODE_R * (1.1 + (particleRand() * 1.6)),
            delay: particleRand() * 0.22,
          });
        }

        unlockEffect = {
          targetNode,
          sourceNode,
          trailOrb,
          particles,
          branchColor,
        };
      }
    }

    sceneDataRef.current = {
      starLayers,
      nodeObjects,
      edgeObjects,
      unlockEffect,
    };
  }, [
    LOD.isFar,
    bld,
    edgeVisual.lockedW,
    edgeVisual.masteredW,
    edgeVisual.readyW,
    edges,
    nodeStatusMap,
    nodeStyles,
    nodes,
    selectedPathEdgeDepths,
    unlockFx,
    visibleEdges,
    visibleNodes,
  ]);
  const onContextCreate = useCallback((gl) => {
    try {
      if (!runtimeModules?.RendererClass) {
        setUseFallback(true);
        return;
      }
      patchExpoGlPixelStore(gl);
      glRef.current = gl;
      const renderer = new runtimeModules.RendererClass({
        gl,
        alpha: true,
        antialias: Platform.OS !== 'android',
        depth: false,
        stencil: false,
      });
      renderer.setClearColor(0x000000, 0);
      rendererRef.current = renderer;

      const scene = new THREE.Scene();
      sceneRef.current = scene;

      const camera = new THREE.OrthographicCamera(0, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, -5000, 5000);
      camera.position.set(0, 0, 1500);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      textureRef.current = {
        glowTexture: makeRadialTexture(64, 0.06, 1),
        starTexture: makeRadialTexture(48, 0.02, 1),
      };

      sharedRef.current = {
        circleGeometry: new THREE.CircleGeometry(1, 24),
        ringGeometry: new THREE.RingGeometry(0.82, 1, 32),
      };

      const starRoot = new THREE.Group();
      const worldRoot = new THREE.Group();
      const overlayRoot = new THREE.Group();
      scene.add(starRoot);
      scene.add(worldRoot);
      scene.add(overlayRoot);
      rootsRef.current = { starRoot, worldRoot, overlayRoot };
      readyRef.current = true;
      syncCamera();
      buildScene();

      const renderFrame = () => {
        const localRenderer = rendererRef.current;
        const localScene = sceneRef.current;
        const localCamera = cameraRef.current;
        const localGl = glRef.current;
        const roots = rootsRef.current;
        const sceneData = sceneDataRef.current;

        if (!localRenderer || !localScene || !localCamera || !localGl || !roots) {
          return;
        }

        const frameNow = Date.now();
        if (Platform.OS === 'android' && (frameNow - lastFrameAtRef.current) < ANDROID_FRAME_INTERVAL_MS) {
          frameRef.current = requestAnimationFrame(renderFrame);
          return;
        }
        lastFrameAtRef.current = frameNow;

        const now = frameNow * 0.001;
        const tx = txV.value || 0;
        const ty = tyV.value || 0;
        const sc = scV.value || 1;
        const interacting = !!interactionRef.current;

        roots.worldRoot.position.set(tx, ty, 0);
        roots.worldRoot.scale.set(sc, sc, 1);
        roots.overlayRoot.position.set(tx, ty, 0);
        roots.overlayRoot.scale.set(sc, sc, 1);

        for (let index = 0; index < sceneData.starLayers.length; index += 1) {
          const layer = sceneData.starLayers[index];
          const { mesh, config } = layer;
          mesh.position.set(
            tx * config.parallax,
            ty * config.parallax,
            0,
          );
          const zoomScale = 1 + ((sc - 1) * config.zoomStrength);
          mesh.scale.set(zoomScale, zoomScale, 1);
          mesh.material.opacity = config.opacity * (interacting ? 0.76 : 1);
        }

        dragMapRef.current = { x: dragXV.value || 0, y: dragYV.value || 0 };

        for (let index = 0; index < sceneData.nodeObjects.length; index += 1) {
          const node = sceneData.nodeObjects[index];
          const dragTarget = dragRef.current === node.id ? dragMapRef.current : null;
          node.group.position.x = dragTarget ? dragTarget.x : node.baseX;
          node.group.position.y = dragTarget ? dragTarget.y : node.baseY;

          const litGlow = interacting ? 0.12 : 0.22;
          const readyGlow = interacting ? 0.08 : 0.14;
          const lockedGlow = interacting ? 0.03 : 0.05;
          node.ambientGlow.material.opacity = node.isLit ? litGlow * 0.72 : node.isReady ? readyGlow * 0.62 : lockedGlow;
          node.outerGlow.material.opacity = node.isLit ? litGlow : node.isReady ? readyGlow : lockedGlow;
          node.coreBloom.material.opacity = interacting ? 0.06 : node.isLit ? 0.12 : node.isReady ? 0.08 : 0.04;
          node.outerGlow.scale.setScalar(node.renderRadius * (interacting ? 2.9 : node.status === 'start' ? 4.1 : 3.2));
          node.coreBloom.scale.setScalar(node.renderRadius * 1.18);

          if (node.unlockGroup && unlockFxProgressV) {
            const progress = clamp01(unlockFxProgressV.value || 0);
            node.unlockGroup.visible = progress < 1.02;
            node.unlockGroup.children[0].scale.setScalar(1 + (progress * 1.42));
            node.unlockGroup.children[0].material.opacity = (1 - progress) * 0.24;
            node.unlockGroup.children[1].scale.setScalar(1 + (progress * 0.4));
            node.unlockGroup.children[1].material.opacity = 0.84 * (1 - (progress * 0.65));
            node.unlockGroup.children[2].scale.setScalar(0.74 + (progress * 0.6));
            node.unlockGroup.children[2].material.opacity = (1 - progress) * 0.22;
          }
        }

        for (let index = 0; index < sceneData.edgeObjects.length; index += 1) {
          const edge = sceneData.edgeObjects[index];
          edge.glowMesh.visible = !interacting;
          edge.glowMesh.material.opacity = edge.status === 'mastered' ? 0.18 : edge.status === 'ready' ? 0.1 : 0.04;
          edge.coreMesh.material.opacity = edge.status === 'mastered' ? 0.88 : edge.status === 'ready' ? 0.72 : interacting ? 0.16 : 0.2;

          if (edge.motionOrb) {
            edge.motionOrb.visible = !interacting;
            const speed = edge.status === 'mastered' ? 0.1 : 0.16;
            const t = (now * speed + edge.phase) % 1;
            const point = pointOnQuadraticEdge(edge.fromNode, edge.toNode, t);
            edge.motionOrb.position.set(point.x, point.y, -40);
            edge.motionOrb.material.opacity = edge.status === 'mastered' ? 0.56 : 0.38;
          }

          if (edge.selectedGlow) {
            edge.selectedGlow.visible = !interacting;
            edge.selectedGlow.material.opacity = 0.16;
          }
        }

        const unlockEffect = sceneData.unlockEffect;
        if (unlockEffect && unlockRef.current && unlockFxProgressV) {
          const progress = clamp01(unlockFxProgressV.value || 0);
          const trailT = clamp01(progress / 0.82);
          const trailPoint = unlockEffect.sourceNode
            ? pointOnQuadraticEdge(unlockEffect.sourceNode, unlockEffect.targetNode, trailT)
            : unlockEffect.targetNode;
          unlockEffect.trailOrb.visible = progress < 1;
          unlockEffect.trailOrb.position.set(trailPoint.x, trailPoint.y, -42);
          unlockEffect.trailOrb.scale.setScalar(NODE_R * (0.62 + ((1 - progress) * 0.44)));
          unlockEffect.trailOrb.material.opacity = 0.88 * (1 - (progress * 0.46));

          for (let index = 0; index < unlockEffect.particles.length; index += 1) {
            const particle = unlockEffect.particles[index];
            const localProgress = clamp01((progress - particle.delay) / Math.max(0.12, 1 - particle.delay));
            particle.sprite.visible = localProgress < 1;
            particle.sprite.position.set(
              unlockEffect.targetNode.x + (Math.cos(particle.angle) * particle.distance * localProgress),
              unlockEffect.targetNode.y + (Math.sin(particle.angle) * particle.distance * localProgress),
              38,
            );
            particle.sprite.material.opacity = 0.72 * (1 - localProgress);
            particle.sprite.scale.setScalar((8 + (localProgress * 6)) * (1 - (localProgress * 0.32)));
          }
        }

        localRenderer.render(localScene, localCamera);
        localGl.endFrameEXP();
        frameRef.current = requestAnimationFrame(renderFrame);
      };

      frameRef.current = requestAnimationFrame(renderFrame);
    } catch (error) {
      console.warn('ThreeTreeCanvas failed to initialize, using Skia fallback.', error);
      setUseFallback(true);
    }
  }, [buildScene, dragXV, dragYV, runtimeModules, scV, syncCamera, txV, tyV, unlockFxProgressV]);

  useEffect(() => {
    if (readyRef.current) {
      syncCamera();
    }
  }, [canvasSize.height, canvasSize.width, syncCamera]);

  useEffect(() => {
    if (readyRef.current) {
      buildScene();
    }
  }, [buildScene]);

  useEffect(() => () => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    clearGroup(rootsRef.current?.starRoot);
    clearGroup(rootsRef.current?.worldRoot);
    clearGroup(rootsRef.current?.overlayRoot);
    sharedRef.current?.circleGeometry?.dispose?.();
    sharedRef.current?.ringGeometry?.dispose?.();
    textureRef.current?.glowTexture?.dispose?.();
    textureRef.current?.starTexture?.dispose?.();
    rendererRef.current?.dispose?.();
  }, []);

  if (useFallback) {
    return <SkiaTreeCanvas {...props} />;
  }

  const GLViewComponent = runtimeModules?.GLView;

  if (!GLViewComponent) {
    return <SkiaTreeCanvas {...props} />;
  }

  return (
    <View style={styles.root} pointerEvents="none">
      <GLViewComponent
        pointerEvents="none"
        style={{ width: canvasSize.width, height: canvasSize.height }}
        onContextCreate={onContextCreate}
      />
      {!!labelItems.length && (
        <View pointerEvents="none" style={styles.labelLayer}>
          {labelItems.map((item) => (
            <TreeLabel
              key={item.node.id}
              node={item.node}
              lines={item.lines}
              status={item.status}
              strokeColor={item.strokeColor}
              txV={txV}
              tyV={tyV}
              scV={scV}
            />
          ))}
        </View>
      )}
    </View>
  );
});

export default ThreeTreeCanvas;

const styles = StyleSheet.create({
  root: {
    width: '100%',
    height: '100%',
  },
  labelLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  labelWrap: {
    position: 'absolute',
    width: LABEL_WIDTH,
    alignItems: 'center',
  },
  labelGlow: {
    position: 'absolute',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 16,
    opacity: 0.72,
    textShadowColor: 'rgba(191,217,255,0.75)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  labelMain: {
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 16,
  },
});
