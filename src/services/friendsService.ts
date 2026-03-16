import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { loadUserData } from './progressService';
import { loadRemoteSkillVideoMap } from './skillVideoService';

const FRIENDS_STORAGE_KEY = '@kinetic/friends/v1';

export type FriendRecord = {
  id: string;
  email: string | null;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  status: 'online' | 'away' | 'offline' | null;
  addedAt: number;
  source: 'remote' | 'local';
};

type FriendMap = Record<string, FriendRecord>;

const readLocalFriends = async (): Promise<FriendMap> => {
  try {
    const raw = await AsyncStorage.getItem(FRIENDS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeLocalFriends = async (nextMap: FriendMap) => {
  await AsyncStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(nextMap));
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const sortFriends = (friends: FriendRecord[]) => friends.sort((left, right) => {
  const leftLabel = (left.displayName || left.email || '').toLowerCase();
  const rightLabel = (right.displayName || right.email || '').toLowerCase();
  return leftLabel.localeCompare(rightLabel);
});

const mergeFriendLists = (localMap: FriendMap, remoteFriends: FriendRecord[]) => {
  const mergedMap = { ...localMap };

  remoteFriends.forEach((friend) => {
    mergedMap[friend.id] = friend;
  });

  return sortFriends(Object.values(mergedMap));
};

export async function loadFriends(currentUserId: string | null) {
  const localMap = await readLocalFriends();

  if (!currentUserId) {
    return sortFriends(Object.values(localMap));
  }

  try {
    const friendshipsResult = await supabase
      .from('friendships')
      .select('user_id, friend_id, created_at')
      .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`);

    if (friendshipsResult.error) {
      throw friendshipsResult.error;
    }

    const rows = friendshipsResult.data || [];
    const friendIds = Array.from(new Set(rows
      .map((row) => (row.user_id === currentUserId ? row.friend_id : row.user_id))
      .filter(Boolean)));

    if (!friendIds.length) {
      return sortFriends(Object.values(localMap));
    }

    const profilesResult = await supabase
      .from('profiles')
      .select('id, email, display_name, username, avatar_url, status')
      .in('id', friendIds);

    if (profilesResult.error) {
      throw profilesResult.error;
    }

    const profileById = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));
    const remoteFriends = friendIds.map((friendId) => {
      const relation = rows.find((row) => row.user_id === friendId || row.friend_id === friendId);
      const profile = profileById.get(friendId);

      return {
        id: friendId,
        email: profile?.email || null,
        username: profile?.username || null,
        avatarUrl: profile?.avatar_url || null,
        displayName: profile?.display_name || profile?.username || profile?.email?.split('@')[0] || 'Friend',
        status: (profile?.status as FriendRecord['status']) || null,
        addedAt: relation?.created_at ? new Date(relation.created_at).getTime() : Date.now(),
        source: 'remote' as const,
      };
    });

    return mergeFriendLists(localMap, remoteFriends);
  } catch {
    return sortFriends(Object.values(localMap));
  }
}

export async function addFriendByEmail(currentUserId: string | null, email: string) {
  const normalizedEmail = normalizeEmail(email);
  const localMap = await readLocalFriends();

  if (!normalizedEmail) {
    throw new Error('Enter an email address first.');
  }

  if (!currentUserId) {
    const localFriend: FriendRecord = {
      id: `local:${normalizedEmail}`,
      email: normalizedEmail,
      username: null,
      avatarUrl: null,
      displayName: normalizedEmail.split('@')[0],
      addedAt: Date.now(),
      source: 'local',
    };
    const nextMap = { ...localMap, [localFriend.id]: localFriend };
    await writeLocalFriends(nextMap);
    return { friend: localFriend, friends: sortFriends(Object.values(nextMap)), usedLocalFallback: true };
  }

  try {
    const profileResult = await supabase
      .from('profiles')
      .select('id, email, display_name, username, avatar_url')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (profileResult.error) throw profileResult.error;
    if (!profileResult.data?.id) throw new Error('No user found with that email yet.');
    if (profileResult.data.id === currentUserId) throw new Error('You cannot add yourself.');

    await upsertFriendship(currentUserId, profileResult.data.id);

    const friend: FriendRecord = {
      id: profileResult.data.id,
      email: profileResult.data.email || normalizedEmail,
      username: profileResult.data.username || null,
      avatarUrl: profileResult.data.avatar_url || null,
      displayName: profileResult.data.display_name || profileResult.data.username || normalizedEmail.split('@')[0],
      addedAt: Date.now(),
      source: 'remote',
    };
    return { friend, friends: await loadFriends(currentUserId), usedLocalFallback: false };
  } catch (error) {
    const localFriend: FriendRecord = {
      id: `local:${normalizedEmail}`,
      email: normalizedEmail,
      username: null,
      avatarUrl: null,
      displayName: normalizedEmail.split('@')[0],
      addedAt: Date.now(),
      source: 'local',
    };
    const nextMap = { ...localMap, [localFriend.id]: localFriend };
    await writeLocalFriends(nextMap);
    return { friend: localFriend, friends: sortFriends(Object.values(nextMap)), usedLocalFallback: true, error };
  }
}

async function upsertFriendship(userId: string, friendId: string) {
  const rows = [
    { user_id: userId, friend_id: friendId },
    { user_id: friendId, friend_id: userId },
  ];
  const result = await supabase.from('friendships').upsert(rows, { onConflict: 'user_id,friend_id' });
  if (result.error) throw result.error;
}

export async function addFriendByUsername(currentUserId: string | null, username: string) {
  const normalized = username.trim().toLowerCase().replace(/^@/, '');

  if (!normalized) throw new Error('Enter a username first.');
  if (!currentUserId) throw new Error('Sign in to add friends by username.');

  const profileResult = await supabase
    .from('profiles')
    .select('id, email, display_name, username, avatar_url')
    .ilike('username', normalized)
    .maybeSingle();

  if (profileResult.error) throw new Error('Connection error — check your internet and try again.');
  if (!profileResult.data?.id) throw new Error(`No account found with username "@${normalized}". Check the spelling and try again.`);
  if (profileResult.data.id === currentUserId) throw new Error('You cannot add yourself.');

  await upsertFriendship(currentUserId, profileResult.data.id);

  const friend: FriendRecord = {
    id: profileResult.data.id,
    email: profileResult.data.email || null,
    username: profileResult.data.username || normalized,
    avatarUrl: profileResult.data.avatar_url || null,
    status: null,
    displayName: profileResult.data.display_name || profileResult.data.username || `@${normalized}`,
    addedAt: Date.now(),
    source: 'remote',
  };
  return { friend, friends: await loadFriends(currentUserId), usedLocalFallback: false };
}

export async function removeFriend(currentUserId: string | null, friendId: string) {
  const localMap = await readLocalFriends();
  const nextMap = { ...localMap };
  delete nextMap[friendId];
  await writeLocalFriends(nextMap);

  if (currentUserId && !friendId.startsWith('local:')) {
    try {
      await Promise.all([
        supabase
          .from('friendships')
          .delete()
          .match({ user_id: currentUserId, friend_id: friendId }),
        supabase
          .from('friendships')
          .delete()
          .match({ user_id: friendId, friend_id: currentUserId }),
      ]);
    } catch {
      // Keep local removal even if the backend cleanup fails.
    }
  }

  return sortFriends(Object.values(nextMap));
}

export async function loadFriendSnapshot(friendId: string) {
  if (!friendId || friendId.startsWith('local:')) {
    return null;
  }

  try {
    const [userData, skillVideos] = await Promise.all([
      loadUserData(friendId),
      loadRemoteSkillVideoMap(friendId),
    ]);

    return {
      ...userData,
      skillVideos,
    };
  } catch {
    return null;
  }
}
