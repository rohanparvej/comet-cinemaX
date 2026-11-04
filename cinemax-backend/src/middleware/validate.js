import { AppError } from '../utils/AppError.js';

// validate({ body: JoiSchema, params: JoiSchema })
export const validate = (schemas) => (req, _res, next) => {
  for (const part of ['params', 'body']) {
    if (!schemas[part]) continue;
    const { value, error } = schemas[part].validate(req[part] ?? {}, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      throw new AppError(error.details.map((d) => d.message.replace(/"/g, '')).join('; '), 400);
    }
    req[part] = value;
  }
  next();
};
