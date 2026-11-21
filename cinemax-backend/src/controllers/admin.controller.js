import bcrypt from 'bcryptjs';
import { ScreeningChoice } from '../models/ScreeningChoice.js';
import { ScreeningWinner } from '../models/ScreeningWinner.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { buildPoster, withPosterUrl } from '../utils/poster.js';
import { getVotingStatus, setVotingSwitch } from '../utils/votingStatus.js';

const CHOICE_POSTER_BASE = '/api/screenings/choices';

/* ---------- User accounts ---------- */

// Admin creates a normal (non-admin) account that someone can log in with.
// The password is hashed with bcrypt; only the hash is stored and it is never returned.
export async function createUser(req, res) {
  const { username, email, password } = req.body;
  const user = await User.create({
    username,
    email: email || undefined,
    hashed_password: await bcrypt.hash(password, 12),
    is_admin: false,
  });
  res.status(201).json({ success: true, message: 'User created.', data: user });
}

/* ---------- Screening choices ---------- */

export async function listChoices(req, res) {
  const filter = req.query.include_deleted === 'true' ? {} : { is_deleted: false };
  const choices = await ScreeningChoice.find(filter)
    .select('-chosen_by')
    .populate('recommended_by', 'username')
    .sort({ number_of_votes: -1, title_name: 1 });
  res.json({ success: true, data: choices.map((choice) => withPosterUrl(choice, CHOICE_POSTER_BASE)) });
}

// All active users: dropdown source for "recommended by" and the Users tab list
export async function listUsers(_req, res) {
  const users = await User.find({ is_deleted: { $ne: true } }).select('username is_admin').sort({ username: 1 });
  res.json({ success: true, data: users });
}

// recommended_by = id of a user picked from the dropdown. chosen_by starts empty (nobody voted yet).
export async function createChoice(req, res) {
  if (!(await User.exists({ _id: req.body.recommended_by, is_deleted: { $ne: true } }))) {
    throw new AppError('Selected user does not exist.', 400);
  }
  const { poster, ...fields } = req.body;
  const choice = await ScreeningChoice.create({
    ...fields,
    details: fields.details || undefined,
    poster: poster ? buildPoster(poster) : undefined, // optional, can be set later
  });
  res.status(201).json({ success: true, data: withPosterUrl(choice, CHOICE_POSTER_BASE) });
}

// Soft delete: the record stays, is_deleted flips to true.
// Its votes are released too, so the people who voted for it can vote again.
export async function removeChoice(req, res) {
  const choice = await ScreeningChoice.findOneAndUpdate(
    { _id: req.params.id, is_deleted: false },
    { is_deleted: true, chosen_by: [], number_of_votes: 0 },
    { new: true }
  );
  if (!choice) throw new AppError('Movie not found or already deleted.', 404);
  res.json({ success: true, message: 'Movie removed from the poll.', data: choice });
}

// Delete forever: erases a REMOVED movie (and its poster) from the database. This cannot be undone.
// Only removed movies qualify, so a movie in the poll can never be erased by accident.
// Reviews written for the movie and a winner record made from it are separate records and are kept.
export async function purgeChoice(req, res) {
  const choice = await ScreeningChoice.findOneAndDelete({ _id: req.params.id, is_deleted: true }).select('title_name');
  if (!choice) throw new AppError('Only a removed movie can be deleted forever. Remove it from the poll first.', 404);
  res.json({ success: true, message: `"${choice.title_name}" was deleted forever.` });
}

/* ---------- Who voted for what ---------- */

// Every poll entry with its voters (chosen_by)
export async function votesByChoice(req, res) {
  const filter = req.query.include_deleted === 'true' ? {} : { is_deleted: false };
  const choices = await ScreeningChoice.find(filter)
    .populate('recommended_by', 'username')
    .populate('chosen_by', 'username email')
    .sort({ number_of_votes: -1, title_name: 1 });

  res.json({
    success: true,
    data: choices.map((c) => {
      const { chosen_by, ...rest } = withPosterUrl(c, CHOICE_POSTER_BASE);
      return { ...rest, voters: chosen_by };
    }),
  });
}

/* ---------- Winners ---------- */

export async function listWinners(_req, res) {
  const winners = await ScreeningWinner.find()
    .populate('recommended_by', 'username')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: winners });
}

// Make exactly one winner current: everyone else is switched off first,
// then this one is switched on (a partial unique index guards against two current winners).
async function setCurrent(winnerId) {
  await ScreeningWinner.updateMany({ _id: { $ne: winnerId }, is_current: true }, { is_current: false });
  return ScreeningWinner.findByIdAndUpdate(winnerId, { is_current: true }, { new: true });
}

// There can only ever be one winner: the current one must be turned off before the next one is set
async function requireNoOtherCurrent(exceptId) {
  const filter = exceptId ? { is_current: true, _id: { $ne: exceptId } } : { is_current: true };
  if (await ScreeningWinner.exists(filter)) {
    throw new AppError('There is already a current winner. Turn it off first, then set the next winner.', 409);
  }
}

// Declare a poll entry as the winner (copies it into screening_winners and makes it current).
// Declaring a winner also closes voting (the "Open voting" switch goes back off).
export async function declareWinner(req, res) {
  await requireNoOtherCurrent();
  const choice = await ScreeningChoice.findById(req.body.screening_choice_id);
  if (!choice || choice.is_deleted) throw new AppError('Poll entry not found.', 404);

  const details = req.body.details || choice.details;
  if (!details) {
    throw new AppError('This movie has no details yet - please provide `details` for the winner.', 400);
  }

  const winner = await ScreeningWinner.create({
    title_name: choice.title_name,
    release_year: choice.release_year,
    recommended_by: choice.recommended_by,
    runtime: choice.runtime,
    details,
    is_current: false,
    screening_choice_id_fk: choice._id,
    votes_at_declaration: choice.number_of_votes,
  });
  const current = await setCurrent(winner._id);
  await setVotingSwitch(false);
  res.status(201).json({ success: true, message: 'Winner declared and set as current.', data: current });
}

// Switch an existing winner on as current (all others go off)
export async function makeCurrent(req, res) {
  if (!(await ScreeningWinner.exists({ _id: req.params.id }))) {
    throw new AppError('Winner not found.', 404);
  }
  await requireNoOtherCurrent(req.params.id);
  const winner = await setCurrent(req.params.id);
  await setVotingSwitch(false);
  res.json({ success: true, message: 'Current winner updated.', data: winner });
}

// Switch the current flag off entirely (no current winner shown on the landing page)
export async function clearCurrent(_req, res) {
  await ScreeningWinner.updateMany({ is_current: true }, { is_current: false });
  await setVotingSwitch(false); // no stale "open" switch is left behind
  res.json({ success: true, message: 'No current winner is set now.' });
}

/* ---------- Open voting switch ---------- */

// has_current_winner: a winner is on the home page. voting_open: the switch.
// is_voting_open: what visitors actually get (open when there is no winner, or the switch is on).
function votingJson(status) {
  return { has_current_winner: status.hasWinner, voting_open: status.switchOn, is_voting_open: status.open };
}

export async function getVoting(_req, res) {
  res.json({ success: true, data: votingJson(await getVotingStatus()) });
}

// Lets people vote again while the current winner stays on the home page
export async function setVoting(req, res) {
  if (!(await getVotingStatus()).hasWinner) {
    throw new AppError('Voting is already open: there is no current winner.', 409);
  }
  await setVotingSwitch(req.body.open);
  const status = await getVotingStatus();
  res.json({
    success: true,
    message: status.open ? 'Voting is open.' : 'Voting is closed.',
    data: votingJson(status),
  });
}