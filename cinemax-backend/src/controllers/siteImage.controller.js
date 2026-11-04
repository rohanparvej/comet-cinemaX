import { env } from '../config/env.js';
import { IMAGE_SLOTS } from '../config/imageSlots.js';
import { SiteImage } from '../models/SiteImage.js';
import { AppError } from '../utils/AppError.js';
import { sniffImageType } from '../utils/imageType.js';

const mb = (bytes) => Number((bytes / 1024 / 1024).toFixed(2));

// ?v= changes whenever the image changes, so browsers/CDNs never show a stale one
const urlFor = (doc) => `/api/site/images/${doc.key}?v=${doc.updatedAt.getTime()}`;

function checkSlot(key) {
  if (!IMAGE_SLOTS[key]) throw new AppError('Unknown image slot.', 404);
}

/* ---------- Public ---------- */

// Which images are set, plus the upload limit (the admin page shows it)
export async function listImages(_req, res) {
  const docs = await SiteImage.find().select('-data');
  const images = Object.fromEntries(Object.keys(IMAGE_SLOTS).map((key) => [key, null]));
  for (const doc of docs) {
    if (IMAGE_SLOTS[doc.key]) images[doc.key] = { url: urlFor(doc), size: doc.size, updated_at: doc.updatedAt };
  }
  res.json({ success: true, data: { max_upload_bytes: env.maxImageBytes, images } });
}

// The image itself
export async function getImage(req, res) {
  checkSlot(req.params.key);
  const doc = await SiteImage.findOne({ key: req.params.key });
  if (!doc) throw new AppError('No image set.', 404);
  res.set({
    'Content-Type': doc.content_type,
    'Cache-Control': 'public, max-age=86400',
    // helmet blocks cross-origin use by default; the frontend (another domain) must be able to show it
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  res.send(Buffer.from(doc.data));
}

/* ---------- Admin ---------- */

export async function saveImage(req, res) {
  checkSlot(req.params.key);
  if (!req.file) throw new AppError('Choose an image file to upload.', 400);

  const contentType = sniffImageType(req.file.buffer);
  if (!contentType) throw new AppError('Only JPG, PNG or WebP images are allowed.', 400);

  const doc = await SiteImage.findOneAndUpdate(
    { key: req.params.key },
    {
      key: req.params.key,
      content_type: contentType,
      data: req.file.buffer,
      size: req.file.size,
      updated_by: req.user._id,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.json({
    success: true,
    message: `${IMAGE_SLOTS[doc.key]} updated (${mb(doc.size)} MB).`,
    data: { key: doc.key, url: urlFor(doc), size: doc.size, updated_at: doc.updatedAt },
  });
}

export async function removeImage(req, res) {
  checkSlot(req.params.key);
  const result = await SiteImage.deleteOne({ key: req.params.key });
  if (!result.deletedCount) throw new AppError('No image set.', 404);
  res.json({ success: true, message: `${IMAGE_SLOTS[req.params.key]} removed.` });
}
