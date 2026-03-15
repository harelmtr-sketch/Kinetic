import React, { useCallback } from 'react';
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

let NativeVideoView = null;
let nativeUseVideoPlayer = null;

try {
  const ExpoVideo = require('expo-video');
  NativeVideoView = ExpoVideo.VideoView || null;
  nativeUseVideoPlayer = ExpoVideo.useVideoPlayer || null;
} catch (error) {
  NativeVideoView = null;
  nativeUseVideoPlayer = null;
}

const HAS_NATIVE_VIDEO = !!NativeVideoView && typeof nativeUseVideoPlayer === 'function';

function NativeVideoPlayer({
  uri,
  contentFit,
  nativeControls,
}) {
  const player = nativeUseVideoPlayer(uri ? { uri } : null, (instance) => {
    instance.loop = true;
    instance.muted = false;
  });

  return (
    <NativeVideoView
      player={player}
      style={StyleSheet.absoluteFill}
      nativeControls={nativeControls}
      contentFit={contentFit}
    />
  );
}

export default function SafeVideoPlayer({
  uri,
  style,
  accentColor = '#7DD3FC',
  emptyIcon = 'videocam-outline',
  emptyTitle = '',
  emptyBody = '',
  openLabel = 'Open Video',
  contentFit = 'cover',
  nativeControls = true,
  compact = false,
}) {
  const handleOpenVideo = useCallback(async () => {
    if (!uri) {
      return;
    }

    try {
      await Linking.openURL(uri);
    } catch (error) {
      Alert.alert('Unable to open video', error?.message || 'This clip could not be opened from the current build.');
    }
  }, [uri]);

  if (uri && HAS_NATIVE_VIDEO) {
    return (
      <View style={style}>
        <NativeVideoPlayer
          uri={uri}
          nativeControls={nativeControls}
          contentFit={contentFit}
        />
      </View>
    );
  }

  const isPressable = !!uri;
  const runtimeHint = uri && !HAS_NATIVE_VIDEO
    ? compact
      ? 'Open clip'
      : 'Inline playback is unavailable in this build. Tap below to open the clip.'
    : emptyBody;

  return (
    <TouchableOpacity
      activeOpacity={isPressable ? 0.84 : 1}
      disabled={!isPressable}
      onPress={() => { void handleOpenVideo(); }}
      style={[style, styles.fallbackStage]}
    >
      <View style={[styles.fallbackIconWrap, { borderColor: `${accentColor}22`, backgroundColor: `${accentColor}14` }]}>
        <Ionicons
          name={uri ? 'play-circle-outline' : emptyIcon}
          size={compact ? 20 : 28}
          color={accentColor}
        />
      </View>
      {!!emptyTitle && !compact && (
        <Text style={styles.fallbackTitle}>{emptyTitle}</Text>
      )}
      {!!runtimeHint && (
        <Text numberOfLines={compact ? 1 : 3} style={[styles.fallbackBody, compact && styles.fallbackBodyCompact]}>
          {runtimeHint}
        </Text>
      )}
      {isPressable && !compact && (
        <View style={[styles.openPill, { borderColor: `${accentColor}2a`, backgroundColor: `${accentColor}14` }]}>
          <Ionicons name="open-outline" size={14} color={accentColor} />
          <Text style={[styles.openPillText, { color: accentColor }]}>{openLabel}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export { HAS_NATIVE_VIDEO };

const styles = StyleSheet.create({
  fallbackStage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 10,
  },
  fallbackIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  fallbackTitle: {
    color: '#F8FBFF',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  fallbackBody: {
    color: 'rgba(225,236,248,0.64)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  fallbackBodyCompact: {
    fontSize: 11,
    lineHeight: 14,
  },
  openPill: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  openPillText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
