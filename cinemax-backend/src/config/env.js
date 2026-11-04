import 'dotenv/config';

const required = ['MONGODB_URI', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(`Missing required env variables: ${missing.join(', ')}`);
}

export const env = {
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // Upload size cap for images, in bytes. Change it with MAX_IMAGE_UPLOAD_MB in .env (default 1).
  maxImageBytes: (Number(process.env.MAX_IMAGE_UPLOAD_MB) || 1) * 1024 * 1024,
  frontendDir: process.env.FRONTEND_DIR,
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
