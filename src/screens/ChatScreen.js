import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadFriends } from '../services/friendsService';
import { useTheme } from '../theme/ThemeContext';
import {
  clearChatHistory,
  loadChatHistory,
  saveChatHistory,
  sendMessage,
} from '../services/kineticAIService';

// ─── Constants ────────────────────────────────────────────────────────────────
const KINETIC_BOT_ID = '__kinetic_ai__';
const KINETIC_BOT = {
  id: KINETIC_BOT_ID,
  displayName: 'Kinetic Bot',
  username: 'kinetic.bot',
  isAI: true,
};

const FRIEND_CHAT_PREFIX = '@kinetic/friend_chat/v1/';
const THEME_STORAGE_KEY = '@kinetic/chat_theme/v1/';

const CHAT_THEMES = [
  { id: 'blue',   name: 'Ocean',  accent: '#7DD3FC', friendBg: 'rgba(12,44,76,0.90)',  friendBorder: 'rgba(125,211,252,0.22)' },
  { id: 'purple', name: 'Nebula', accent: '#C084FC', friendBg: 'rgba(50,12,90,0.90)',  friendBorder: 'rgba(192,132,252,0.22)' },
  { id: 'green',  name: 'Forest', accent: '#4ADE80', friendBg: 'rgba(12,56,30,0.90)',  friendBorder: 'rgba(74,222,128,0.22)'  },
  { id: 'orange', name: 'Ember',  accent: '#FB923C', friendBg: 'rgba(70,30,8,0.90)',   friendBorder: 'rgba(251,146,60,0.22)'  },
  { id: 'rose',   name: 'Rose',   accent: '#FB7185', friendBg: 'rgba(70,10,30,0.90)',  friendBorder: 'rgba(251,113,133,0.22)' },
  { id: 'teal',   name: 'Teal',   accent: '#2DD4BF', friendBg: 'rgba(10,50,50,0.90)',  friendBorder: 'rgba(45,212,191,0.22)'  },
];
const DEFAULT_THEME = CHAT_THEMES[0];

