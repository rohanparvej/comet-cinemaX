import Joi from 'joi';
import { env } from '../config/env.js';

export const objectId = Joi.string().hex().length(24);
export const idParam = Joi.object({ id: objectId.required() });

const thisYear = new Date().getFullYear();
const releaseYear = Joi.number().integer().min(1888).max(thisYear + 5);

// Used by the admin "create user" endpoint
export const createUserBody = Joi.object({
  username: Joi.string().trim().min(3).max(30).pattern(/^[a-zA-Z0-9_.-]+$/).required(),
  email: Joi.string().trim().email().allow('', null),
  password: Joi.string().min(6).max(72).required(),
});

export const loginBody = Joi.object({
  username: Joi.string().trim().required(),
  password: Joi.string().required(),
});

export const movieLogBody = Joi.object({
  title_name: Joi.string().trim().min(1).max(200).required(),
  release_year: releaseYear.required(),
  rating: Joi.number().min(0.5).max(5).multiple(0.5).required(),
  comment: Joi.string().trim().max(500).allow(''),
});

/* ---------- Reviews: query strings ---------- */

const page = Joi.number().integer().min(1).default(1);
const searchText = Joi.string().trim().max(100).allow('');

// Home page: only the newest reviews. top_k = how many (5 by default).
export const recentQuery = Joi.object({
  top_k: Joi.number().integer().min(1).max(50).default(5),
});

// Same filters for the forum page, whether it lists reviews or movies
const reviewFilters = {
  q: searchText, // movie title, review text or username
  title: Joi.string().trim().max(200),
  year: releaseYear,
  min_rating: Joi.number().min(0.5).max(5),
  max_rating: Joi.number().min(0.5).max(5),
  days: Joi.number().integer().min(1).max(3650), // only reviews from the last N days
  page,
};

export const browseQuery = Joi.object({
  ...reviewFilters,
  per_page: Joi.number().integer().min(1).max(50).default(20),
  sort: Joi.string().valid('newest', 'oldest', 'highest', 'lowest').default('newest'),
});

export const movieSummaryQuery = Joi.object({
  ...reviewFilters,
  per_page: Joi.number().integer().min(1).max(50).default(12),
  sort: Joi.string().valid('latest', 'most_reviewed', 'top_rated', 'title').default('latest'),
});

// The searchable movie box in the review form
export const movieSearchQuery = Joi.object({
  q: searchText,
  limit: Joi.number().integer().min(1).max(30).default(15),
});

// A poster is a base64 data URI. Its real type and size are checked again in utils/poster.js
const posterDataUri = Joi.string().max(env.adminJsonLimitBytes);

export const votingBody = Joi.object({ open: Joi.boolean().required() });

export const posterBody = Joi.object({ poster: posterDataUri.required() });

export const upcomingBody = Joi.object({
  title_name: Joi.string().trim().min(1).max(200).required(),
  release_year: releaseYear.required(),
  runtime: Joi.number().integer().min(1).max(1000),
  details: Joi.string().trim().max(2000).allow(''),
  poster: posterDataUri, // optional: can also be set later
});

export const upcomingUpdateBody = Joi.object({
  title_name: Joi.string().trim().min(1).max(200),
  release_year: releaseYear,
  runtime: Joi.number().integer().min(1).max(1000),
  details: Joi.string().trim().max(2000).allow(''),
}).min(1);

export const choiceBody = Joi.object({
  title_name: Joi.string().trim().min(1).max(200).required(),
  release_year: releaseYear.required(),
  recommended_by: objectId.required(), // user id from the dropdown
  runtime: Joi.number().integer().min(1).max(1000).required(), // minutes
  details: Joi.string().trim().max(2000).allow(''),
  poster: posterDataUri, // optional: can also be set later
});

export const declareWinnerBody = Joi.object({
  screening_choice_id: objectId.required(),
  // Needed only when the poll entry has no details of its own
  details: Joi.string().trim().min(1).max(2000),
});
