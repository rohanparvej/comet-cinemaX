import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function notFound(req, _res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  // Upload problems (multer)
  if (err?.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const mb = Number((env.maxImageBytes / 1024 / 1024).toFixed(2));
      return res.status(413).json({ success: false, message: `Image is too large. The maximum is ${mb} MB.` });
    }
    return res.status(400).json({ success: false, message: 'Upload failed. Send one image in the "image" field.' });
  }
  // Duplicate key (e.g. username already taken)
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'value';
    return res.status(409).json({ success: false, message: `That ${field} is already in use.` });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON body.' });
  }
  console.error(err);
  res.status(500).json({ success: false, message: 'Something went wrong.' });
}
