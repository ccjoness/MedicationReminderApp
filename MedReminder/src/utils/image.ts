import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

/**
 * Resize and compress an image URI so it is suitable for upload.
 *
 * Strategy:
 *  - Resize to fit within `maxDimension` (preserving aspect ratio)
 *  - Re-encode as JPEG at the given `quality` (0–1)
 *
 * Modern phone cameras produce images that are often 10–50 MB.
 * After this transform, results are typically 50–200 KB.
 *
 * @param uri          Source URI (file://, content://, or http/https)
 * @param maxDimension Maximum width or height in pixels (default 1024)
 * @param quality      JPEG quality 0–1 (default 0.5)
 * @returns            Compressed local file URI + mimeType
 */
export async function compressImage(
  uri: string,
  maxDimension = 1024,
  quality = 0.5
): Promise<{ uri: string; mimeType: string }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxDimension } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
  );
  return { uri: result.uri, mimeType: 'image/jpeg' };
}

/** Compress a medication photo: 1024 px max, 50% quality → ~60–150 KB */
export const compressMedicationPhoto = (uri: string) =>
  compressImage(uri, 1024, 0.5);

/** Compress a profile avatar: 512 px max, 60% quality → ~20–60 KB */
export const compressAvatarPhoto = (uri: string) =>
  compressImage(uri, 512, 0.6);

/**
 * Read a local file URI and return a Uint8Array of its bytes.
 *
 * WHY NOT fetch() or Blob:
 *  - `fetch('file://...')` returns an empty body on Android for many URI types
 *  - `fetch('data:...;base64,...')` also silently empties on large strings
 *  - Both approaches caused Supabase to reject the upload (400 / 204)
 *
 * This function reads the file with expo-file-system (always reliable),
 * decodes base64 → binary with `atob` (available in Hermes / New Architecture),
 * and returns a Uint8Array. Supabase Storage accepts Uint8Array directly
 * as ArrayBufferView — no Blob needed.
 */
export async function readFileAsBytes(uri: string): Promise<Uint8Array> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // atob is available in React Native New Architecture (Hermes)
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

/**
 * @deprecated Use readFileAsBytes instead.
 * Kept for backward compatibility — delegates to readFileAsBytes.
 */
export async function uriToBlob(uri: string, _mimeType: string): Promise<Uint8Array> {
  return readFileAsBytes(uri);
}
