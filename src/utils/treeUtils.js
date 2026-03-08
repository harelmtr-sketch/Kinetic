import { INIT } from '../data/initialTree';
import { ALL_BRANCH_TYPES, BRANCH_MAP, DEV_PERF_LOG } from '../constants/tree';

const VALID_BRANCHES = new Set(ALL_BRANCH_TYPES);
const BRANCH_KEYWORDS = {
  push: ['push', 'dip', 'press', 'planche', 'hspu', 'handstand', 'tricep', 'pike'],
  pull: ['pull', 'chin', 'row', 'hang', 'front lever', 'back lever', 'muscle up', 'scap'],
  core: ['core', 'abs', 'hollow', 'l-sit', 'plank', 'dragon', 'v-up'],
};

const normalizeBranchValue = (branch) => {
  if (typeof branch !== 'string') return null;
  const normalized = branch.trim().toLowerCase();
  return VALID_BRANCHES.has(normalized) ? normalized : null;
};

const isValidBranch = (branch) => !!normalizeBranchValue(branch);

const stripLegacySuffix = (id) => {
  if (typeof id !== 'string' || !id) return null;
  return id.replace(/_\d+$/, '');
};

const resolveLegacyBranchFromId = (id) => {
  if (typeof id !== 'string' || !id) return null;
  if (BRANCH_MAP[id]) return BRANCH_MAP[id];

  const baseId = stripLegacySuffix(id);
  if (baseId && BRANCH_MAP[baseId]) return BRANCH_MAP[baseId];
  if (baseId && VALID_BRANCHES.has(baseId)) return baseId;

  return null;
};

const inferBranchFromName = (name) => {
  if (typeof name !== 'string' || !name.trim()) return null;
  const key = name.toLowerCase();
  for (const [branch, keywords] of Object.entries(BRANCH_KEYWORDS)) {
    if (keywords.some((word) => key.includes(word))) return branch;
  }
  return null;
};

export const resolveBranch = (node) => {
  const explicit = normalizeBranchValue(node?.branch);
  if (explicit) return explicit;

  const legacyBranch = resolveLegacyBranchFromId(node?.id);
  if (legacyBranch) return legacyBranch;

  const nameBranch = inferBranchFromName(node?.name);
  if (nameBranch) return nameBranch;

  return node?.isStart ? 'neutral' : 'core';
};

export const resolveEdgeBranch = (fromNode, toNode) => {
  const fromBranch = resolveBranch(fromNode);
  const toBranch = resolveBranch(toNode);

  if (fromBranch === toBranch) return toBranch;
  if (fromBranch === 'neutral') return toBranch;
  if (toBranch === 'neutral') return fromBranch;

  if (toBranch !== 'core') return toBranch;
  if (fromBranch !== 'core') return fromBranch;

  return toBranch;
};

const inferBranchFromNeighbors = (nodeId, incomingByNode, outgoingByNode, byId) => {
  const score = { push: 0, pull: 0, core: 0 };
  const collectBranch = (neighborId, weight = 1) => {
    const b = byId.get(neighborId)?.branch;
    if (!b || b === 'neutral') return;
    score[b] += weight;
  };

  (incomingByNode.get(nodeId) || []).forEach((nid) => collectBranch(nid, 1.15));
  (outgoingByNode.get(nodeId) || []).forEach((nid) => collectBranch(nid, 1));

  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  if (!ranked[0] || ranked[0][1] === 0) return null;
  if (ranked[1] && ranked[0][1] - ranked[1][1] < 0.9) return null;
  return ranked[0][0];
};

