export const STORAGE_KEY = 'calisthenics_tree_v1';
export const SAVED_TREES_KEY = 'calisthenics_tree_library_v1';
export const SELECTED_TREE_KEY = 'calisthenics_selected_tree_v1';
export const NODE_R = 46;
export const MIN_SC = 0.12;
export const MAX_SC = 1.25;
export const DEV_PERF_LOG = false;
export const USE_GLOW = true;
export const GLOW_QUALITY = 'low'; // 'low' | 'high'

export const BRANCH_TYPES = ['push', 'pull', 'core'];
export const ALL_BRANCH_TYPES = ['neutral', ...BRANCH_TYPES];

export const BRANCH_MAP = {
  dead_hang: 'pull',
  active_hang: 'pull',
  scap_pulls: 'pull',
  neg_pullup: 'pull',
  pullup: 'pull',
  pushup: 'push',
  diamond_pu: 'push',
  pike_pu: 'push',
  hspu: 'push',
  start: 'neutral',
};
