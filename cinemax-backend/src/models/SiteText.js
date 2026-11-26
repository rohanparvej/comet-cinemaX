import mongoose from 'mongoose';

// One document per editable site text (see config/textSlots.js), e.g. the hero caption.
const siteTextSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, required: true },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { collection: 'site_texts', timestamps: true }
);

export const SiteText = mongoose.model('SiteText', siteTextSchema);
