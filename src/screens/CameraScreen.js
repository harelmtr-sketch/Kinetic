import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SafeVideoPlayer from '../components/common/SafeVideoPlayer';
import { Colors } from '../theme/colors';
import {
  HAS_NATIVE_IMAGE_PICKER,
  launchCameraVideoAsync,
  pickVideoAsync,
  requestCameraPermissionsAsync,
  requestMediaLibraryPermissionsAsync,
} from '../services/safeMediaPicker';
import { saveSkillVideoRecord } from '../services/skillVideoService';

function VideoPreview({ uri }) {
  return (
    <SafeVideoPlayer
      uri={uri}
      style={uri ? styles.videoWrap : styles.videoPlaceholder}
      accentColor="#9BD8FF"
      emptyIcon="videocam-outline"
      emptyTitle="Add your attempt"
      emptyBody="Choose or record one clean clip for this skill."
      openLabel="Open Preview"
    />
  );
}

export default function CameraScreen({
  node,
  existingVideo,
  userId,
  onSaved,
  onCancel,
}) {
  const insets = useSafeAreaInsets();
  const [asset, setAsset] = useState(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const previewUri = asset?.uri || existingVideo?.localUri || existingVideo?.remoteUrl || null;

  useEffect(() => {
    setAsset(null);
  }, [node?.id]);

  const openCamera = async () => {
    if (!node || isLaunching) {
      return;
    }

    setIsLaunching(true);

    try {
      const permission = await requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera unavailable',
          permission.status === 'unavailable'
            ? 'Camera capture is not available in this build. Choose a saved video instead.'
            : 'Allow camera permission so you can record an attempt for this skill.',
        );
        return;
      }

      const result = await launchCameraVideoAsync();
      if (!result.canceled && result.assets?.length) {
        setAsset(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Camera unavailable', error?.message || 'Unable to open the camera right now.');
    } finally {
      setIsLaunching(false);
    }
  };

  const pickFromLibrary = async () => {
    if (!node || isLaunching) {
      return;
    }

    setIsLaunching(true);

    try {
      const permission = HAS_NATIVE_IMAGE_PICKER
        ? await requestMediaLibraryPermissionsAsync()
        : { granted: true };

      if (HAS_NATIVE_IMAGE_PICKER && !permission.granted) {
        Alert.alert('Library access needed', 'Allow media library access to choose a saved attempt video.');
        return;
      }

      const result = await pickVideoAsync();
      if (!result.canceled && result.assets?.length) {
        setAsset(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Video unavailable', error?.message || 'Unable to pick a video right now.');
    } finally {
      setIsLaunching(false);
    }
  };

  const handlePrimaryAction = HAS_NATIVE_IMAGE_PICKER ? openCamera : pickFromLibrary;

  const handleSave = async () => {
    if (!node || !asset || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const savedRecord = await saveSkillVideoRecord(node.id, asset, userId);
      await onSaved?.(savedRecord);
    } catch (error) {
      Alert.alert('Save failed', error?.message || 'Unable to save the attempt video.');
    } finally {
      setIsSaving(false);
    }
  };

  const skillLabel = useMemo(() => node?.name || 'Skill', [node?.name]);
  const statusText = asset
    ? 'New clip ready to save'
    : existingVideo
      ? 'Existing clip attached'
      : 'No clip selected yet';
  const primaryActionLabel = HAS_NATIVE_IMAGE_PICKER
    ? (asset || existingVideo ? 'Record Again' : 'Record Video')
    : (asset || existingVideo ? 'Choose Different Video' : 'Choose Video');
  const primaryActionIcon = HAS_NATIVE_IMAGE_PICKER ? 'videocam-outline' : 'cloud-upload-outline';

  if (!node) {
    return (
      <View style={styles.root}>
        <View style={styles.emptyState}>
          <Ionicons name="camera-outline" size={28} color="rgba(191,226,255,0.68)" />
          <Text style={styles.emptyTitle}>No skill selected</Text>
          <Text style={styles.emptyBody}>Open a node from the tree first, then tap attempt.</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onCancel}>
            <Text style={styles.secondaryBtnText}>Back To Tree</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>{HAS_NATIVE_IMAGE_PICKER ? 'RECORD ATTEMPT' : 'UPLOAD ATTEMPT'}</Text>
          <Text style={styles.title}>{skillLabel}</Text>
          <Text style={styles.subtitle}>
            {HAS_NATIVE_IMAGE_PICKER
              ? 'Record a clip or choose one you already have.'
              : 'Camera capture is not available in this build, so choose a video from your device.'}
          </Text>
        </View>

        <VideoPreview uri={previewUri} />

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={styles.statusValue}>{statusText}</Text>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={handlePrimaryAction} activeOpacity={0.82}>
          <Ionicons name={primaryActionIcon} size={18} color="#DFF5FF" />
          <Text style={styles.primaryBtnText}>{primaryActionLabel}</Text>
        </TouchableOpacity>

        {HAS_NATIVE_IMAGE_PICKER && (
          <TouchableOpacity style={styles.secondaryActionBtn} onPress={pickFromLibrary} activeOpacity={0.82}>
            <Ionicons name="cloud-upload-outline" size={18} color="rgba(255,255,255,0.78)" />
            <Text style={styles.secondaryActionBtnText}>Choose From Library</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, (!asset || isSaving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!asset || isSaving}
          activeOpacity={0.84}
        >
          {isSaving ? <ActivityIndicator color="#E8F7FF" /> : <Ionicons name="checkmark-circle-outline" size={18} color="#E8F7FF" />}
          <Text style={styles.saveBtnText}>{isSaving ? 'Saving Attempt...' : 'Save Attempt'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.76}>
          <Text style={styles.cancelBtnText}>Back</Text>
        </TouchableOpacity>
      </ScrollView>

      {isLaunching && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#BFE2FF" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  content: {
    paddingHorizontal: 18,
    gap: 16,
  },
  header: {
    gap: 8,
  },
  kicker: {
    color: '#FFE39A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    color: '#F8FBFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: 'rgba(225,236,248,0.66)',
    fontSize: 14,
    lineHeight: 21,
  },
  videoWrap: {
    height: 260,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(4,9,16,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.14)',
  },
  videoPlaceholder: {
    height: 260,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.14)',
    backgroundColor: 'rgba(6,13,22,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 8,
  },
  statusCard: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  statusLabel: {
    color: 'rgba(191,226,255,0.46)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  statusValue: {
    color: '#EAF6FF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  primaryBtn: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(13,58,86,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtnText: {
    color: '#DFF5FF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryActionBtn: {
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryActionBtnText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    minHeight: 56,
    borderRadius: 20,
    backgroundColor: 'rgba(14,60,88,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  saveBtnDisabled: {
    opacity: 0.44,
  },
  saveBtnText: {
    color: '#E8F7FF',
    fontSize: 15,
    fontWeight: '800',
  },
  cancelBtn: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cancelBtnText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  emptyTitle: {
    color: '#F8FBFF',
    fontSize: 22,
    fontWeight: '800',
  },
  emptyBody: {
    color: 'rgba(225,236,248,0.62)',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  secondaryBtn: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  secondaryBtnText: {
    color: '#EAF6FF',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
