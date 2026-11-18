import { env } from '../config/env.js';
import { AppError } from './AppError.js';
import { sniffImageType } from './imageType.js';

// A movie poster travels as a base64 data URI: "data:image/jpeg;base64,/9j/4AAQ..."
// and is stored on the movie itself as { content_type, data (base64), updated_at }.
const DATA_URI = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

// Checks a data URI sent by the admin and returns the object to store on the movie.
// The real image type is read from the bytes (not from the text before the comma),
// and the decoded size must stay within MAX_IMAGE_UPLOAD_MB.
export function buildPoster(dataUri) {
  const match = DATA_URI.exec(dataUri || '');
  if (!match) throw new AppError('The poster must be a base64 JPG, PNG or WebP image.', 400);

  const bytes = Buffer.from(match[1], 'base64');
  if (bytes.length > env.maxImageBytes) {
    const mb = Number((env.maxImageBytes / 1024 / 1024).toFixed(2));
    throw new AppError(`Poster is too large. The maximum is ${mb} MB.`, 413);
  }
  const contentType = sniffImageType(bytes);
  if (!contentType) throw new AppError('Only JPG, PNG or WebP posters are allowed.', 400);

  return { content_type: contentType, data: match[1], updated_at: new Date() };
}

// Turns a movie into plain JSON for the API: the heavy base64 never leaves in lists.
// The page gets `poster_url` instead (null when the movie has no poster). ?v= changes
// with every new poster, so browsers can cache the image for a long time.
export function withPosterUrl(doc, basePath) {
  const { poster, ...rest } = doc.toJSON();
  const version = poster && poster.updated_at ? new Date(poster.updated_at).getTime() : null;
  return { ...rest, poster_url: version ? `${basePath}/${rest.id}/poster?v=${version}` : null };
}

// Sends the decoded poster image
export function sendPoster(res, poster, req) {
  const versioned = typeof req.query.v === 'string' && req.query.v !== '';
  res.set({
    'Content-Type': poster.content_type,
    'Cache-Control': versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=86400',
    // helmet blocks cross-origin use by default; the frontend (another domain) must show it
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  res.send(Buffer.from(poster.data, 'base64'));
}
