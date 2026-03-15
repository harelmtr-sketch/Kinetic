export function mulberry32(seed) {
  let a = seed >>> 0;
  return function nextRandom() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (a >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function particleSeed(id = '') {
  let seed = 2166136261;

  for (let index = 0; index < id.length; index += 1) {
    seed ^= id.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }

  return seed >>> 0;
}

export function getEdgeControlPoint(fromPos, toPos) {
  const dx = toPos.x - fromPos.x;
  const dy = toPos.y - fromPos.y;
  const mx = (fromPos.x + toPos.x) / 2;
  const my = (fromPos.y + toPos.y) / 2;

  return {
    x: mx + (Math.abs(dy) > Math.abs(dx) ? (dx > 0 ? 24 : -24) : 0),
    y: my - Math.min(44, Math.max(14, Math.abs(dx) * 0.09)),
  };
}

export function pointOnQuadraticEdge(fromPos, toPos, t) {
  const control = getEdgeControlPoint(fromPos, toPos);
  const invT = 1 - t;

  return {
    x: (invT * invT * fromPos.x) + (2 * invT * t * control.x) + (t * t * toPos.x),
    y: (invT * invT * fromPos.y) + (2 * invT * t * control.y) + (t * t * toPos.y),
  };
}

export function sampleQuadraticEdge(fromPos, toPos, steps = 22) {
  const points = [];

  for (let index = 0; index <= steps; index += 1) {
    points.push(pointOnQuadraticEdge(fromPos, toPos, index / steps));
  }

  return points;
}
