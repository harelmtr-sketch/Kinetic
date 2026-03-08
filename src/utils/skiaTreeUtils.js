import { Skia } from '@shopify/react-native-skia';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (a >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildEdgePath(fromPos, toPos) {
  const path = Skia.Path.Make();
  const dx = toPos.x - fromPos.x;
  const dy = toPos.y - fromPos.y;
  const mx = (fromPos.x + toPos.x) / 2;
  const my = (fromPos.y + toPos.y) / 2;
  const bendX = mx + (Math.abs(dy) > Math.abs(dx) ? (dx > 0 ? 24 : -24) : 0);
  const bendY = my - Math.min(44, Math.max(14, Math.abs(dx) * 0.09));
  path.moveTo(fromPos.x, fromPos.y);
  path.quadTo(bendX, bendY, toPos.x, toPos.y);
  return path;
}
