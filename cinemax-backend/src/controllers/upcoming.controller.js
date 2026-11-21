import { UpcomingMovie } from '../models/UpcomingMovie.js';
import { AppError } from '../utils/AppError.js';
import { buildPoster, withPosterUrl } from '../utils/poster.js';

const BASE = '/api/screenings/upcoming';
const SHOWN = 'title_name release_year runtime details poster.updated_at';

// Public (home page) and admin page: upcoming movies in the order the admin added them
export async function list(_req, res) {
  const movies = await UpcomingMovie.find({ is_deleted: false }).select(SHOWN).sort({ createdAt: 1 });
  res.json({ success: true, data: movies.map((movie) => withPosterUrl(movie, BASE)) });
}

// Admin: add one. The poster is optional here and can be set or replaced later.
export async function create(req, res) {
  const { poster, ...fields } = req.body;
  const movie = await UpcomingMovie.create({
    ...fields,
    details: fields.details || undefined,
    poster: poster ? buildPoster(poster) : undefined,
  });
  res.status(201).json({ success: true, data: withPosterUrl(movie, BASE) });
}

// Admin: change the text fields
export async function update(req, res) {
  const movie = await UpcomingMovie.findOneAndUpdate(
    { _id: req.params.id, is_deleted: false },
    req.body,
    { new: true, runValidators: true }
  ).select(SHOWN);
  if (!movie) throw new AppError('Movie not found.', 404);
  res.json({ success: true, data: withPosterUrl(movie, BASE) });
}

// Admin: soft delete (the record stays, it only disappears from the home page).
// Its poster is deleted from the database too: a removed upcoming movie is never listed
// again, so there would be no way to remove the poster later.
export async function remove(req, res) {
  const movie = await UpcomingMovie.findOneAndUpdate(
    { _id: req.params.id, is_deleted: false },
    { $set: { is_deleted: true }, $unset: { poster: 1 } },
    { new: true }
  ).select('title_name');
  if (!movie) throw new AppError('Movie not found or already removed.', 404);
  res.json({ success: true, message: `"${movie.title_name}" removed from upcoming.` });
}
