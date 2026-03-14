import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthBackdrop from '../components/AuthBackdrop';
import { Colors } from '../theme/colors';

function SettingsRow({
  icon,
  accent,
  label,
  value,
  children,
  onPress,
  isLast = false,
}) {
  const content = (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <View style={styles.rowLeft}>
        <View style={[styles.rowIconWrap, { backgroundColor: `${accent}18`, borderColor: `${accent}28` }]}>
          <Ionicons name={icon} size={18} color={accent} />
        </View>
        <Text style={styles.label}>{label}</Text>
      </View>
      {children || <Text style={styles.valueDim}>{value}</Text>}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress}>
      {content}
    </TouchableOpacity>
  );
}

function ActionButton({
  label,
  tone = 'blue',
  onPress,
}) {
  const toneMap = {
    red: {
      bg: 'rgba(248,113,113,0.12)',
      border: 'rgba(248,113,113,0.18)',
      text: '#FCA5A5',
      glow: 'rgba(248,113,113,0.12)',
    },
    green: {
      bg: 'rgba(74,222,128,0.12)',
      border: 'rgba(74,222,128,0.18)',
      text: '#86EFAC',
      glow: 'rgba(74,222,128,0.12)',
    },
    blue: {
      bg: 'rgba(96,165,250,0.12)',
      border: 'rgba(125,211,252,0.18)',
      text: '#BFE2FF',
      glow: 'rgba(96,165,250,0.12)',
    },
  };

  const resolved = toneMap[tone] || toneMap.blue;

  return (
    <TouchableOpacity
      style={[styles.actionBtn, { backgroundColor: resolved.bg, borderColor: resolved.border }]}
      activeOpacity={0.78}
      onPress={onPress}
    >
      <View style={[styles.actionGlow, { backgroundColor: resolved.glow }]} />
      <Text style={[styles.actionBtnT, { color: resolved.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen({
  onResetProgress,
  onUnlockAll,
  onEditTree,
  onSignOut,
  userEmail,
  userRole,
}) {
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const insets = useSafeAreaInsets();
  const normalizedRole = String(userRole || 'user').toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN';

  return (
    <View style={styles.root}>
      <AuthBackdrop style={styles.backdrop} />
      <View style={styles.pageTint} />

      <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 72 }]}>
        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <Text style={styles.eyebrow}>SETTINGS</Text>
          <Text style={styles.pageTitle}>Control Room</Text>
          <Text style={styles.pageBody}>
            Account state, sync behavior, tree admin tools, and session controls all live here with the same neon-space language as the tree.
          </Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaPill}>
              <Text style={styles.heroMetaLabel}>SIGNED IN</Text>
              <Text style={styles.heroMetaValue}>{userEmail || 'Unknown account'}</Text>
            </View>
            <View style={[styles.roleBadge, isAdmin ? styles.roleBadgeAdmin : styles.roleBadgeUser]}>
              <Text style={[styles.roleBadgeText, isAdmin ? styles.roleBadgeTextAdmin : styles.roleBadgeTextUser]}>{normalizedRole}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionHeader}>Account</Text>
        <View style={styles.section}>
          <SettingsRow icon="mail-outline" accent="#7DD3FC" label="Signed In" value={userEmail || 'Unknown account'} />
          <SettingsRow icon="shield-checkmark-outline" accent={isAdmin ? '#C4B5FD' : '#86EFAC'} label="Role" value={normalizedRole} />
          <SettingsRow icon="cloud-done-outline" accent="#60A5FA" label="Data Sync" value="Supabase" isLast />
        </View>

        <Text style={styles.sectionHeader}>Preferences</Text>
        <View style={styles.section}>
          <SettingsRow icon="notifications-outline" accent="#7DD3FC" label="Notifications">
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(96,165,250,0.38)' }}
              thumbColor={notifications ? '#BFE2FF' : 'rgba(255,255,255,0.55)'}
            />
          </SettingsRow>
          <SettingsRow icon="moon-outline" accent="#86EFAC" label="Dark Theme">
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(74,222,128,0.32)' }}
              thumbColor={darkMode ? '#B7F5CC' : 'rgba(255,255,255,0.55)'}
            />
          </SettingsRow>
          <SettingsRow icon="sparkles-outline" accent="#FDE68A" label="Cloud Save" value="Automatic" isLast />
        </View>

        {!!onEditTree && (
          <>
            <Text style={styles.sectionHeader}>Tree Tools</Text>
            <View style={styles.section}>
              <SettingsRow
                icon="construct-outline"
                accent="#7DD3FC"
                label="Edit Tree"
                value="Open builder"
                isLast
                onPress={onEditTree}
              />
            </View>
          </>
        )}

        {(onResetProgress || onUnlockAll) && (
          <>
            <Text style={styles.sectionHeader}>Danger Zone</Text>
            <View style={styles.section}>
              <Text style={styles.dangerBody}>
                Use these only when you want to fully reset or fully reveal the current tree.
              </Text>
              <View style={styles.actionStack}>
                {onResetProgress && (
                  <ActionButton
                    label="Reset Progress"
                    tone="red"
                    onPress={() => {
                      Alert.alert('Reset Progress', 'Set all skills back to locked? Your tree structure stays intact.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Reset', style: 'destructive', onPress: onResetProgress },
                      ]);
                    }}
                  />
                )}
                {onUnlockAll && (
                  <ActionButton
                    label="Unlock Entire Tree"
                    tone="green"
                    onPress={() => {
                      Alert.alert('Unlock Entire Tree', 'Unlock every skill in the current tree?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Unlock', onPress: onUnlockAll },
                      ]);
                    }}
                  />
                )}
              </View>
            </View>
          </>
        )}

        {onSignOut && (
          <TouchableOpacity style={styles.signOutBtn} activeOpacity={0.8} onPress={onSignOut}>
            <View style={styles.signOutGlow} />
            <View style={styles.signOutIconWrap}>
              <Ionicons name="log-out-outline" size={18} color="#FCA5A5" />
            </View>
            <View style={styles.signOutTextWrap}>
              <Text style={styles.signOutBtnT}>Sign Out</Text>
              <Text style={styles.signOutBtnSub}>End this session and return to the auth screen</Text>
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05070E' },
  backdrop: { opacity: 0.68 },
  pageTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3,5,10,0.72)',
  },
  page: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 14,
  },
  eyebrow: {
    color: 'rgba(255,232,166,0.7)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.1,
  },
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'rgba(8,12,22,0.72)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,216,74,0.12)',
    padding: 20,
    gap: 12,
  },
  heroGlow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 999,
    top: -140,
    right: -82,
    backgroundColor: 'rgba(255,216,74,0.08)',
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  pageBody: {
    color: 'rgba(215,236,255,0.62)',
    fontSize: 14,
    lineHeight: 20,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
  },
  heroMetaPill: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  heroMetaLabel: {
    color: 'rgba(191,226,255,0.4)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  heroMetaValue: {
    color: '#F8FBFF',
    fontSize: 13,
    fontWeight: '700',
  },
  roleBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  roleBadgeAdmin: {
    backgroundColor: 'rgba(196,181,253,0.12)',
    borderColor: 'rgba(196,181,253,0.22)',
  },
  roleBadgeUser: {
    backgroundColor: 'rgba(134,239,172,0.1)',
    borderColor: 'rgba(134,239,172,0.2)',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  roleBadgeTextAdmin: {
    color: '#DDD6FE',
  },
  roleBadgeTextUser: {
    color: '#BBF7D0',
  },
  sectionHeader: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  section: {
    backgroundColor: 'rgba(8,12,22,0.68)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 15,
    fontWeight: '600',
  },
  valueDim: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 14,
    fontWeight: '600',
    maxWidth: '45%',
    textAlign: 'right',
  },
  dangerBody: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 13,
    lineHeight: 19,
    paddingTop: 14,
    paddingBottom: 10,
  },
  actionStack: {
    gap: 10,
    paddingBottom: 12,
  },
  actionBtn: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 999,
    top: -52,
    right: -24,
  },
  actionBtnT: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  signOutBtn: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(72,18,22,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.16)',
  },
  signOutGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 999,
    top: -110,
    right: -70,
    backgroundColor: 'rgba(248,113,113,0.08)',
  },
  signOutIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.14)',
  },
  signOutTextWrap: {
    flex: 1,
  },
  signOutBtnT: {
    color: '#FDE2E2',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  signOutBtnSub: {
    color: 'rgba(252,165,165,0.66)',
    fontSize: 12,
    lineHeight: 17,
  },
});
