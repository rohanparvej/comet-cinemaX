import Joi from 'joi';

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

export const choiceBody = Joi.object({
  title_name: Joi.string().trim().min(1).max(200).required(),
  release_year: releaseYear.required(),
  recommended_by: objectId.required(), // user id from the dropdown
  runtime: Joi.number().integer().min(1).max(1000).required(), // minutes
  details: Joi.string().trim().max(2000).allow(''),
});

export const declareWinnerBody = Joi.object({
  screening_choice_id: objectId.required(),
  // Needed only when the poll entry has no details of its own
  details: Joi.string().trim().min(1).max(2000),
});
