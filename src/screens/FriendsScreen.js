import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeVideoPlayer from '../components/common/SafeVideoPlayer';
import { Colors } from '../theme/colors';
import { INIT } from '../data/initialTree';
import { normalizeTree } from '../utils/treeUtils';
import {
  addFriendByUsername,
  loadFriendSnapshot,
  loadFriends,
  removeFriend,
} from '../services/friendsService';

function FriendVideoCard({ title, uri }) {
  return (
    <View style={styles.friendVideoCard}>
      <SafeVideoPlayer
        uri={uri}
        style={styles.friendVideoStage}
        accentColor="#9BD8FF"
        emptyIcon="videocam-outline"
        emptyBody="Open clip"
        openLabel="Open"
        compact
      />
      <Text numberOfLines={1} style={styles.friendVideoTitle}>{title}</Text>
    </View>
  );
}

export default function FriendsScreen({ currentUser }) {
  const [friends, setFriends] = useState([]);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friendSnapshot, setFriendSnapshot] = useState(null);
  const [isLoadingFriend, setIsLoadingFriend] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const treeTemplate = useMemo(() => normalizeTree(INIT), []);
  const nodeNameById = useMemo(
    () => new Map(treeTemplate.nodes.map((node) => [node.id, node.name])),
    [treeTemplate.nodes],
  );

  const refreshFriends = useCallback(async () => {
    setIsBusy(true);
    try {
      const nextFriends = await loadFriends(currentUser?.id ?? null);
      setFriends(nextFriends);
    } finally {
      setIsBusy(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    void refreshFriends();
  }, [refreshFriends]);

  const handleAddFriend = async () => {
    const username = usernameDraft.trim();
    if (!username || isBusy) {
      return;
    }

    setIsBusy(true);
    setInfoMessage('');

    try {
      const result = await addFriendByUsername(currentUser?.id ?? null, username);
      setFriends(result.friends);
      setUsernameDraft('');
      setInfoMessage(
        result.usedLocalFallback
          ? 'Saved locally for now — they\'ll sync once they create an account.'
          : 'Friend added successfully.',
      );
    } catch (error) {
      Alert.alert('Unable to add friend', error?.message || 'Try again in a moment.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemoveFriend = (friend) => {
    Alert.alert('Remove friend', `Remove ${friend.displayName || friend.username || 'this friend'} from your list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setIsBusy(true);
          try {
            const nextFriends = await removeFriend(currentUser?.id ?? null, friend.id);
            setFriends(nextFriends);
            if (selectedFriend?.id === friend.id) {
              setSelectedFriend(null);
              setFriendSnapshot(null);
            }
          } finally {
            setIsBusy(false);
          }
        },
      },
    ]);
  };

  const openFriend = async (friend) => {
    setSelectedFriend(friend);
    setIsLoadingFriend(true);
    setFriendSnapshot(null);

    try {
      const snapshot = await loadFriendSnapshot(friend.id);
      setFriendSnapshot(snapshot);
    } finally {
      setIsLoadingFriend(false);
    }
  };

  const selectedVideos = useMemo(() => {
    if (!friendSnapshot?.skillVideos) {
      return [];
    }

    return Object.values(friendSnapshot.skillVideos)
      .sort((left, right) => right.createdAt - left.createdAt);
  }, [friendSnapshot]);

  const unlockedNodes = useMemo(() => (
    (friendSnapshot?.unlockedNodes || []).map((entry) => ({
      id: entry.node_id,
      name: nodeNameById.get(entry.node_id) || entry.node_id,
    }))
  ), [friendSnapshot?.unlockedNodes, nodeNameById]);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>FRIENDS</Text>
          <Text style={styles.heroTitle}>Training Circle</Text>
          <Text style={styles.heroBody}>Add friends by username, open their progress, and replay attempt videos that are attached to unlocked skills.</Text>
        </View>

        <View style={styles.addCard}>
          <Text style={styles.sectionTitle}>Add Friend</Text>
          <View style={styles.addRow}>
            <TextInput
              value={usernameDraft}
              onChangeText={setUsernameDraft}
              placeholder="@username"
              placeholderTextColor="rgba(255,255,255,0.28)"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="send"
              onSubmitEditing={handleAddFriend}
              style={styles.input}
            />
            <TouchableOpacity style={styles.addBtn} onPress={handleAddFriend} disabled={isBusy}>
              <Ionicons name="person-add-outline" size={18} color="#EAF6FF" />
            </TouchableOpacity>
          </View>
          {!!infoMessage && <Text style={styles.infoMessage}>{infoMessage}</Text>}
        </View>

        <View style={styles.listCard}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Friend List</Text>
            {isBusy && <ActivityIndicator color="#BFE2FF" />}
          </View>

          {!friends.length && !isBusy && (
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={22} color="rgba(191,226,255,0.5)" />
              <Text style={styles.emptyTitle}>No friends yet</Text>
              <Text style={styles.emptyBody}>Add someone above and their shared attempts will show up here.</Text>
            </View>
          )}

          {friends.map((friend) => (
            <View key={friend.id} style={styles.friendRow}>
              <View style={styles.friendAvatar}>
                {friend.avatarUrl ? (
                  <Image source={{ uri: friend.avatarUrl }} style={styles.friendAvatarImg} />
                ) : (
                  <Text style={styles.friendAvatarInitial}>
                    {(friend.displayName || friend.username || 'F').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={styles.friendMeta}>
                <Text style={styles.friendName}>{friend.displayName || friend.username || 'Friend'}</Text>
                <Text style={styles.friendSub}>
                  {friend.username ? `@${friend.username}` : friend.email || 'Local friend'}
                </Text>
              </View>
              <TouchableOpacity style={styles.friendActionBtn} onPress={() => openFriend(friend)}>
                <Ionicons name="eye-outline" size={16} color="#EAF6FF" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.friendActionBtn, styles.friendDangerBtn]} onPress={() => handleRemoveFriend(friend)}>
                <Ionicons name="trash-outline" size={16} color="#FFD8D8" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={!!selectedFriend}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => {
          setSelectedFriend(null);
          setFriendSnapshot(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => {
            setSelectedFriend(null);
            setFriendSnapshot(null);
          }} />

          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>FRIEND VIEW</Text>
                <Text style={styles.modalTitle}>{selectedFriend?.displayName || selectedFriend?.username || 'Friend'}</Text>
                {selectedFriend?.username && (
                  <Text style={styles.modalSubtitle}>@{selectedFriend.username}</Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  setSelectedFriend(null);
                  setFriendSnapshot(null);
                }}
              >
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.74)" />
              </TouchableOpacity>
            </View>

            {isLoadingFriend ? (
              <View style={styles.loadingFriendBox}>
                <ActivityIndicator color="#BFE2FF" />
                <Text style={styles.loadingFriendText}>Loading their tree and videos...</Text>
              </View>
            ) : !friendSnapshot ? (
              <View style={styles.loadingFriendBox}>
                <Ionicons name="cloud-offline-outline" size={22} color="rgba(255,255,255,0.52)" />
                <Text style={styles.loadingFriendText}>Shared friend data is not available yet for this entry.</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
                <View style={styles.snapshotGrid}>
                  <View style={styles.snapshotTile}>
                    <Text style={styles.snapshotLabel}>Unlocked Skills</Text>
                    <Text style={styles.snapshotValue}>{friendSnapshot.unlockedNodes.length}</Text>
                  </View>
                  <View style={styles.snapshotTile}>
                    <Text style={styles.snapshotLabel}>Level</Text>
                    <Text style={styles.snapshotValue}>{friendSnapshot.progress?.level || 1}</Text>
                  </View>
                  <View style={styles.snapshotTile}>
                    <Text style={styles.snapshotLabel}>Videos</Text>
                    <Text style={styles.snapshotValue}>{selectedVideos.length}</Text>
                  </View>
                </View>

                <View style={styles.friendSection}>
                  <Text style={styles.sectionTitle}>Shared Attempt Videos</Text>
                  {selectedVideos.length === 0 ? (
                    <Text style={styles.friendSectionBody}>This friend has not shared any saved attempts yet.</Text>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendVideosRow}>
                      {selectedVideos.map((video) => (
                        <FriendVideoCard
                          key={`${video.nodeId}_${video.createdAt}`}
                          title={nodeNameById.get(video.nodeId) || video.nodeId}
                          uri={video.remoteUrl || video.localUri}
                        />
                      ))}
                    </ScrollView>
                  )}
                </View>

                <View style={styles.friendSection}>
                  <Text style={styles.sectionTitle}>Tree Progress</Text>
                  <View style={styles.friendSkillWrap}>
                    {unlockedNodes.map((node) => (
                      <View key={node.id} style={styles.friendSkillChip}>
                        <Ionicons name="checkmark-circle" size={14} color="#86EFAC" />
                        <Text style={styles.friendSkillChipText}>{node.name}</Text>
                      </View>
                    ))}
                    {unlockedNodes.length === 0 && (
                      <Text style={styles.friendSectionBody}>No unlocked skills are visible yet.</Text>
                    )}
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  content: {
    paddingTop: 90,
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 16,
  },
  heroCard: {
    borderRadius: 28,
    padding: 18,
    gap: 8,
    backgroundColor: 'rgba(8,12,22,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.14)',
  },
  heroEyebrow: {
    color: '#FFE39A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  heroTitle: {
    color: '#F8FBFF',
    fontSize: 28,
    fontWeight: '800',
  },
  heroBody: {
    color: 'rgba(225,236,248,0.64)',
    fontSize: 14,
    lineHeight: 21,
  },
  addCard: {
    borderRadius: 24,
    padding: 16,
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  sectionTitle: {
    color: '#F8FBFF',
    fontSize: 16,
    fontWeight: '800',
  },
  addRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#FFFFFF',
    fontSize: 14,
    paddingHorizontal: 14,
  },
  addBtn: {
    width: 50,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13,58,86,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.18)',
  },
  infoMessage: {
    color: 'rgba(191,226,255,0.68)',
    fontSize: 12,
    lineHeight: 18,
  },
  listCard: {
    borderRadius: 24,
    padding: 16,
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emptyBox: {
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  emptyTitle: {
    color: '#F8FBFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyBody: {
    color: 'rgba(225,236,248,0.54)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  friendAvatar: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13,58,86,0.52)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.16)',
    overflow: 'hidden',
  },
  friendAvatarImg: {
    width: 42,
    height: 42,
    borderRadius: 16,
  },
  friendAvatarInitial: {
    color: '#BFE2FF',
    fontSize: 17,
    fontWeight: '800',
  },
  friendMeta: {
    flex: 1,
    gap: 2,
  },
  friendName: {
    color: '#F8FBFF',
    fontSize: 15,
    fontWeight: '700',
  },
  friendSub: {
    color: 'rgba(225,236,248,0.48)',
    fontSize: 12,
  },
  modalSubtitle: {
    color: 'rgba(191,226,255,0.52)',
    fontSize: 14,
    marginTop: 2,
  },
  friendActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  friendDangerBtn: {
    backgroundColor: 'rgba(76,18,28,0.68)',
    borderColor: 'rgba(248,113,113,0.16)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '84%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: 'rgba(8,12,20,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.14)',
    overflow: 'hidden',
  },
  modalHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
  },
  modalEyebrow: {
    color: 'rgba(191,226,255,0.48)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  modalTitle: {
    color: '#F8FBFF',
    fontSize: 24,
    fontWeight: '800',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  loadingFriendBox: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  loadingFriendText: {
    color: 'rgba(225,236,248,0.58)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  modalContent: {
    paddingHorizontal: 18,
    paddingBottom: 26,
    gap: 16,
  },
  snapshotGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  snapshotTile: {
    flex: 1,
    minHeight: 84,
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'space-between',
  },
  snapshotLabel: {
    color: 'rgba(191,226,255,0.46)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  snapshotValue: {
    color: '#F8FBFF',
    fontSize: 28,
    fontWeight: '800',
  },
  friendSection: {
    gap: 10,
  },
  friendSectionBody: {
    color: 'rgba(225,236,248,0.56)',
    fontSize: 13,
    lineHeight: 19,
  },
  friendVideosRow: {
    gap: 12,
    paddingRight: 16,
  },
  friendVideoCard: {
    width: 180,
    gap: 8,
  },
  friendVideoStage: {
    height: 120,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(6,13,22,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.14)',
  },
  friendVideoTitle: {
    color: '#F8FBFF',
    fontSize: 13,
    fontWeight: '700',
  },
  friendSkillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  friendSkillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  friendSkillChipText: {
    color: '#EAF6FF',
    fontSize: 12,
    fontWeight: '700',
  },
});
