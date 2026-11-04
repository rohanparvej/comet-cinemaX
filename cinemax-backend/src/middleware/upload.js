import multer from 'multer';
import { env } from '../config/env.js';

// Reads ONE file from the form field "image" into memory. Larger than the cap -> error (see error.js).
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxImageBytes, files: 1 },
}).single('image');
