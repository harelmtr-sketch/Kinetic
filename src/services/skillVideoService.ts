import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../lib/supabase';

const SKILL_VIDEO_STORAGE_KEY = '@kinetic/skill-videos/v1';
const SKILL_VIDEO_DIR = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}skill-videos`;

export type SkillVideoRecord = {
  nodeId: string;
  userId: string | null;
  localUri: string;
  remotePath: string | null;
  remoteUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  createdAt: number;
};

type SkillVideoMap = Record<string, SkillVideoRecord>;

type VideoAssetInput = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
};

const getExtensionFromName = (value?: string | null) => {
  if (!value) return '';
  const match = value.match(/\.[a-z0-9]+$/i);
  return match?.[0] || '';
};

const getExtensionFromMimeType = (mimeType?: string | null) => {
  switch (mimeType) {
    case 'video/mp4':
      return '.mp4';
    case 'video/quicktime':
      return '.mov';
    case 'video/webm':
      return '.webm';
    default:
      return '';
  }
};

const ensureVideoDir = async () => {
  const dirInfo = await FileSystem.getInfoAsync(SKILL_VIDEO_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(SKILL_VIDEO_DIR, { intermediates: true });
  }
};

const readStoredMap = async (): Promise<SkillVideoMap> => {
  try {
    const raw = await AsyncStorage.getItem(SKILL_VIDEO_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeStoredMap = async (nextMap: SkillVideoMap) => {
  await AsyncStorage.setItem(SKILL_VIDEO_STORAGE_KEY, JSON.stringify(nextMap));
};

const safeDeleteFile = async (uri?: string | null) => {
  if (!uri) return;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
    // Ignore local cleanup failures so they don't block the save flow.
  }
};

const uploadVideoToCloud = async (
  userId: string,
  nodeId: string,
  localUri: string,
  mimeType?: string | null,
) => {
  try {
    const response = await fetch(localUri);
    const blob = await response.blob();
    const extension = getExtensionFromMimeType(mimeType) || '.mp4';
    const remotePath = `${userId}/${nodeId}/${Date.now()}${extension}`;

    const uploadResult = await supabase.storage
      .from('skill-videos')
      .upload(remotePath, blob, {
        contentType: mimeType || 'video/mp4',
        upsert: true,
      });

    if (uploadResult.error) {
      throw uploadResult.error;
    }

    const videoRow = {
      user_id: userId,
      node_id: nodeId,
      storage_path: remotePath,
      mime_type: mimeType || 'video/mp4',
      created_at: new Date().toISOString(),
    };

    const tableResult = await supabase
      .from('user_skill_videos')
      .upsert(videoRow, { onConflict: 'user_id,node_id' })
      .select('storage_path')
      .maybeSingle();

    if (tableResult.error) {
      throw tableResult.error;
    }

    const publicUrl = supabase.storage.from('skill-videos').getPublicUrl(remotePath).data.publicUrl || null;

    return {
      remotePath,
      remoteUrl: publicUrl,
    };
  } catch {
    return {
      remotePath: null,
      remoteUrl: null,
    };
  }
};

export async function loadSkillVideoMap(): Promise<SkillVideoMap> {
  const skillVideoMap = await readStoredMap();
  const nextMap: SkillVideoMap = {};

  await Promise.all(Object.entries(skillVideoMap).map(async ([nodeId, record]) => {
    const fileInfo = await FileSystem.getInfoAsync(record.localUri);
    if (fileInfo.exists) {
      nextMap[nodeId] = record;
    }
  }));

  if (Object.keys(nextMap).length !== Object.keys(skillVideoMap).length) {
    await writeStoredMap(nextMap);
  }

  return nextMap;
}

export async function getSkillVideoRecord(nodeId: string) {
  const skillVideoMap = await loadSkillVideoMap();
  return skillVideoMap[nodeId] || null;
}

export async function saveSkillVideoRecord(
  nodeId: string,
  asset: VideoAssetInput,
  userId: string | null = null,
) {
  await ensureVideoDir();

  const currentMap = await loadSkillVideoMap();
  const currentRecord = currentMap[nodeId];
  const extension = getExtensionFromName(asset.fileName)
    || getExtensionFromMimeType(asset.mimeType)
    || getExtensionFromName(asset.uri)
    || '.mp4';
  const safeNodeId = nodeId.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  const destination = `${SKILL_VIDEO_DIR}/${safeNodeId}_${Date.now()}${extension}`;

  await FileSystem.copyAsync({ from: asset.uri, to: destination });
  await safeDeleteFile(currentRecord?.localUri);

  const cloudPayload = userId
    ? await uploadVideoToCloud(userId, nodeId, destination, asset.mimeType)
    : { remotePath: null, remoteUrl: null };

  const nextRecord: SkillVideoRecord = {
    nodeId,
    userId,
    localUri: destination,
    remotePath: cloudPayload.remotePath,
    remoteUrl: cloudPayload.remoteUrl,
    fileName: asset.fileName || null,
    mimeType: asset.mimeType || null,
    duration: asset.duration ?? null,
    width: asset.width ?? null,
    height: asset.height ?? null,
    createdAt: Date.now(),
  };

  const nextMap = {
    ...currentMap,
    [nodeId]: nextRecord,
  };

  await writeStoredMap(nextMap);
  return nextRecord;
}

export async function removeSkillVideoRecord(nodeId: string) {
  const currentMap = await loadSkillVideoMap();
  const currentRecord = currentMap[nodeId];
  if (!currentRecord) {
    return currentMap;
  }

  await safeDeleteFile(currentRecord.localUri);
  const nextMap = { ...currentMap };
  delete nextMap[nodeId];
  await writeStoredMap(nextMap);
  return nextMap;
}

export async function loadRemoteSkillVideoMap(userId: string) {
  try {
    const result = await supabase
      .from('user_skill_videos')
      .select('node_id, storage_path, mime_type, created_at')
      .eq('user_id', userId);

    if (result.error) {
      throw result.error;
    }

    const rows = result.data || [];
    const remoteEntries = await Promise.all(rows.map(async (row) => {
      if (!row.storage_path) {
        return [row.node_id, null] as const;
      }

      try {
        const signedUrlResult = await supabase.storage
          .from('skill-videos')
          .createSignedUrl(row.storage_path, 60 * 30);
        if (signedUrlResult.error) {
          throw signedUrlResult.error;
        }

        return [row.node_id, {
          nodeId: row.node_id,
          userId,
          localUri: signedUrlResult.data?.signedUrl || '',
          remotePath: row.storage_path,
          remoteUrl: signedUrlResult.data?.signedUrl || null,
          fileName: null,
          mimeType: row.mime_type || null,
          duration: null,
          width: null,
          height: null,
          createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        }] as const;
      } catch {
        return [row.node_id, null] as const;
      }
    }));

    return remoteEntries.reduce<SkillVideoMap>((acc, [nodeId, record]) => {
      if (record) {
        acc[nodeId] = record;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
}
