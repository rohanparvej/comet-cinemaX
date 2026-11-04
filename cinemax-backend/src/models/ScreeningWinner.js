import mongoose from 'mongoose';
import { applyJson } from './toJson.js';

const screeningWinnerSchema = new mongoose.Schema(
  {
    title_name: { type: String, required: true, trim: true },
    release_year: { type: Number, required: true },
    recommended_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    is_current: { type: Boolean, required: true, default: false },
    runtime: { type: Number, required: true, min: 1 }, // minutes
    details: { type: String, required: true, trim: true },
    // Extra: which poll entry this winner came from, and how many votes it had
    screening_choice_id_fk: { type: mongoose.Schema.Types.ObjectId, ref: 'ScreeningChoice' },
    votes_at_declaration: { type: Number, default: 0 },
  },
  { collection: 'screening_winners', timestamps: true }
);
// The database itself guarantees at most one current winner
screeningWinnerSchema.index(
  { is_current: 1 },
  { unique: true, partialFilterExpression: { is_current: true } }
);
applyJson(screeningWinnerSchema);

export const ScreeningWinner = mongoose.model('ScreeningWinner', screeningWinnerSchema);
