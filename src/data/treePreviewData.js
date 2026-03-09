import { TREE_MOCK_DATA } from './treeMockData';

export const TREE_PREVIEW_DATA = {
  ...TREE_MOCK_DATA,
  nodes: TREE_MOCK_DATA.nodes.map((node) => ({
    ...node,
    unlocked: node.id === 'start' || node.id === 'dead_hang' || node.id === 'pushup',
  })),
};
