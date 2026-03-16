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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SafeVideoPlayer from '../components/common/SafeVideoPlayer';
import { Colors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { INIT } from '../data/initialTree';
import { normalizeTree } from '../utils/treeUtils';
import {
  addFriendByUsername,
  loadFriendSnapshot,
  loadFriends,
  removeFriend,
} from '../services/friendsService';

const KINETIC_BOT = {
  id: '__kinetic_bot__',
  displayName: 'Kinetic Bot',
  username: 'kinetic.bot',
  avatarUrl: null,
  status: 'online',
  isBot: true,
};

const STATUS_CONFIG = {
  online:  { color: '#4ADE80', label: 'Online' },
  away:    { color: '#FB923C', label: 'Away' },
  offline: { color: '#94A3B8', label: 'Offline' },
};

function StatusDot({ status, size = 10 }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: cfg.color,
      borderWidth: 1.5, borderColor: 'rgba(8,12,22,0.95)',
      shadowColor: cfg.color, shadowOffset: { width: 0, height: 0 },
      shadowOpacity: status === 'online' ? 0.8 : 0, shadowRadius: 4,
    }} />
  );
}

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

function FriendAvatar({ friend, size = 44, showStatus = false }) {
  const br = size * 0.36;
  const isBot = friend?.isBot;
  return (
    <View style={{ position: 'relative' }}>
      {isBot ? (
        <BotAvatarMini size={size} />
      ) : (
        <View style={[styles.avatar, { width: size, height: size, borderRadius: br }]}>
          {friend?.avatarUrl ? (
            <Image source={{ uri: friend.avatarUrl }} style={{ width: size, height: size, borderRadius: br }} />
          ) : (
            <Text style={[styles.avatarInitial, { fontSize: size * 0.38 }]}>
              {((friend?.displayName || friend?.username || 'F')).charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
      )}
      {showStatus && (
        <View style={{ position: 'absolute', bottom: -1, right: -1 }}>
          <StatusDot status={friend?.status || 'offline'} size={size * 0.25} />
        </View>
      )}
    </View>
  );
}

function BotAvatarMini({ size = 44 }) {
  const br = size * 0.22;
  const eyeR = size * 0.13;
  return (
    <View style={{
      width: size, height: size, borderRadius: br,
      backgroundColor: '#061820',
      borderWidth: 1.5, borderColor: 'rgba(45,212,191,0.65)',
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <View style={{ position: 'absolute', width: '100%', height: 1, top: '30%', backgroundColor: 'rgba(45,212,191,0.07)' }} />
      <View style={{ position: 'absolute', width: '100%', height: 1, top: '60%', backgroundColor: 'rgba(45,212,191,0.07)' }} />
      <View style={{ flexDirection: 'row', gap: size * 0.10, marginBottom: size * 0.06, alignItems: 'center' }}>
        {[0, 1].map((i) => (
          <View key={i} style={{ width: eyeR * 2, height: eyeR * 2, borderRadius: eyeR, backgroundColor: 'rgba(45,212,191,0.12)', borderWidth: 1, borderColor: 'rgba(45,212,191,0.9)', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: eyeR, height: eyeR, borderRadius: eyeR / 2, backgroundColor: '#2DD4BF' }} />
          </View>
        ))}
      </View>
      <View style={{ width: size * 0.34, height: size * 0.055, borderRadius: 3, backgroundColor: 'rgba(45,212,191,0.48)' }} />
      <View style={{ position: 'absolute', bottom: size * 0.05, right: size * 0.05, width: size * 0.27, height: size * 0.27, borderRadius: size * 0.07, backgroundColor: '#0A2830', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(45,212,191,0.36)' }}>
        <Text style={{ color: '#2DD4BF', fontSize: size * 0.14, fontWeight: '900' }}>K</Text>
      </View>
    </View>
  );
}

export default function FriendsScreen({ currentUser }) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [friends, setFriends] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [usernameDraft, setUsernameDraft] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friendSnapshot, setFriendSnapshot] = useState(null);
  const [isLoadingFriend, setIsLoadingFriend] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const treeTemplate = useMemo(() => normalizeTree(INIT), []);
  const nodeNameById = useMemo(
    () => new Map(treeTemplate.nodes.map((n) => [n.id, n.name])),
    [treeTemplate.nodes],
  );

  const refreshFriends = useCallback(async () => {
    setIsBusy(true);
    try {
      setFriends(await loadFriends(currentUser?.id ?? null));
    } finally {
      setIsBusy(false);
    }
  }, [currentUser?.id]);

  useEffect(() => { void refreshFriends(); }, [refreshFriends]);

  const onlineFriends = useMemo(() => {
    const real = friends.filter((f) => f.status === 'online');
    return [KINETIC_BOT, ...real];
  }, [friends]);

  const handleAddFriend = async () => {
    const username = usernameDraft.trim();
    if (!username || isBusy) return;
    setIsBusy(true);
    setErrorMessage('');
    setInfoMessage('');
    try {
      const result = await addFriendByUsername(currentUser?.id ?? null, username);
      setFriends(result.friends);
      setUsernameDraft('');
      setInfoMessage('Friend added!');
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to add friend. Try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemoveFriend = (friend) => {
    Alert.alert(
      'Remove friend',
      `Remove ${friend.displayName || friend.username || 'this friend'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            setIsBusy(true);
            try {
              setFriends(await removeFriend(currentUser?.id ?? null, friend.id));
              if (selectedFriend?.id === friend.id) { setSelectedFriend(null); setFriendSnapshot(null); }
            } finally { setIsBusy(false); }
          },
        },
      ],
    );
  };

  const openFriend = async (friend) => {
    if (friend.isBot) return;
    setSelectedFriend(friend);
    setIsLoadingFriend(true);
    setFriendSnapshot(null);
    try {
      setFriendSnapshot(await loadFriendSnapshot(friend.id));
    } finally {
      setIsLoadingFriend(false);
    }
  };

  const selectedVideos = useMemo(() => (
    Object.values(friendSnapshot?.skillVideos ?? {}).sort((a, b) => b.createdAt - a.createdAt)
  ), [friendSnapshot]);

  const unlockedNodes = useMemo(() => (
    (friendSnapshot?.unlockedNodes ?? []).map((e) => ({
      id: e.node_id,
      name: nodeNameById.get(e.node_id) || e.node_id,
    }))
  ), [friendSnapshot?.unlockedNodes, nodeNameById]);

  const TABS = [
    { key: 'all', label: 'All', count: friends.length },
    { key: 'online', label: 'Online', count: onlineFriends.length },
    { key: 'pending', label: 'Pending', count: 0 },
  ];

  const renderFriendRow = (friend, i, arr) => {
    const isLast = i === arr.length - 1;
    return (
      <View key={friend.id} style={[styles.friendRow, !isLast && styles.friendRowBorder]}>
        <FriendAvatar friend={friend} size={46} showStatus />
        <View style={styles.friendMeta}>
          <View style={styles.friendNameRow}>
            <Text style={styles.friendName} numberOfLines={1}>{friend.displayName || friend.username || 'Friend'}</Text>
            {friend.isBot && (
              <View style={styles.botBadge}>
                <Ionicons name="hardware-chip-outline" size={9} color="#2DD4BF" />
                <Text style={styles.botBadgeText}>BOT</Text>
              </View>
            )}
          </View>
          <View style={styles.friendSubRow}>
            {(friend.status || friend.isBot) && (
              <View style={styles.statusRow}>
                <StatusDot status={friend.status || 'offline'} size={6} />
                <Text style={[styles.statusLabel, { color: (STATUS_CONFIG[friend.status || 'offline'] || STATUS_CONFIG.offline).color }]}>
                  {friend.isBot ? 'Always online' : (STATUS_CONFIG[friend.status || 'offline'] || STATUS_CONFIG.offline).label}
                </Text>
              </View>
            )}
            {!friend.isBot && friend.username && (
              <Text style={styles.friendSub} numberOfLines={1}>@{friend.username}</Text>
            )}
          </View>
        </View>
        {!friend.isBot && (
          <>
            <TouchableOpacity style={styles.actionBtn} onPress={() => openFriend(friend)} activeOpacity={0.8}>
              <Ionicons name="bar-chart-outline" size={15} color="#BFE2FF" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.dangerBtn]} onPress={() => handleRemoveFriend(friend)} activeOpacity={0.8}>
              <Ionicons name="trash-outline" size={15} color="#FCA5A5" />
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  const displayList = activeTab === 'online' ? onlineFriends : friends;

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.screenBg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={[styles.heroCard, { backgroundColor: theme.heroBg, borderColor: theme.heroBorder }]}>
          <Text style={styles.heroEyebrow}>FRIENDS</Text>
          <Text style={[styles.heroTitle, { color: theme.textPrimary }]}>Training Circle</Text>
          <Text style={[styles.heroBody, { color: theme.textMuted }]}>Add friends by username and follow their calisthenics journey.</Text>
        </View>

        {/* Add friend */}
        <View style={[styles.card, { backgroundColor: theme.cardBg2, borderColor: theme.cardBorder2 }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Add Friend</Text>
          <View style={styles.addRow}>
            <TextInput
              value={usernameDraft}
              onChangeText={(t) => { setUsernameDraft(t); setErrorMessage(''); setInfoMessage(''); }}
              placeholder="@username"
              placeholderTextColor="rgba(255,255,255,0.28)"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="send"
              onSubmitEditing={handleAddFriend}
              style={styles.input}
            />
            <TouchableOpacity style={styles.addBtn} onPress={handleAddFriend} disabled={isBusy} activeOpacity={0.8}>
              {isBusy ? <ActivityIndicator size="small" color="#BFE2FF" /> : <Ionicons name="person-add-outline" size={18} color="#EAF6FF" />}
            </TouchableOpacity>
          </View>
          {!!errorMessage && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color="#FCA5A5" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}
          {!!infoMessage && (
            <View style={styles.infoRow}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#86EFAC" />
              <Text style={styles.infoText}>{infoMessage}</Text>
            </View>
          )}
        </View>

        {/* Tabs + Friend list */}
        <View style={[styles.card, { backgroundColor: theme.cardBg2, borderColor: theme.cardBorder2 }]}>
          {/* Tab bar */}
          <View style={styles.tabBar}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, isActive && styles.tabActive]}
                  onPress={() => setActiveTab(tab.key)}
                  activeOpacity={0.74}
                >
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
                  {tab.count > 0 && (
                    <View style={[styles.tabCount, isActive && styles.tabCountActive]}>
                      <Text style={[styles.tabCountText, isActive && styles.tabCountTextActive]}>{tab.count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Tab content */}
          {activeTab === 'pending' ? (
            <View style={styles.emptyBox}>
              <Ionicons name="time-outline" size={28} color="rgba(191,226,255,0.28)" />
              <Text style={styles.emptyTitle}>No pending requests</Text>
              <Text style={styles.emptyBody}>Friend requests you send or receive will appear here.</Text>
            </View>
          ) : displayList.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={28} color="rgba(191,226,255,0.3)" />
              <Text style={styles.emptyTitle}>{activeTab === 'online' ? 'Nobody online' : 'No friends yet'}</Text>
              <Text style={styles.emptyBody}>
                {activeTab === 'online'
                  ? 'No friends are currently online.'
                  : 'Add someone above to see their skills and attempt videos.'}
              </Text>
            </View>
          ) : (
            displayList.map((friend, i, arr) => renderFriendRow(friend, i, arr))
          )}
        </View>

      </ScrollView>

      {/* Friend snapshot modal */}
      <Modal
        visible={!!selectedFriend}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => { setSelectedFriend(null); setFriendSnapshot(null); }}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => { setSelectedFriend(null); setFriendSnapshot(null); }}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <FriendAvatar friend={selectedFriend ?? {}} size={48} showStatus />
              <View style={styles.modalHeaderMeta}>
                <Text style={styles.modalTitle}>{selectedFriend?.displayName || selectedFriend?.username || 'Friend'}</Text>
                {selectedFriend?.username && <Text style={styles.modalSub}>@{selectedFriend.username}</Text>}
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => { setSelectedFriend(null); setFriendSnapshot(null); }}
              >
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.72)" />
              </TouchableOpacity>
            </View>

            {isLoadingFriend ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#BFE2FF" />
                <Text style={styles.loadingText}>Loading their progress...</Text>
              </View>
            ) : !friendSnapshot ? (
              <View style={styles.loadingBox}>
                <Ionicons name="cloud-offline-outline" size={24} color="rgba(255,255,255,0.4)" />
                <Text style={styles.loadingText}>No shared data available yet.</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
                <View style={styles.statsRow}>
                  {[
                    { label: 'Skills', value: friendSnapshot.unlockedNodes.length },
                    { label: 'Level', value: friendSnapshot.progress?.level || 1 },
                    { label: 'Videos', value: selectedVideos.length },
                  ].map(({ label, value }) => (
                    <View key={label} style={styles.statTile}>
                      <Text style={styles.statValue}>{value}</Text>
                      <Text style={styles.statLabel}>{label}</Text>
                    </View>
                  ))}
                </View>

                {selectedVideos.length > 0 && (
                  <View style={styles.modalSection}>
                    <Text style={styles.sectionTitle}>Attempt Videos</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.videosRow}>
                      {selectedVideos.map((video) => (
                        <FriendVideoCard
                          key={`${video.nodeId}_${video.createdAt}`}
                          title={nodeNameById.get(video.nodeId) || video.nodeId}
                          uri={video.remoteUrl || video.localUri}
                        />
                      ))}
                    </ScrollView>
                  </View>
                )}

                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Unlocked Skills</Text>
                  {unlockedNodes.length === 0 ? (
                    <Text style={styles.emptyBody}>No skills visible yet.</Text>
                  ) : (
                    <View style={styles.chipWrap}>
                      {unlockedNodes.map((node) => (
                        <View key={node.id} style={styles.skillChip}>
                          <Ionicons name="checkmark-circle" size={13} color="#86EFAC" />
                          <Text style={styles.skillChipText}>{node.name}</Text>
                        </View>
                      ))}
                    </View>
                  )}
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
  root: { flex: 1, backgroundColor: Colors.background.primary },
  content: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 32, gap: 14 },

  heroCard: {
    borderRadius: 26, padding: 18, gap: 6,
    backgroundColor: 'rgba(8,12,22,0.9)',
    borderWidth: 1, borderColor: 'rgba(125,211,252,0.14)',
  },
  heroEyebrow: { color: '#FFE39A', fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
  heroTitle: { color: '#F8FBFF', fontSize: 26, fontWeight: '800' },
  heroBody: { color: 'rgba(225,236,248,0.6)', fontSize: 14, lineHeight: 20 },

  card: {
    borderRadius: 22, padding: 16, gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  sectionTitle: { color: '#F8FBFF', fontSize: 15, fontWeight: '800' },

  addRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1, height: 46, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    color: '#FFFFFF', fontSize: 14, paddingHorizontal: 14,
  },
  addBtn: {
    width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(13,58,86,0.9)',
    borderWidth: 1, borderColor: 'rgba(125,211,252,0.2)',
  },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  errorText: { flex: 1, color: 'rgba(252,165,165,0.88)', fontSize: 12, lineHeight: 17 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { color: 'rgba(134,239,172,0.8)', fontSize: 12 },

  // Tabs
  tabBar: { flexDirection: 'row', gap: 6 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  tabActive: {
    backgroundColor: 'rgba(125,211,252,0.12)',
    borderColor: 'rgba(125,211,252,0.28)',
  },
  tabText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: '#BFE2FF' },
  tabCount: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tabCountActive: { backgroundColor: 'rgba(125,211,252,0.18)' },
  tabCountText: { color: 'rgba(255,255,255,0.46)', fontSize: 10, fontWeight: '800' },
  tabCountTextActive: { color: '#7DD3FC' },

  emptyBox: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyTitle: { color: '#F8FBFF', fontSize: 15, fontWeight: '700' },
  emptyBody: { color: 'rgba(225,236,248,0.46)', fontSize: 13, lineHeight: 18, textAlign: 'center' },

  friendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
  },
  friendRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  avatar: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(13,58,86,0.52)',
    borderWidth: 1, borderColor: 'rgba(125,211,252,0.16)',
    overflow: 'hidden',
  },
  avatarInitial: { color: '#BFE2FF', fontWeight: '800' },
  friendMeta: { flex: 1, gap: 3 },
  friendNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  friendName: { color: '#F8FBFF', fontSize: 14, fontWeight: '700' },
  botBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7,
    backgroundColor: 'rgba(6,40,50,0.80)', borderWidth: 1, borderColor: 'rgba(45,212,191,0.32)',
  },
  botBadgeText: { color: '#2DD4BF', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  friendSubRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusLabel: { fontSize: 11, fontWeight: '600' },
  friendSub: { color: 'rgba(225,236,248,0.44)', fontSize: 12 },
  actionBtn: {
    width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  dangerBtn: { backgroundColor: 'rgba(76,18,28,0.6)', borderColor: 'rgba(248,113,113,0.14)' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  modalCard: {
    maxHeight: '84%', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    backgroundColor: 'rgba(8,12,20,0.99)',
    borderWidth: 1, borderColor: 'rgba(125,211,252,0.14)', overflow: 'hidden',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, backgroundColor: 'rgba(255,255,255,0.14)' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  modalHeaderMeta: { flex: 1 },
  modalTitle: { color: '#F8FBFF', fontSize: 20, fontWeight: '800' },
  modalSub: { color: 'rgba(191,226,255,0.5)', fontSize: 13, marginTop: 2 },
  modalCloseBtn: {
    width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  loadingBox: { minHeight: 200, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: 'rgba(225,236,248,0.52)', fontSize: 14 },
  modalContent: { paddingHorizontal: 18, paddingBottom: 28, gap: 18 },

  statsRow: { flexDirection: 'row', gap: 10, paddingTop: 4 },
  statTile: {
    flex: 1, minHeight: 80, borderRadius: 16, padding: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  statValue: { color: '#F8FBFF', fontSize: 26, fontWeight: '800' },
  statLabel: { color: 'rgba(191,226,255,0.46)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },

  modalSection: { gap: 10 },
  videosRow: { gap: 12, paddingRight: 4 },
  friendVideoCard: { width: 170, gap: 6 },
  friendVideoStage: {
    height: 110, borderRadius: 16, overflow: 'hidden',
    backgroundColor: 'rgba(6,13,22,0.92)',
    borderWidth: 1, borderColor: 'rgba(125,211,252,0.14)',
  },
  friendVideoTitle: { color: '#F8FBFF', fontSize: 12, fontWeight: '700' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  skillChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12,
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.14)',
  },
  skillChipText: { color: '#D8FFE8', fontSize: 12, fontWeight: '700' },
});
