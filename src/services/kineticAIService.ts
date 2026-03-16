import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAT_STORAGE_KEY = '@kinetic/ai_chat/v2';
const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_HISTORY = 40; // messages to keep in memory (20 turns)

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: number;
};

// ─── System prompt ────────────────────────────────────────────────────────────
// Full knowledge of the Kinetic skill tree baked in so every response is accurate.
const SYSTEM_PROMPT = `You are Kinetic Bot — an expert calisthenics coach built into the Kinetic app, a progressive skill tree for bodyweight training.

THE KINETIC SKILL TREE
The app has 10 nodes arranged in two main branches. Users unlock nodes by recording a short video of themselves performing the skill. Once a node is unlocked it glows on the tree. Unlocking skills increases the user's ELO rating (starts at 800, +45 per skill). Nodes can only be unlocked when all prerequisites are met.

PUSH BRANCH (overhead/pushing movements):
• Push-Up [pushup] — Str 3/10 · Bal 2/10 · Tec 2/10
  "Standard push-up. The foundation of all pushing movements."
  Prerequisites: Start

• Diamond Push-Up [diamond_pu] — Str 5/10 · Bal 3/10 · Tec 4/10
  "Tricep push-up with hands forming a diamond shape."
  Prerequisites: Push-Up

• Pike Push-Up [pike_pu] — Str 5/10 · Bal 5/10 · Tec 6/10
  "Shoulder push-up in pike position. Direct prerequisite for HSPU."
  Prerequisites: Diamond Push-Up

• HSPU [hspu] — Str 9/10 · Bal 9/10 · Tec 9/10
  "Handstand Push-Up. The pinnacle of overhead pressing strength."
  Prerequisites: Pike Push-Up

PULL BRANCH (hanging/pulling movements):
• Dead Hang [dead_hang] — Str 3/10 · Bal 2/10 · Tec 1/10
  "Hang from bar, arms fully extended. Builds grip and shoulder health."
  Prerequisites: Start

• Active Hang [active_hang] — Str 4/10 · Bal 3/10 · Tec 3/10
  "Hang with shoulders actively depressed and engaged. Crucial for safety."
  Prerequisites: Dead Hang

• Scapular Pulls [scap_pulls] — Str 4/10 · Bal 3/10 · Tec 5/10
  "Retract and depress scapula while hanging. Activates the lats."
  Prerequisites: Active Hang

• Neg. Pull-Up [neg_pullup] — Str 6/10 · Bal 4/10 · Tec 4/10
  "Lower slowly from the top of a pull-up. Eccentric strength builder."
  Prerequisites: Active Hang

• Pull-Up [pullup] — Str 7/10 · Bal 5/10 · Tec 5/10
  "Full pull-up from dead hang to chin over bar. The upper body king."
  Prerequisites: Scapular Pulls + Neg. Pull-Up

NEUTRAL:
• Start [start] — The origin node. Already unlocked for everyone. Represents beginning the journey.

COACHING STYLE
- Be concise and specific — 2-5 sentences is ideal, longer only when technique really needs it
- Reference the skill tree and node names when giving progression advice
- If a user mentions they've unlocked specific skills, tailor advice to their level
- Be encouraging but honest about difficulty (HSPU is genuinely hard)
- Give actionable cues, not just generic encouragement
- You can use light formatting but avoid heavy markdown since this is a mobile chat UI`;

// ─── Storage ──────────────────────────────────────────────────────────────────
export async function loadChatHistory(): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveChatHistory(messages: ChatMessage[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-200)));
  } catch { /* ignore */ }
}

export async function clearChatHistory(): Promise<void> {
  await AsyncStorage.removeItem(CHAT_STORAGE_KEY);
}

// ─── API call ─────────────────────────────────────────────────────────────────
export async function sendMessage(
  userText: string,
  history: ChatMessage[],
  userContext?: { unlockedCount?: number; level?: number; eloRating?: number },
): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

  if (!apiKey) {
    return "⚠️ Add your Anthropic API key to .env as EXPO_PUBLIC_ANTHROPIC_API_KEY to enable AI chat.";
  }

  // Build context injection for the user's current progress
  let contextNote = '';
  if (userContext) {
    const parts: string[] = [];
    if (userContext.unlockedCount != null) parts.push(`${userContext.unlockedCount} skills unlocked`);
    if (userContext.level != null) parts.push(`level ${userContext.level}`);
    if (userContext.eloRating != null) parts.push(`ELO ${userContext.eloRating}`);
    if (parts.length) contextNote = `[User's current progress: ${parts.join(', ')}] `;
  }

  // Convert stored history to Anthropic message format (keep last MAX_HISTORY)
  const recentHistory = history.slice(-MAX_HISTORY);
  const apiMessages = recentHistory.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Append the new user message with optional context
  apiMessages.push({
    role: 'user',
    content: contextNote + userText,
  });

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.warn('Kinetic AI error:', response.status, err);
    if (response.status === 401) return "I can't connect right now — check that your API key is valid.";
    if (response.status === 429) return "I'm getting a lot of questions right now — try again in a moment.";
    return "Something went wrong on my end. Try again in a sec.";
  }

  const data = await response.json();
  return data?.content?.[0]?.text ?? "I didn't catch that — could you rephrase?";
}
