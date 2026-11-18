import mongoose from 'mongoose';
import { applyJson } from './toJson.js';

// A movie announced for later: shown in the "shortlist" scroller on the home page.
// Not part of the poll, so it has no votes. Each one carries its own poster.
const upcomingMovieSchema = new mongoose.Schema(
  {
    title_name: { type: String, required: true, trim: true },
    release_year: { type: Number, required: true },
    runtime: { type: Number, min: 1 }, // minutes (optional)
    details: { type: String, trim: true },
    // Poster as base64. `data` is left out of normal queries (select: false) so lists stay light.
    poster: {
      content_type: { type: String },
      data: { type: String, select: false },
      updated_at: { type: Date },
    },
    is_deleted: { type: Boolean, default: false },
  },
  { collection: 'upcoming_movies', timestamps: true }
);
upcomingMovieSchema.index({ is_deleted: 1, createdAt: 1 });
applyJson(upcomingMovieSchema);

export const UpcomingMovie = mongoose.model('UpcomingMovie', upcomingMovieSchema);
