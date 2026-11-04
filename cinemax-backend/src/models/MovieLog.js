import mongoose from 'mongoose';
import { applyJson } from './toJson.js';

// A user's rating / review of a movie. `comment` is an extra field because
// the frontend review cards show a short written review.
const movieLogSchema = new mongoose.Schema(
  {
    title_name: { type: String, required: true, trim: true },
    release_year: { type: Number, required: true },
    added_date_time: { type: Date, required: true, default: Date.now },
    user_id_fk: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 0.5, max: 5 },
    comment: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { collection: 'movie_logs' }
);
// One log per user per movie (re-rating updates it)
movieLogSchema.index({ user_id_fk: 1, title_name: 1, release_year: 1 }, { unique: true });
movieLogSchema.index({ added_date_time: -1 });
applyJson(movieLogSchema);

export const MovieLog = mongoose.model('MovieLog', movieLogSchema);
