import { AppError } from './AppError.js';

// Checks ?query=string values with a Joi schema and returns them converted (numbers, defaults).
// Unknown parameters are ignored. A bad value answers 400 with a readable message.
export function parseQuery(schema, query) {
  const { value, error } = schema.validate(query ?? {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new AppError(error.details.map((d) => d.message.replace(/"/g, '')).join('; '), 400);
  return value;
}

// Text typed by a visitor -> a safe, case-insensitive "contains" pattern
export function containsPattern(text) {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}
