import { ScreeningChoice } from '../models/ScreeningChoice.js';
import { ScreeningWinner } from '../models/ScreeningWinner.js';
import { containsPattern, parseQuery } from '../utils/parseQuery.js';
import { movieSearchQuery } from '../utils/schemas.js';

// Searchable list behind the review form's movie box (public).
// Every movie that was ever a winner or in the poll can be reviewed, including past winners and
// movies later removed from the poll. A movie that appears more than once is listed once.
// Order: the movie now playing, past winners, then the rest (newest first).
export async function search(req, res) {
  const { q, limit } = parseQuery(movieSearchQuery, req.query);

  let filter = {};
  if (q) {
    const or = [{ title_name: containsPattern(q) }];
    if (/^\d{4}$/.test(q)) or.push({ release_year: Number(q) }); // typing a year works too
    filter = { $or: or };
  }

  const [winners, choices] = await Promise.all([
    ScreeningWinner.find(filter).select('title_name release_year is_current').sort({ is_current: -1, createdAt: -1 }).limit(100),
    ScreeningChoice.find(filter).select('title_name release_year').sort({ createdAt: -1 }).limit(100),
  ]);

  const movies = new Map();
  function add(movie, status) {
    const key = `${movie.title_name}|${movie.release_year}`;
    if (!movies.has(key)) movies.set(key, { title_name: movie.title_name, release_year: movie.release_year, status });
  }
  winners.forEach((winner) => add(winner, winner.is_current ? 'now_playing' : 'past_winner'));
  choices.forEach((choice) => add(choice, null));

  res.json({ success: true, data: [...movies.values()].slice(0, limit) });
}