// ─── Shared helpers ───────────────────────────────────────────────────────────
async function loadFriendMessages(friendId) {
  try {
    const raw = await AsyncStorage.getItem(`${FRIEND_CHAT_PREFIX}${friendId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

async function saveFriendMessages(friendId, messages) {
  try {
    await AsyncStorage.setItem(`${FRIEND_CHAT_PREFIX}${friendId}`, JSON.stringify(messages.slice(-200)));
  } catch { /* ignore */ }
}

async function loadChatTheme(contactId) {
  try {
    const raw = await AsyncStorage.getItem(`${THEME_STORAGE_KEY}${contactId}`);
    return CHAT_THEMES.find((t) => t.id === raw) || DEFAULT_THEME;
  } catch { return DEFAULT_THEME; }
}

async function saveChatTheme(contactId, themeId) {
  try { await AsyncStorage.setItem(`${THEME_STORAGE_KEY}${contactId}`, themeId); } catch { /* ignore */ }
}

// ─── Avatar components ────────────────────────────────────────────────────────
function KineticBotAvatar({ size = 42 }) {
  const br = size * 0.22;
  const eyeR = size * 0.13;
  return (
    <View style={{
      width: size, height: size, borderRadius: br,
      backgroundColor: '#061820',
      borderWidth: 1.5, borderColor: 'rgba(45,212,191,0.65)',
      alignItems: 'center', justifyContent: 'center',
      shadowColor: '#2DD4BF', shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.55, shadowRadius: size * 0.22, elevation: 6,
      overflow: 'hidden',
    }}>
      {/* Scan-line shimmer */}
      <View style={{ position: 'absolute', width: '100%', height: 1, top: '30%', backgroundColor: 'rgba(45,212,191,0.07)' }} />
      <View style={{ position: 'absolute', width: '100%', height: 1, top: '60%', backgroundColor: 'rgba(45,212,191,0.07)' }} />
      {/* Eyes */}
      <View style={{ flexDirection: 'row', gap: size * 0.10, marginBottom: size * 0.06, alignItems: 'center' }}>
        {[0, 1].map((i) => (
          <View key={i} style={{ width: eyeR * 2, height: eyeR * 2, borderRadius: eyeR, backgroundColor: 'rgba(45,212,191,0.12)', borderWidth: 1, borderColor: 'rgba(45,212,191,0.9)', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: eyeR, height: eyeR, borderRadius: eyeR / 2, backgroundColor: '#2DD4BF' }} />
          </View>
        ))}
      </View>
      {/* Mouth */}
      <View style={{ width: size * 0.34, height: size * 0.055, borderRadius: 3, backgroundColor: 'rgba(45,212,191,0.48)' }} />
      {/* K badge */}
      <View style={{ position: 'absolute', bottom: size * 0.05, right: size * 0.05, width: size * 0.27, height: size * 0.27, borderRadius: size * 0.07, backgroundColor: '#0A2830', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(45,212,191,0.36)' }}>
        <Text style={{ color: '#2DD4BF', fontSize: size * 0.14, fontWeight: '900' }}>K</Text>
      </View>
    </View>
  );
}

function FriendAvatar({ friend, size = 42 }) {
  const br = size * 0.34;
  if (!friend || friend.isAI) return <KineticBotAvatar size={size} />;
  return (
    <View style={{ width: size, height: size, borderRadius: br, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(13,58,86,0.6)', borderWidth: 1, borderColor: 'rgba(125,211,252,0.18)', overflow: 'hidden' }}>
      {friend.avatarUrl ? (
        <Image source={{ uri: friend.avatarUrl }} style={{ width: size, height: size, borderRadius: br }} />
      ) : (
        <Text style={{ color: '#BFE2FF', fontSize: size * 0.38, fontWeight: '800' }}>
          {(friend.displayName || friend.username || 'F').charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

// ─── Theme Picker Modal ───────────────────────────────────────────────────────
function ThemePickerModal({ visible, currentThemeId, onSelect, onDismiss }) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <TouchableOpacity style={styles.themeOverlay} onPress={onDismiss} activeOpacity={1}>
        <TouchableOpacity activeOpacity={1} style={styles.themeSheet}>
          <Text style={styles.themeTitle}>Chat Theme</Text>
          <View style={styles.themeGrid}>
            {CHAT_THEMES.map((theme) => {
              const isSelected = currentThemeId === theme.id;
              return (
                <TouchableOpacity
                  key={theme.id}
                  style={[styles.themeOption, isSelected && { borderColor: theme.accent, borderWidth: 2 }]}
                  onPress={() => { onSelect(theme.id); onDismiss(); }}
                  activeOpacity={0.76}
                >
                  <View style={[styles.themeSwatch, { backgroundColor: theme.friendBg.replace(/0\.\d+\)/, '1)'), borderColor: theme.accent, borderWidth: 1.5 }]} />
                  <Text style={[styles.themeOptionName, isSelected && { color: theme.accent }]}>{theme.name}</Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={14} color={theme.accent} style={{ marginTop: 2 }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Contact list ─────────────────────────────────────────────────────────────
function ContactList({ currentUser, onSelect }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastMessages, setLastMessages] = useState({});
  const [themes, setThemes] = useState({});
  const insets = useSafeAreaInsets();
  const appTheme = useTheme();

  useEffect(() => {
    setLoading(true);
    loadFriends(currentUser?.id ?? null).then(async (list) => {
      setFriends(list);
      const previews = {};
      const loadedThemes = {};
      const allIds = [KINETIC_BOT_ID, ...list.map((f) => f.id)];
      await Promise.all(allIds.map(async (id) => {
        const msgs = id === KINETIC_BOT_ID ? await loadChatHistory() : await loadFriendMessages(id);
        if (msgs.length > 0) previews[id] = msgs[msgs.length - 1];
        loadedThemes[id] = await loadChatTheme(id);
      }));
      setLastMessages(previews);
      setThemes(loadedThemes);
      setLoading(false);
    });
  }, [currentUser?.id]);

  const contacts = [KINETIC_BOT, ...friends];

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: appTheme.screenBg }]}>
      <View style={[styles.listHeader, { borderBottomColor: appTheme.dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }]}>
        <Text style={[styles.listHeaderTitle, { color: appTheme.textPrimary }]}>Messages</Text>
        {loading && <ActivityIndicator size="small" color="rgba(45,212,191,0.6)" />}
      </View>
      <ScrollView contentContainerStyle={styles.contactListContent} showsVerticalScrollIndicator={false}>
        {contacts.map((contact, i) => {
          const last = lastMessages[contact.id];
          const isBot = contact.id === KINETIC_BOT_ID;
          const theme = themes[contact.id] || DEFAULT_THEME;
          return (
            <TouchableOpacity
              key={contact.id}
              style={[styles.contactRow, isBot && styles.contactRowBot, i === contacts.length - 1 && styles.contactRowLast]}
              onPress={() => onSelect(contact)}
              activeOpacity={0.74}
            >
              <FriendAvatar friend={contact} size={50} />
              <View style={styles.contactMeta}>
                <View style={styles.contactNameRow}>
                  <Text style={[styles.contactName, isBot && styles.contactNameBot]} numberOfLines={1}>
                    {contact.displayName}
                  </Text>
                  {isBot && (
                    <View style={styles.botBadge}>
                      <Ionicons name="hardware-chip-outline" size={9} color="#2DD4BF" />
                      <Text style={styles.botBadgeText}>BOT</Text>
                    </View>
                  )}
                  {!isBot && (
                    <View style={[styles.themeDot, { backgroundColor: theme.accent }]} />
                  )}
                </View>
                <Text style={[styles.contactPreview, isBot && styles.contactPreviewBot]} numberOfLines={1}>
                  {last
                    ? (last.role === 'user' ? 'You: ' : '') + (last.content ?? last.text ?? '')
                    : isBot ? 'Your AI training companion' : 'No messages yet'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.22)" />
            </TouchableOpacity>
          );
        })}
        {contacts.length === 1 && !loading && (
          <View style={styles.noFriendsHint}>
            <Ionicons name="people-outline" size={20} color="rgba(191,226,255,0.3)" />
            <Text style={styles.noFriendsText}>Add friends in the Friends tab to chat with them here.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Conversation view ────────────────────────────────────────────────────────
function ConversationView({ contact, currentUser, userData, onBack }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const scrollRef = useRef(null);
  const insets = useSafeAreaInsets();
  const isBot = contact.id === KINETIC_BOT_ID;

  const userContext = userData ? {
    unlockedCount: userData.unlockedNodes?.length ?? 0,
    level: userData.progress?.level ?? 1,
  } : undefined;

  useEffect(() => {
    loadChatTheme(contact.id).then(setTheme);
  }, [contact.id]);

  useEffect(() => {
    const loader = isBot ? loadChatHistory : () => loadFriendMessages(contact.id);
    loader().then((history) => {
      if (history.length === 0 && isBot) {
        const greeting = {
          id: 'bot_0', role: 'assistant',
          content: "Hey! I'm Kinetic Bot — your personal calisthenics coach. I know every skill in the tree and can help with progressions, technique, and programming. What are you working on? 💪",
          ts: Date.now(),
        };
        setMessages([greeting]);
        saveChatHistory([greeting]);
      } else {
        setMessages(history);
      }
    });
  }, [contact.id, isBot]);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages.length, isTyping]);

  const handleThemeSelect = useCallback((themeId) => {
    const next = CHAT_THEMES.find((t) => t.id === themeId) || DEFAULT_THEME;
    setTheme(next);
    saveChatTheme(contact.id, themeId);
  }, [contact.id]);

  const handleMenu = useCallback(() => {
    Alert.alert(
      contact.displayName,
      undefined,
      [
        {
          text: 'Choose Theme',
          onPress: () => setShowThemePicker(true),
        },
        {
          text: 'Clear Chat',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Clear chat', 'Start a fresh conversation?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Clear', style: 'destructive',
                onPress: async () => {
                  if (isBot) await clearChatHistory();
                  else await saveFriendMessages(contact.id, []);
                  const reset = isBot ? [{
                    id: `bot_${Date.now()}`, role: 'assistant',
                    content: "Fresh start! What are you training today?", ts: Date.now(),
                  }] : [];
                  setMessages(reset);
                  if (isBot) saveChatHistory(reset);
                },
              },
            ]);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [contact.displayName, contact.id, isBot]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || isTyping) return;

    const userMsg = { id: `u_${Date.now()}`, role: 'user', content: text, ts: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    setDraft('');

    if (isBot) {
      setIsTyping(true);
      try {
        const reply = await sendMessage(text, next, userContext);
        const botMsg = { id: `bot_${Date.now()}`, role: 'assistant', content: reply, ts: Date.now() };
        const withReply = [...next, botMsg];
        setMessages(withReply);
        saveChatHistory(withReply);
      } catch {
        const errMsg = { id: `err_${Date.now()}`, role: 'assistant', content: "Connection issue — try again.", ts: Date.now() };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsTyping(false);
      }
    } else {
      saveFriendMessages(contact.id, next);
    }
  }, [draft, isTyping, messages, isBot, contact.id, userContext]);

  const headerAccent = isBot ? '#2DD4BF' : theme.accent;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.convHeader, { borderBottomColor: `${headerAccent}22` }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.72)" />
        </TouchableOpacity>
        <FriendAvatar friend={contact} size={38} />
        <View style={styles.convHeaderMeta}>
          <Text style={styles.convHeaderName} numberOfLines={1}>{contact.displayName}</Text>
          {isBot ? (
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={[styles.convHeaderSub, { color: 'rgba(45,212,191,0.64)' }]}>Bot · Always available</Text>
            </View>
          ) : (
            <Text style={[styles.convHeaderSub, { color: `${theme.accent}88` }]}>@{contact.username || 'friend'}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.menuBtn} onPress={handleMenu} activeOpacity={0.7}>
          <Ionicons name="ellipsis-horizontal" size={18} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 8 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {!isBot && messages.length === 0 && (
          <View style={styles.localNote}>
            <Ionicons name="lock-closed-outline" size={13} color="rgba(191,226,255,0.36)" />
            <Text style={styles.localNoteText}>Messages are stored on your device only.</Text>
          </View>
        )}
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const text = msg.content ?? msg.text ?? '';
          return (
            <View key={msg.id} style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowOther]}>
              {!isUser && (
                <View style={styles.msgAvatar}>
                  <FriendAvatar friend={contact} size={28} />
                </View>
              )}
              <View style={[
                styles.bubble,
                isUser
                  ? styles.bubbleUser
                  : isBot
                    ? styles.bubbleBot
                    : { backgroundColor: theme.friendBg, borderColor: theme.friendBorder, borderWidth: 1, borderBottomLeftRadius: 5 },
              ]}>
                <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{text}</Text>
              </View>
            </View>
          );
        })}
        {isTyping && (
          <View style={[styles.msgRow, styles.msgRowOther]}>
            <View style={styles.msgAvatar}><FriendAvatar friend={contact} size={28} /></View>
            <View style={[styles.bubble, styles.bubbleBot, styles.typingBubble]}>
              <ActivityIndicator size="small" color="rgba(45,212,191,0.8)" />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12), borderTopColor: `${headerAccent}18` }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={isBot ? 'Ask anything about calisthenics...' : 'Message...'}
          placeholderTextColor={isBot ? 'rgba(45,212,191,0.38)' : `${theme.accent}44`}
          style={[styles.input, { borderColor: isBot ? 'rgba(45,212,191,0.2)' : `${theme.accent}28` }]}
          multiline
          maxLength={800}
          blurOnSubmit={false}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!draft.trim() || isTyping) && styles.sendBtnDisabled,
            { backgroundColor: isBot ? 'rgba(45,212,191,0.28)' : `${theme.accent}28`, borderColor: isBot ? 'rgba(45,212,191,0.4)' : `${theme.accent}55` },
          ]}
          onPress={handleSend}
          disabled={!draft.trim() || isTyping}
          activeOpacity={0.76}
        >
          <Ionicons name="arrow-up" size={20} color="#EAF6FF" />
        </TouchableOpacity>
      </View>

      <ThemePickerModal
        visible={showThemePicker}
        currentThemeId={theme.id}
        onSelect={handleThemeSelect}
        onDismiss={() => setShowThemePicker(false)}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────
export default function ChatScreen({ userData, currentUser, onConversationChange }) {
  const [activeContact, setActiveContact] = useState(null);

  const openConversation = useCallback((contact) => {
    setActiveContact(contact);
    onConversationChange?.(true);
  }, [onConversationChange]);

  const closeConversation = useCallback(() => {
    setActiveContact(null);
    onConversationChange?.(false);
  }, [onConversationChange]);

  if (activeContact) {
    return (
      <ConversationView
        contact={activeContact}
        currentUser={currentUser}
        userData={userData}
        onBack={closeConversation}
      />
    );
  }

  return <ContactList currentUser={currentUser} onSelect={openConversation} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050309' },

  // Contact list
  listHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 52, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  listHeaderTitle: { color: '#F8FBFF', fontSize: 22, fontWeight: '800', paddingLeft: 42 },
  contactListContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  contactRowBot: {
    backgroundColor: 'rgba(6,24,32,0.60)',
    borderRadius: 18, paddingHorizontal: 10,
    borderWidth: 1, borderColor: 'rgba(45,212,191,0.18)',
    borderBottomWidth: 1,
    marginBottom: 6, marginTop: 4,
    shadowColor: '#2DD4BF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 2,
  },
  contactRowLast: { borderBottomWidth: 0 },
  contactMeta: { flex: 1, gap: 3 },
  contactNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  contactName: { color: '#F8FBFF', fontSize: 15, fontWeight: '700' },
  contactNameBot: { color: '#E0FAFA' },
  botBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7,
    backgroundColor: 'rgba(6,40,50,0.80)', borderWidth: 1, borderColor: 'rgba(45,212,191,0.32)',
  },
  botBadgeText: { color: '#2DD4BF', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  themeDot: { width: 7, height: 7, borderRadius: 4, opacity: 0.8 },
  contactPreview: { color: 'rgba(225,236,248,0.42)', fontSize: 13 },
  contactPreviewBot: { color: 'rgba(45,212,191,0.50)' },
  noFriendsHint: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 20, padding: 16, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  noFriendsText: { flex: 1, color: 'rgba(191,226,255,0.44)', fontSize: 13, lineHeight: 18 },

  // Conversation
  convHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1,
    backgroundColor: 'rgba(8,6,16,0.97)',
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  convHeaderMeta: { flex: 1, gap: 2 },
  convHeaderName: { color: '#F8FBFF', fontSize: 16, fontWeight: '800' },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80', shadowColor: '#4ADE80', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 4 },
  convHeaderSub: { fontSize: 12 },
  menuBtn: {
    width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },

  // Messages
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 14, paddingTop: 14, gap: 8 },
  localNote: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12,
    padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  localNoteText: { flex: 1, color: 'rgba(191,226,255,0.4)', fontSize: 12 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  msgAvatar: { marginBottom: 2 },
  bubble: { maxWidth: '80%', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: {
    backgroundColor: 'rgba(14,60,100,0.92)', borderWidth: 1, borderColor: 'rgba(125,211,252,0.2)',
    borderBottomRightRadius: 5,
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8,
  },
  bubbleBot: {
    backgroundColor: 'rgba(6,30,36,0.72)', borderWidth: 1, borderColor: 'rgba(45,212,191,0.22)',
    borderBottomLeftRadius: 5,
    shadowColor: '#2DD4BF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 8,
  },
  typingBubble: { paddingVertical: 14, paddingHorizontal: 20 },
  bubbleText: { color: 'rgba(230,240,255,0.9)', fontSize: 14, lineHeight: 21 },
  bubbleTextUser: { color: '#D7EFFF', fontWeight: '500' },

  // Input
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 14, paddingTop: 10,
    borderTopWidth: 1,
    backgroundColor: 'rgba(8,6,16,0.95)',
  },
  input: {
    flex: 1, minHeight: 46, maxHeight: 120, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.055)', borderWidth: 1,
    color: '#FFFFFF', fontSize: 14, paddingHorizontal: 16, paddingVertical: 12,
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.32, shadowRadius: 8, elevation: 4,
  },
  sendBtnDisabled: { opacity: 0.3 },

  // Theme picker
  themeOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center', justifyContent: 'flex-end',
  },
  themeSheet: {
    width: '100%', backgroundColor: '#0D0B1A',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  themeTitle: { color: '#F8FBFF', fontSize: 17, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  themeOption: {
    alignItems: 'center', gap: 6, width: 70,
    padding: 8, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  themeSwatch: { width: 42, height: 42, borderRadius: 12 },
  themeOptionName: { color: 'rgba(255,255,255,0.62)', fontSize: 11, fontWeight: '600' },
});
