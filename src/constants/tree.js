export const STORAGE_KEY = 'calisthenics_tree_v1';
export const NODE_R = 46;
export const MIN_SC = 0.15;
export const MAX_SC = 6;
export const DEV_PERF_LOG = false;
export const USE_GLOW = true;
export const GLOW_QUALITY = 'low'; // 'low' | 'high'

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
