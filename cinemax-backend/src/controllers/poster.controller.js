import { ScreeningChoice } from '../models/ScreeningChoice.js';
import { UpcomingMovie } from '../models/UpcomingMovie.js';
import { AppError } from '../utils/AppError.js';
import { buildPoster, sendPoster, withPosterUrl } from '../utils/poster.js';

// Poster endpoints are the same for every kind of movie (poll entry, upcoming movie).
// posterHandlers(Model, basePath) returns serve / set / remove for that model.
function posterHandlers(Model, basePath) {
  const notFound = () => new AppError('Movie not found.', 404);

  return {
    // Public: the poster image itself
    async serve(req, res) {
      const movie = await Model.findOne({ _id: req.params.id, is_deleted: false }).select(
        'poster.content_type poster.updated_at +poster.data'
      );
      if (!movie || !movie.poster || !movie.poster.data) throw new AppError('No poster set.', 404);
      sendPoster(res, movie.poster, req);
    },

    // Admin: set or replace the poster (body: { poster: "data:image/...;base64,..." })
    async set(req, res) {
      const movie = await Model.findOneAndUpdate(
        { _id: req.params.id, is_deleted: false },
        { poster: buildPoster(req.body.poster) },
        { new: true }
      ).select('title_name poster.content_type poster.updated_at');
      if (!movie) throw notFound();
      res.json({ success: true, message: `Poster saved for "${movie.title_name}".`, data: withPosterUrl(movie, basePath) });
    },

    // Admin: remove the poster for good: the base64 is deleted from the database, which frees the space.
    // Works for removed (soft-deleted) movies too, so a poster never gets stuck.
    async remove(req, res) {
      const movie = await Model.findOneAndUpdate(
        { _id: req.params.id },
        { $unset: { poster: 1 } },
        { new: true }
      ).select('title_name');
      if (!movie) throw notFound();
      res.json({ success: true, message: `Poster removed from "${movie.title_name}".` });
    },
  };
}

export const choicePoster = posterHandlers(ScreeningChoice, '/api/screenings/choices');
export const upcomingPoster = posterHandlers(UpcomingMovie, '/api/screenings/upcoming');
