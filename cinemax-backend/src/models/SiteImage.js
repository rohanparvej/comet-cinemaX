import mongoose from 'mongoose';

// One document per image slot (see config/imageSlots.js). The image bytes live in MongoDB.
// Max size is enforced at upload (MAX_IMAGE_UPLOAD_MB), far below Mongo's 16 MB document limit.
const siteImageSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    content_type: { type: String, required: true },
    data: { type: Buffer, required: true },
    size: { type: Number, required: true },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { collection: 'site_images', timestamps: true }
);

export const SiteImage = mongoose.model('SiteImage', siteImageSchema);
