import * as ImageManipulator from 'expo-image-manipulator';

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
 * @param uri       Source URI (file://, content://, or http/https)
 * @param maxDimension   Maximum width or height in pixels (default 1024)
 * @param quality   JPEG quality 0–1 (default 0.5)
 * @returns         Compressed local file URI + detected mimeType
 */
export async function compressImage(
  uri: string,
  maxDimension = 1024,
  quality = 0.5
): Promise<{ uri: string; mimeType: string }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [
      {
        resize: {
          // Specify only one dimension — expo-image-manipulator preserves aspect ratio
          width: maxDimension,
        },
      },
    ],
    {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  return { uri: result.uri, mimeType: 'image/jpeg' };
}

/**
 * Compress a medication photo.
 * Max 1024 px, quality 0.5 → typically 60–150 KB.
 */
export const compressMedicationPhoto = (uri: string) =>
  compressImage(uri, 1024, 0.5);

/**
 * Compress a profile avatar.
 * Max 512 px, quality 0.6 → typically 20–60 KB.
 */
export const compressAvatarPhoto = (uri: string) =>
  compressImage(uri, 512, 0.6);
