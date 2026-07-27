import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

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

/** Compress a mission image: 1024 px max, 50% quality → ~60–150 KB */
export const compressMissionImage = (uri: string) =>
  compressImage(uri, 1024, 0.5);

/** Compress a profile avatar: 512 px max, 60% quality → ~20–60 KB */
export const compressAvatarPhoto = (uri: string) =>
  compressImage(uri, 512, 0.6);

/**
 * Read a local file URI and return its bytes as an ArrayBuffer.
 *
 * WHY NOT fetch() or Blob:
 *  - `fetch('file://...')` returns an empty body on Android for many URI types
 *  - `fetch('data:...;base64,...')` also silently empties on large strings
 *  - Both approaches caused Supabase to reject the upload (400 / 204)
 *
 * Supabase's documented React Native upload flow is:
 * expo-file-system base64 -> base64-arraybuffer decode -> ArrayBuffer upload.
 * The legacy FileSystem entrypoint is intentional: in Expo SDK 54,
 * readAsStringAsync from the root entrypoint is deprecated and throws at runtime.
 */
export async function readFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (!base64) {
    throw new Error('The compressed image file was empty.');
  }

  const buffer = decode(base64);
  if (buffer.byteLength === 0) {
    throw new Error('The compressed image contained no uploadable data.');
  }

  return buffer;
}
