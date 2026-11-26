import { env } from '../config/env.js';
import { IMAGE_SLOTS } from '../config/imageSlots.js';
import { TEXT_SLOTS } from '../config/textSlots.js';
import { SiteImage } from '../models/SiteImage.js';
import { SiteText } from '../models/SiteText.js';
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
  const [docs, textDocs] = await Promise.all([SiteImage.find().select('-data'), SiteText.find()]);
  const images = Object.fromEntries(Object.keys(IMAGE_SLOTS).map((key) => [key, null]));
  for (const doc of docs) {
    if (IMAGE_SLOTS[doc.key]) images[doc.key] = { url: urlFor(doc), size: doc.size, updated_at: doc.updatedAt };
  }
  // Editable texts (e.g. the hero caption); null = not set, the page uses its built-in text
  const texts = Object.fromEntries(Object.keys(TEXT_SLOTS).map((key) => [key, null]));
  for (const doc of textDocs) {
    if (TEXT_SLOTS[doc.key]) texts[doc.key] = doc.value;
  }
  res.json({ success: true, data: { max_upload_bytes: env.maxImageBytes, images, texts } });
}

// The image itself
export async function getImage(req, res) {
  checkSlot(req.params.key);
  const doc = await SiteImage.findOne({ key: req.params.key });
  if (!doc) throw new AppError('No image set.', 404);
  // With ?v=<timestamp> the URL changes whenever the image does, so it can be cached for a year
  // (browser + Cloudflare). Without ?v it is only cached for a day.
  const versioned = typeof req.query.v === 'string' && req.query.v !== '';
  res.set({
    'Content-Type': doc.content_type,
    'Cache-Control': versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=86400',
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

/* ---------- Admin: editable texts ---------- */

function checkTextSlot(key) {
  if (!TEXT_SLOTS[key]) throw new AppError('Unknown text slot.', 404);
}

export async function saveText(req, res) {
  checkTextSlot(req.params.key);
  const slot = TEXT_SLOTS[req.params.key];
  const value = typeof req.body?.value === 'string' ? req.body.value.trim() : '';
  if (!value) throw new AppError(`${slot.label} cannot be empty. Use "Reset to default" instead.`, 400);
  if (value.length > slot.max) throw new AppError(`${slot.label} can be at most ${slot.max} characters.`, 400);

  const doc = await SiteText.findOneAndUpdate(
    { key: req.params.key },
    { key: req.params.key, value, updated_by: req.user._id },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.json({ success: true, message: `${slot.label} updated.`, data: { key: doc.key, value: doc.value } });
}

export async function removeText(req, res) {
  checkTextSlot(req.params.key);
  await SiteText.deleteOne({ key: req.params.key });
  res.json({ success: true, message: `${TEXT_SLOTS[req.params.key].label} reset to default.` });
}
