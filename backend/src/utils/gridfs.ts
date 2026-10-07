import mongoose from 'mongoose';
import { Readable } from 'node:stream';

const BUCKET_NAME = 'restaurant_photos';

let bucketCache: any = null;

export function getRestaurantPhotosBucket(): any {
  if (bucketCache) return bucketCache;
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB connection is not ready yet.');
  }
  bucketCache = new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET_NAME });
  return bucketCache;
}

export interface StoredPhoto {
  _id: mongoose.Types.ObjectId;
  filename: string;
  contentType: string;
  length: number;
}

export async function storePhoto(
  buffer: Buffer,
  opts: { filename: string; contentType: string; restaurantId?: string }
): Promise<StoredPhoto> {
  const bucket = getRestaurantPhotosBucket();
  return new Promise((resolve, reject) => {
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    const upload = bucket.openUploadStream(opts.filename, {
      metadata: opts.restaurantId ? { restaurantId: opts.restaurantId, contentType: opts.contentType } : { contentType: opts.contentType },
    });
    readable.pipe(upload);
    upload.on('error', (err: unknown) => reject(err));
    upload.on('finish', () => {
      resolve({
        _id: upload.id as mongoose.Types.ObjectId,
        filename: upload.filename,
        contentType: opts.contentType,
        length: upload.length,
      });
    });
  });
}

export async function findFileById(
  fileId: mongoose.Types.ObjectId | string | undefined | null
): Promise<{ _id: mongoose.Types.ObjectId; filename: string; length: number; contentType?: string; metadata?: any } | null> {
  if (!fileId) return null;
  const bucket = getRestaurantPhotosBucket();
  const id = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  const docs = await bucket.find({ _id: id }).limit(1).toArray();
  return docs[0] || null;
}

export function openDownloadStream(
  fileId: mongoose.Types.ObjectId | string
): any {
  const bucket = getRestaurantPhotosBucket();
  const id = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  return bucket.openDownloadStream(id);
}

export async function deleteFileIfExists(
  fileId: mongoose.Types.ObjectId | string | undefined | null
): Promise<void> {
  if (!fileId) return;
  const bucket = getRestaurantPhotosBucket();
  const id = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  try {
    await bucket.delete(id);
  } catch (cause: unknown) {
    const err = cause as { code?: number; message?: string };
    if (err?.code === 26 || (typeof err?.message === 'string' && /FileNotFound|not found/i.test(err.message))) {
      return;
    }
    throw cause;
  }
}
