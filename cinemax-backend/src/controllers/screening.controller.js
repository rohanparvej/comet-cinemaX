import { ScreeningChoice } from '../models/ScreeningChoice.js';
import { ScreeningWinner } from '../models/ScreeningWinner.js';
import { AppError } from '../utils/AppError.js';

const recommender = { path: 'recommended_by', select: 'username' };

// Landing page: current poll entries - soft-deleted ones are hidden.
// recommended_by.id lets the page grey out a movie for the user who recommended it.
export async function listChoices(_req, res) {
  const choices = await ScreeningChoice.find({ is_deleted: false })
    .select('title_name release_year runtime number_of_votes recommended_by')
    .populate(recommender)
    .sort({ title_name: 1 });
  res.json({ success: true, data: choices });
}

// Landing page: the winner whose is_current flag is on (null if none yet)
export async function currentWinner(_req, res) {
  const winner = await ScreeningWinner.findOne({ is_current: true })
    .select('title_name release_year recommended_by runtime details')
    .populate(recommender);
  res.json({ success: true, data: winner });
}

// Logged-in user: which movie I voted for (null if not voted yet)
export async function myVote(req, res) {
  const choice = await ScreeningChoice.findOne({ chosen_by: req.user._id, is_deleted: false }).select('_id');
  res.json({ success: true, data: choice ? { screening_choice_id: choice.id } : null });
}

// Logged-in user: vote for a movie. Once only, never for your own recommendation, and only while no winner is current.
export async function vote(req, res) {
  const userId = req.user._id;

  // Once a screening winner is current, the poll is closed for everyone
  if (await ScreeningWinner.exists({ is_current: true })) {
    throw new AppError('Voting is closed. A screening winner has been announced.', 409);
  }

  if (await ScreeningChoice.exists({ chosen_by: userId })) {
    throw new AppError('You have already voted. A vote cannot be changed.', 409);
  }

  const choice = await ScreeningChoice.findOne({ _id: req.params.id, is_deleted: false });
  if (!choice) throw new AppError('That movie is not available for voting.', 404);
  if (choice.recommended_by.equals(userId)) {
    throw new AppError('You cannot vote for a movie you recommended.', 403);
  }

  // Atomic per movie: only adds the vote if this user isn't already in chosen_by
  const updated = await ScreeningChoice.findOneAndUpdate(
    { _id: choice._id, is_deleted: false, chosen_by: { $ne: userId } },
    { $addToSet: { chosen_by: userId }, $inc: { number_of_votes: 1 } },
    { new: true }
  );
  if (!updated) throw new AppError('That movie is not available for voting.', 404);

  res.json({
    success: true,
    message: 'Vote recorded.',
    data: { id: updated.id, title_name: updated.title_name, number_of_votes: updated.number_of_votes },
  });
}