const normalizeNodesWithBranch = (nodes, edges) => {
  const fallbackNodes = [];
  const byId = new Map(nodes.map((n) => {
    const explicit = normalizeBranchValue(n.branch);
    const legacy = resolveLegacyBranchFromId(n.id);
    const byName = inferBranchFromName(n.name);

    let branch = explicit || legacy || byName || (n.isStart ? 'neutral' : null);
    if (!branch && !n.isStart) fallbackNodes.push(n.id);

    return [n.id, {
      ...n,
      branch,
    }];
  }));

  const incomingByNode = new Map();
  const outgoingByNode = new Map();
  for (const e of edges || []) {
    if (!incomingByNode.has(e.to)) incomingByNode.set(e.to, []);
    incomingByNode.get(e.to).push(e.from);
    if (!outgoingByNode.has(e.from)) outgoingByNode.set(e.from, []);
    outgoingByNode.get(e.from).push(e.to);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const node of byId.values()) {
      if (node.branch) continue;
      const inferred = inferBranchFromNeighbors(node.id, incomingByNode, outgoingByNode, byId);
      if (inferred) {
        node.branch = inferred;
        changed = true;
      }
    }
  }

  const normalized = nodes.map((n) => {
    const current = byId.get(n.id);
    return {
      ...current,
      branch: current.branch || (current.isStart ? 'neutral' : 'core'),
    };
  });

  if (DEV_PERF_LOG) {
    const counts = normalized.reduce((acc, n) => {
      const b = resolveBranch(n);
      acc[b] = (acc[b] || 0) + 1;
      return acc;
    }, {});
    console.log('[tree] branch distribution', counts, {
      coreFallbackCount: fallbackNodes.length,
      coreFallbackSample: fallbackNodes.slice(0, 8),
    });
  }

  return normalized;
};

export const toRGBA = (hex, alpha = 1) => {
  const m = hex.replace('#', '');
  const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const int = parseInt(n, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
};

export function canUnlock(id, nodes, edges) {
  const p = edges.filter((e) => e.to === id).map((e) => e.from);
  if (!p.length) return false;
  return p.every((pid) => nodes.find((n) => n.id === pid)?.unlocked);
}

export function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax; const dy = by - ay; const l = dx * dx + dy * dy;
  if (!l) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

export function segmentIntersectsRect(ax, ay, bx, by, rect) {
  const { left, top, right, bottom } = rect;
  const pointInRect = (x, y) => x >= left && x <= right && y >= top && y <= bottom;
  if (pointInRect(ax, ay) || pointInRect(bx, by)) return true;

  const minX = Math.min(ax, bx);
  const maxX = Math.max(ax, bx);
  const minY = Math.min(ay, by);
  const maxY = Math.max(ay, by);
  if (maxX < left || minX > right || maxY < top || minY > bottom) return false;

  const edgeIntersects = (x1, y1, x2, y2, x3, y3, x4, y4) => {
    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (den === 0) return false;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    const u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };

  return (
    edgeIntersects(ax, ay, bx, by, left, top, right, top)
    || edgeIntersects(ax, ay, bx, by, right, top, right, bottom)
    || edgeIntersects(ax, ay, bx, by, right, bottom, left, bottom)
    || edgeIntersects(ax, ay, bx, by, left, bottom, left, top)
  );
}

export function normalizeTree(rawTree) {
  const withDefaults = {
    ...INIT,
    ...rawTree,
    nodes: rawTree?.nodes || INIT.nodes,
    edges: rawTree?.edges || INIT.edges,
  };

  return {
    ...withDefaults,
    nodes: normalizeNodesWithBranch(withDefaults.nodes, withDefaults.edges),
    info: { ...INIT.info, ...(rawTree?.info || {}) },
  };
}

export function getTreeStats(tree) {
  const nodes = (tree?.nodes || []).filter((n) => !n.isStart);
  const unlocked = nodes.filter((n) => n.unlocked);
  const byBranch = ['push', 'pull', 'core'].reduce((acc, b) => {
    const branchNodes = nodes.filter((n) => resolveBranch(n) === b);
    const unlockedCount = branchNodes.filter((n) => n.unlocked).length;
    acc[b] = {
      total: branchNodes.length,
      unlocked: unlockedCount,
      pct: branchNodes.length ? Math.round((unlockedCount / branchNodes.length) * 100) : 0,
    };
    return acc;
  }, {});
  const leadingBranch = ['push', 'pull', 'core'].sort((a, b) => byBranch[b].pct - byBranch[a].pct)[0] || 'push';
  const completionPct = nodes.length ? Math.round((unlocked.length / nodes.length) * 100) : 0;
  return { total: nodes.length, unlocked: unlocked.length, completionPct, byBranch, leadingBranch };
}
