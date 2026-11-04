import mongoose from 'mongoose';
import { applyJson } from './toJson.js';

const screeningChoiceSchema = new mongoose.Schema(
  {
    title_name: { type: String, required: true, trim: true },
    release_year: { type: Number, required: true },
    // The user who recommended this movie (admin picks them from a dropdown for now)
    recommended_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    number_of_votes: { type: Number, required: true, default: 0, min: 0 },
    // The users who chose (voted for) this movie
    chosen_by: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    runtime: { type: Number, required: true, min: 1 }, // minutes
    details: { type: String, trim: true },
    is_deleted: { type: Boolean, default: false },
  },
  { collection: 'screening_choices', timestamps: true }
);
screeningChoiceSchema.index({ is_deleted: 1, number_of_votes: -1 });
screeningChoiceSchema.index({ chosen_by: 1 }); // fast "has this user voted?" lookup
applyJson(screeningChoiceSchema);

export const ScreeningChoice = mongoose.model('ScreeningChoice', screeningChoiceSchema);
