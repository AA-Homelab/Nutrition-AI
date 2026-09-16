import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Allowed MIME types and extensions
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const UPLOAD_BASE_DIR = path.join(process.cwd(), 'uploads', 'food-images');

// Ensure base upload directory exists
if (!fs.existsSync(UPLOAD_BASE_DIR)) {
  fs.mkdirSync(UPLOAD_BASE_DIR, { recursive: true });
}

export interface StoredImageMetadata {
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
}

export function validateImageUpload(file: Express.Multer.File): void {
  if (!file) {
    throw new Error('No image file provided');
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Please upload an image smaller than ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`);
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new Error('Unsupported image format. Please upload JPG, PNG, or WEBP.');
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error('Unsupported image file extension.');
  }
}

/**
 * Saves uploaded image to user's isolated directory with cryptographically secure random filename.
 */
export async function saveUserFoodImage(
  userId: number,
  file: Express.Multer.File
): Promise<StoredImageMetadata> {
  validateImageUpload(file);

  const userDir = path.join(UPLOAD_BASE_DIR, String(userId));
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  const randomHash = crypto.randomBytes(16).toString('hex');
  const safeExt = path.extname(file.originalname).toLowerCase() || '.jpg';
  const filename = `food_${Date.now()}_${randomHash}${safeExt}`;
  const targetFilePath = path.join(userDir, filename);

  await fs.promises.writeFile(targetFilePath, file.buffer);

  // Return relative storage path
  const storagePath = path.join(String(userId), filename);

  return {
    storage_path: storagePath,
    original_filename: path.basename(file.originalname).slice(0, 100),
    mime_type: file.mimetype,
    file_size: file.size,
  };
}

/**
 * Resolves the absolute path for a user's food image, verifying ownership.
 */
export function resolveUserImagePath(userId: number, storagePath: string): string {
  // Prevent directory traversal
  const normalized = path.normalize(storagePath).replace(/^(\.\.[\/\\])+/, '');
  const segments = normalized.split(path.sep);

  // First segment must match userId
  if (segments[0] !== String(userId)) {
    throw new Error('Unauthorized access to food image.');
  }

  const fullPath = path.join(UPLOAD_BASE_DIR, normalized);
  if (!fs.existsSync(fullPath)) {
    throw new Error('Image not found.');
  }

  return fullPath;
}

/**
 * Deletes user's image from disk
 */
export async function deleteUserImage(userId: number, storagePath: string): Promise<void> {
  try {
    const fullPath = resolveUserImagePath(userId, storagePath);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  } catch (err) {
    console.error('Failed to delete image file:', err);
  }
}
