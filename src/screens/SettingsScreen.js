import React from 'react';
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

function SettingsRow({
  icon,
  accent,
  label,
  value,
  children,
  onPress,
  isLast = false,
}) {
  const interactive = !!onPress;

  return (
    <TouchableOpacity activeOpacity={interactive ? 0.75 : 1} onPress={onPress} disabled={!interactive}>
      <View style={[styles.row, !isLast && styles.rowBorder]}>
        <View style={styles.rowLeft}>
          <View style={[styles.rowIconWrap, { borderColor: `${accent}28`, backgroundColor: `${accent}12` }]}>
            <View style={[styles.rowIconAccent, { backgroundColor: `${accent}18` }]} />
            <Ionicons name={icon} size={18} color={accent} />
          </View>
          <Text style={styles.label}>{label}</Text>
        </View>

        {children || (
          <View style={styles.rowRight}>
            <Text style={styles.valueDim}>{value}</Text>
            {interactive && <Ionicons name="chevron-forward" size={16} color="rgba(191,226,255,0.36)" />}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function ActionButton({
  label,
  subtitle,
  tone = 'blue',
  onPress,
}) {
  const toneMap = {
    red: {
      bg: 'rgba(84,20,26,0.68)',
      border: 'rgba(248,113,113,0.24)',
      text: '#FFE1E1',
      sub: 'rgba(252,165,165,0.72)',
      icon: '#FCA5A5',
      iconName: 'refresh-outline',
    },
    green: {
      bg: 'rgba(10,34,26,0.76)',
      border: 'rgba(74,222,128,0.22)',
      text: '#D8FFE7',
      sub: 'rgba(134,239,172,0.72)',
      icon: '#86EFAC',
      iconName: 'flash-outline',
    },
    blue: {
      bg: 'rgba(8,28,46,0.76)',
      border: 'rgba(125,211,252,0.24)',
      text: '#E2F4FF',
      sub: 'rgba(125,211,252,0.72)',
      icon: '#7DD3FC',
      iconName: 'sparkles-outline',
    },
  };

  const resolved = toneMap[tone] || toneMap.blue;

  return (
    <TouchableOpacity
      style={[styles.actionBtn, { backgroundColor: resolved.bg, borderColor: resolved.border }]}
      activeOpacity={0.82}
      onPress={onPress}
    >
      <View style={[styles.actionIconWrap, { backgroundColor: `${resolved.icon}14`, borderColor: `${resolved.icon}24` }]}>
        <Ionicons name={resolved.iconName} size={18} color={resolved.icon} />
      </View>
      <View style={styles.actionTextWrap}>
        <Text style={[styles.actionBtnT, { color: resolved.text }]}>{label}</Text>
        <Text style={[styles.actionBtnSub, { color: resolved.sub }]}>{subtitle}</Text>
      </View>
      <Ionicons name="arrow-forward" size={18} color={resolved.icon} />
    </TouchableOpacity>
  );
}

export default function SettingsScreen({
  onResetProgress,
  onUnlockAll,
  onEditTree,
  onSignOut,
  userEmail,
  username,
  userRole,
  treePrefs,
  onTreePrefsChange,
}) {
  const insets = useSafeAreaInsets();
  const normalizedRole = String(userRole || 'user').toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN';
  const showParticles = treePrefs?.showParticles ?? true;
  const highQuality = treePrefs?.highQuality ?? true;
  const displayName = username ? `@${username}` : (userEmail || 'Unknown account');

  return (
    <View style={styles.root}>
      <AuthBackdrop style={styles.backdrop} />
      <View style={styles.pageTint} />

      <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 72 }]}>
        <View style={styles.heroCard}>
          <View style={styles.heroCorner} />
          <Text style={styles.eyebrow}>SETTINGS</Text>
          <Text style={styles.pageTitle}>Control Room</Text>
          <Text style={styles.pageBody}>
            Session controls, sync state, admin tree tools, and local preferences all live here in a cleaner command-deck layout.
          </Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaPill}>
              <Text style={styles.heroMetaLabel}>SIGNED IN</Text>
              <Text style={styles.heroMetaValue}>{displayName}</Text>
            </View>
            <View style={[styles.roleBadge, isAdmin ? styles.roleBadgeAdmin : styles.roleBadgeUser]}>
              <Ionicons
                name={isAdmin ? 'shield-checkmark-outline' : 'sparkles-outline'}
                size={14}
                color={isAdmin ? '#DDD6FE' : '#BBF7D0'}
              />
              <Text style={[styles.roleBadgeText, isAdmin ? styles.roleBadgeTextAdmin : styles.roleBadgeTextUser]}>
                {normalizedRole}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionHeader}>Account</Text>
        <View style={styles.section}>
          <SettingsRow
            icon={username ? 'at-outline' : 'mail-outline'}
            accent="#7DD3FC"
            label="Signed In"
            value={displayName}
          />
          <SettingsRow icon="shield-checkmark-outline" accent={isAdmin ? '#C4B5FD' : '#86EFAC'} label="Role" value={normalizedRole} />
          <SettingsRow icon="cloud-done-outline" accent="#60A5FA" label="Data Sync" value="Supabase" isLast />
        </View>

        <Text style={styles.sectionHeader}>Tree Display</Text>
        <View style={styles.section}>
          <SettingsRow icon="sparkles-outline" accent="#FDE68A" label="Node Particles">
            <Switch
              value={showParticles}
              onValueChange={(v) => onTreePrefsChange?.({ ...treePrefs, showParticles: v })}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(253,230,138,0.36)' }}
              thumbColor={showParticles ? '#FEF3C7' : 'rgba(255,255,255,0.62)'}
            />
          </SettingsRow>
          <SettingsRow icon="diamond-outline" accent="#C4B5FD" label="High Quality Effects">
            <Switch
              value={highQuality}
              onValueChange={(v) => onTreePrefsChange?.({ ...treePrefs, highQuality: v })}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(196,181,253,0.36)' }}
              thumbColor={highQuality ? '#EDE9FE' : 'rgba(255,255,255,0.62)'}
            />
          </SettingsRow>
          <SettingsRow icon="cloud-done-outline" accent="#60A5FA" label="Cloud Save" value="Automatic" isLast />
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
                Use these only when you intentionally want to wipe or fully reveal the current tree state.
              </Text>
              <View style={styles.actionStack}>
                {onResetProgress && (
                  <ActionButton
                    label="Reset Progress"
                    subtitle="Lock every node but keep the current layout"
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
                    subtitle="Reveal every skill in the current tree"
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
          <TouchableOpacity style={styles.signOutBtn} activeOpacity={0.82} onPress={onSignOut}>
            <View style={styles.signOutIconWrap}>
              <Ionicons name="log-out-outline" size={18} color="#FCA5A5" />
            </View>
            <View style={styles.signOutTextWrap}>
              <Text style={styles.signOutBtnT}>Sign Out</Text>
              <Text style={styles.signOutBtnSub}>End this session and return to the auth screen</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color="#FCA5A5" />
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#04070D' },
  backdrop: { opacity: 0.62 },
  pageTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3,6,12,0.76)',
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
    color: 'rgba(164,212,255,0.76)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.2,
  },
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'rgba(8,12,22,0.8)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.16)',
    padding: 22,
    gap: 12,
  },
  heroCorner: {
    position: 'absolute',
    width: 118,
    height: 84,
    bottom: -32,
    left: -26,
    borderRadius: 28,
    backgroundColor: 'rgba(253,230,138,0.06)',
    transform: [{ rotate: '-16deg' }],
  },
  pageTitle: {
    color: '#F8FBFF',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  pageBody: {
    color: 'rgba(215,236,255,0.68)',
    fontSize: 14,
    lineHeight: 21,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    color: 'rgba(191,226,255,0.44)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  heroMetaValue: {
    color: '#F8FBFF',
    fontSize: 13,
    fontWeight: '700',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  roleBadgeAdmin: {
    backgroundColor: 'rgba(196,181,253,0.12)',
    borderColor: 'rgba(196,181,253,0.22)',
  },
  roleBadgeUser: {
    backgroundColor: 'rgba(134,239,172,0.12)',
    borderColor: 'rgba(134,239,172,0.2)',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  roleBadgeTextAdmin: { color: '#DDD6FE' },
  roleBadgeTextUser: { color: '#BBF7D0' },
  sectionHeader: {
    color: 'rgba(255,255,255,0.44)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  section: {
    backgroundColor: 'rgba(8,12,22,0.72)',
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
    position: 'relative',
    width: 36,
    height: 36,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowIconAccent: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 8,
    top: -4,
    right: -4,
  },
  label: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 15,
    fontWeight: '600',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '48%',
  },
  valueDim: {
    color: 'rgba(225,236,248,0.46)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  dangerBody: {
    color: 'rgba(255,255,255,0.46)',
    fontSize: 13,
    lineHeight: 19,
    paddingTop: 14,
    paddingBottom: 12,
  },
  actionStack: {
    gap: 10,
    paddingBottom: 12,
  },
  actionBtn: {
    minHeight: 60,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextWrap: {
    flex: 1,
  },
  actionBtnT: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  actionBtnSub: {
    fontSize: 12,
    lineHeight: 17,
  },
  signOutBtn: {
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
