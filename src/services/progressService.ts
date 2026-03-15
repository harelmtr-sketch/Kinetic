import { supabase } from '../lib/supabase';
import { normalizeTree } from '../utils/treeUtils';

export const DEFAULT_PROGRESS = { xp: 0, level: 1 };
export const XP_PER_UNLOCK = 100;
export const XP_PER_LEVEL = 300;

export function buildUnlockedNodeRows(nodeIds = [], status = 'unlocked') {
  return nodeIds.map((nodeId) => ({ node_id: nodeId, status }));
}

export function getUnlockedNodeIdsFromTree(tree) {
  return (tree?.nodes || [])
    .filter((node) => !node.isStart && node.unlocked)
    .map((node) => node.id);
}

export function getProgressFromUnlockedCount(unlockedCount = 0) {
  const xp = unlockedCount * XP_PER_UNLOCK;
  const level = Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
  return { xp, level };
}

export function applyUnlockedNodesToTree(tree, unlockedNodes = []) {
  const normalizedTree = normalizeTree(tree || {});
  const unlockedIds = new Set(
    (unlockedNodes || [])
      .map((entry) => entry?.node_id)
      .filter(Boolean),
  );

  return {
    ...normalizedTree,
    nodes: normalizedTree.nodes.map((node) => (
      node.isStart
        ? { ...node, unlocked: true }
        : { ...node, unlocked: unlockedIds.has(node.id) }
    )),
  };
}

export async function ensureStarterData(user) {
  if (!user?.id) {
    return {
      profile: null,
      progress: DEFAULT_PROGRESS,
    };
  }

  const profilePayload = {
    id: user.id,
    email: user.email ?? null,
    display_name: user.user_metadata?.display_name
      || user.user_metadata?.full_name
      || user.email?.split('@')[0]
      || null,
  };

  let profileResult = await supabase
    .from('profiles')
    .upsert(profilePayload, { onConflict: 'id' })
    .select('*')
    .maybeSingle();

  // Older databases may not have the social columns yet. Fall back to the legacy shape.
  if (profileResult.error) {
    profileResult = await supabase
      .from('profiles')
      .upsert({ id: user.id }, { onConflict: 'id' })
      .select('*')
      .maybeSingle();
  }

  const progressResult = await supabase
    .from('user_progress')
    .upsert({ user_id: user.id, ...DEFAULT_PROGRESS }, { onConflict: 'user_id' })
    .select('user_id, xp, level')
    .maybeSingle();

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (progressResult.error) {
    throw progressResult.error;
  }

  return {
    profile: profileResult.data ?? null,
    progress: {
      xp: progressResult.data?.xp ?? DEFAULT_PROGRESS.xp,
      level: progressResult.data?.level ?? DEFAULT_PROGRESS.level,
    },
  };
}

export async function loadUserData(userId) {
  const [profileResult, progressResult, unlockedNodesResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('user_progress')
      .select('user_id, xp, level')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('user_unlocked_nodes')
      .select('node_id, status')
      .eq('user_id', userId),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (progressResult.error) {
    throw progressResult.error;
  }

  if (unlockedNodesResult.error) {
    throw unlockedNodesResult.error;
  }

  const unlockedNodes = unlockedNodesResult.data ?? [];
  const fallbackProgress = getProgressFromUnlockedCount(unlockedNodes.length);

  return {
    profile: profileResult.data ?? null,
    progress: {
      xp: progressResult.data?.xp ?? fallbackProgress.xp,
      level: progressResult.data?.level ?? fallbackProgress.level,
    },
    unlockedNodes,
  };
}

export async function saveXp(userId, xp, level) {
  const result = await supabase
    .from('user_progress')
    .upsert({ user_id: userId, xp, level }, { onConflict: 'user_id' })
    .select('user_id, xp, level')
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

export async function unlockNode(userId, nodeId, status = 'unlocked') {
  const result = await supabase
    .from('user_unlocked_nodes')
    .upsert({ user_id: userId, node_id: nodeId, status }, { onConflict: 'user_id,node_id' })
    .select('node_id, status')
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

export async function replaceUnlockedNodes(userId, nodeIds = [], status = 'unlocked') {
  const deleteResult = await supabase
    .from('user_unlocked_nodes')
    .delete()
    .eq('user_id', userId);

  if (deleteResult.error) {
    throw deleteResult.error;
  }

  if (!nodeIds.length) {
    return [];
  }

  const upsertResult = await supabase
    .from('user_unlocked_nodes')
    .upsert(
      nodeIds.map((nodeId) => ({ user_id: userId, node_id: nodeId, status })),
      { onConflict: 'user_id,node_id' },
    )
    .select('node_id, status');

  if (upsertResult.error) {
    throw upsertResult.error;
  }

  return upsertResult.data ?? [];
}
