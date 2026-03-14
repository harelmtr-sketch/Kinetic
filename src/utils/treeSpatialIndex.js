const DEFAULT_CELL_SIZE = 320;

function getCellKey(col, row) {
  return `${col}:${row}`;
}

function getCellCoord(value, cellSize) {
  return Math.floor(value / cellSize);
}

function addBucketItem(map, col, row, item) {
  const key = getCellKey(col, row);
  const bucket = map.get(key);
  if (bucket) {
    bucket.push(item);
    return;
  }
  map.set(key, [item]);
}

function addRectItem(map, minX, minY, maxX, maxY, item, cellSize) {
  const minCol = getCellCoord(minX, cellSize);
  const maxCol = getCellCoord(maxX, cellSize);
  const minRow = getCellCoord(minY, cellSize);
  const maxRow = getCellCoord(maxY, cellSize);

  for (let col = minCol; col <= maxCol; col += 1) {
    for (let row = minRow; row <= maxRow; row += 1) {
      addBucketItem(map, col, row, item);
    }
  }
}

function queryBuckets(map, bounds, cellSize, getId) {
  if (!bounds) return [];

  const minCol = getCellCoord(bounds.left, cellSize);
  const maxCol = getCellCoord(bounds.right, cellSize);
  const minRow = getCellCoord(bounds.top, cellSize);
  const maxRow = getCellCoord(bounds.bottom, cellSize);
  const seen = new Set();
  const items = [];

  for (let col = minCol; col <= maxCol; col += 1) {
    for (let row = minRow; row <= maxRow; row += 1) {
      const bucket = map.get(getCellKey(col, row));
      if (!bucket) continue;

      for (let index = 0; index < bucket.length; index += 1) {
        const item = bucket[index];
        const id = getId(item);
        if (seen.has(id)) continue;
        seen.add(id);
        items.push(item);
      }
    }
  }

  return items;
}

export function buildTreeSpatialIndex(nodes, edges, nodeMap, cellSize = DEFAULT_CELL_SIZE) {
  const nodeBuckets = new Map();
  const edgeBuckets = new Map();

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    addBucketItem(
      nodeBuckets,
      getCellCoord(node.x, cellSize),
      getCellCoord(node.y, cellSize),
      node,
    );
  }

  const edgeItems = [];

  for (let index = 0; index < edges.length; index += 1) {
    const edge = edges[index];
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    if (!fromNode || !toNode) continue;

    const item = {
      id: `${edge.from}->${edge.to}:${index}`,
      edge,
      fromNode,
      toNode,
    };

    edgeItems.push(item);

    addRectItem(
      edgeBuckets,
      Math.min(fromNode.x, toNode.x),
      Math.min(fromNode.y, toNode.y),
      Math.max(fromNode.x, toNode.x),
      Math.max(fromNode.y, toNode.y),
      item,
      cellSize,
    );
  }

  return {
    cellSize,
    nodeBuckets,
    edgeBuckets,
    edgeItems,
  };
}

export function querySpatialNodes(index, bounds) {
  if (!index || !bounds) return [];
  return queryBuckets(index.nodeBuckets, bounds, index.cellSize, (item) => item.id);
}

export function querySpatialEdges(index, bounds) {
  if (!index || !bounds) return [];
  return queryBuckets(index.edgeBuckets, bounds, index.cellSize, (item) => item.id);
}
