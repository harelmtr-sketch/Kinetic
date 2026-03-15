import * as DocumentPicker from 'expo-document-picker';

let NativeImagePicker = null;

try {
  NativeImagePicker = require('expo-image-picker');
} catch (error) {
  NativeImagePicker = null;
}

export const HAS_NATIVE_IMAGE_PICKER = !!NativeImagePicker;

export async function requestCameraPermissionsAsync() {
  if (!NativeImagePicker?.requestCameraPermissionsAsync) {
    return { granted: false, canAskAgain: false, status: 'unavailable' };
  }

  return NativeImagePicker.requestCameraPermissionsAsync();
}

export async function requestMediaLibraryPermissionsAsync() {
  if (!NativeImagePicker?.requestMediaLibraryPermissionsAsync) {
    return { granted: false, canAskAgain: false, status: 'unavailable' };
  }

  return NativeImagePicker.requestMediaLibraryPermissionsAsync();
}

export async function launchCameraVideoAsync() {
  if (!NativeImagePicker?.launchCameraAsync) {
    throw new Error('Camera capture is unavailable in this build.');
  }

  return NativeImagePicker.launchCameraAsync({
    mediaTypes: ['videos'],
    videoMaxDuration: 120,
    videoQuality: NativeImagePicker.UIImagePickerControllerQualityType?.High,
  });
}

export async function pickVideoAsync() {
  if (NativeImagePicker?.launchImageLibraryAsync) {
    return NativeImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
    });
  }

  const result = await DocumentPicker.getDocumentAsync({
    type: 'video/*',
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    return { canceled: true, assets: [] };
  }

  return {
    canceled: false,
    assets: result.assets || [],
  };
}
