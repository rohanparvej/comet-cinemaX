import { MovieLog } from '../models/MovieLog.js';
import { ScreeningChoice } from '../models/ScreeningChoice.js';
import { User } from '../models/User.js';
import { containsPattern, parseQuery } from '../utils/parseQuery.js';
import { withPosterUrl } from '../utils/poster.js';
import { browseQuery, movieSummaryQuery, recentQuery } from '../utils/schemas.js';

// A review as the pages need it: the user's id and username next to it
function presentLog(log) {
  const { user_id_fk, ...rest } = log.toJSON();
  return { ...rest, user_id_fk: user_id_fk?.id, username: user_id_fk?.username };
}

// Recent reviews for the landing page (public). top_k = how many (5 by default, 50 at most).
// total lets the page show "See all N reviews".
export async function listRecent(req, res) {
  const { top_k } = parseQuery(recentQuery, req.query);
  const [logs, total] = await Promise.all([
    MovieLog.find().sort({ added_date_time: -1 }).limit(top_k).populate('user_id_fk', 'username'),
    MovieLog.estimatedDocumentCount(),
  ]);
  res.json({ success: true, data: logs.map(presentLog), total });
}

// Turns the forum filters into a MongoDB filter (shared by the review list and the movie list)
async function buildFilter(params) {
  const filter = {};
  if (params.title) filter.title_name = params.title;
  if (params.year) filter.release_year = params.year;
  if (params.min_rating || params.max_rating) {
    filter.rating = {};
    if (params.min_rating) filter.rating.$gte = params.min_rating;
    if (params.max_rating) filter.rating.$lte = params.max_rating;
  }
  if (params.days) filter.added_date_time = { $gte: new Date(Date.now() - params.days * 24 * 60 * 60 * 1000) };
  if (params.q) {
    const pattern = containsPattern(params.q);
    const users = await User.find({ username: pattern }).select('_id').limit(100);
    filter.$or = [{ title_name: pattern }, { comment: pattern }, { user_id_fk: { $in: users.map((user) => user._id) } }];
  }
  return filter;
}

const REVIEW_SORT = {
  newest: { added_date_time: -1 },
  oldest: { added_date_time: 1 },
  highest: { rating: -1, added_date_time: -1 },
  lowest: { rating: 1, added_date_time: -1 },
};

// Forum page, "All reviews" view: filtered, sorted and paged (public)
export async function browse(req, res) {
  const params = parseQuery(browseQuery, req.query);
  const filter = await buildFilter(params);
  const [logs, total] = await Promise.all([
    MovieLog.find(filter)
      .sort(REVIEW_SORT[params.sort])
      .skip((params.page - 1) * params.per_page)
      .limit(params.per_page)
      .populate('user_id_fk', 'username'),
    MovieLog.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: logs.map(presentLog),
    page: params.page,
    per_page: params.per_page,
    total,
    has_more: params.page * params.per_page < total,
  });
}

const MOVIE_SORT = {
  latest: { latest_review_at: -1, '_id.title_name': 1 },
  most_reviewed: { review_count: -1, '_id.title_name': 1 },
  top_rated: { average_rating: -1, review_count: -1, '_id.title_name': 1 },
  title: { '_id.title_name': 1, '_id.release_year': 1 },
};

// Forum page, "By movie" view: one row per movie with its review count and average rating (public)
export async function movieSummaries(req, res) {
  const params = parseQuery(movieSummaryQuery, req.query);
  const filter = await buildFilter(params);

  const [result] = await MovieLog.aggregate([
    { $match: filter },
    {
      $group: {
        _id: { title_name: '$title_name', release_year: '$release_year' },
        review_count: { $sum: 1 },
        average_rating: { $avg: '$rating' },
        latest_review_at: { $max: '$added_date_time' },
      },
    },
    { $sort: MOVIE_SORT[params.sort] },
    {
      $facet: {
        rows: [{ $skip: (params.page - 1) * params.per_page }, { $limit: params.per_page }],
        count: [{ $count: 'total' }],
      },
    },
  ]);
  const rows = result.rows;
  const total = result.count[0] ? result.count[0].total : 0;

  // Posters live on the poll movies: look them up for this page of movies only
  const posters = new Map();
  if (rows.length) {
    const choices = await ScreeningChoice.find({
      $or: rows.map((row) => ({ title_name: row._id.title_name, release_year: row._id.release_year })),
      'poster.updated_at': { $exists: true },
    }).select('title_name release_year poster.updated_at');
    for (const choice of choices) {
      posters.set(`${choice.title_name}|${choice.release_year}`, withPosterUrl(choice, '/api/screenings/choices').poster_url);
    }
  }

  res.json({
    success: true,
    data: rows.map((row) => ({
      title_name: row._id.title_name,
      release_year: row._id.release_year,
      review_count: row.review_count,
      average_rating: Math.round(row.average_rating * 10) / 10,
      latest_review_at: row.latest_review_at,
      poster_url: posters.get(`${row._id.title_name}|${row._id.release_year}`) || null,
    })),
    page: params.page,
    per_page: params.per_page,
    total,
    has_more: params.page * params.per_page < total,
  });
}

export async function listMine(req, res) {
  const logs = await MovieLog.find({ user_id_fk: req.user.id }).sort({ added_date_time: -1 });
  res.json({ success: true, data: logs });
}

// Add a review, or update yours if you already reviewed that movie
export async function upsert(req, res) {
  const { title_name, release_year, rating, comment } = req.body;
  const log = await MovieLog.findOneAndUpdate(
    { user_id_fk: req.user.id, title_name, release_year },
    { $set: { rating, comment: comment ?? '', added_date_time: new Date() } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.status(201).json({ success: true, data: log });
}
