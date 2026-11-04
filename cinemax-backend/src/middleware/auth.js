import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

// Requires "Authorization: Bearer <token>"; attaches the user to req.user
export async function protect(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AppError('Please log in first.', 401);

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new AppError('Session expired or invalid. Please log in again.', 401);
  }

  const user = await User.findById(payload.id);
  if (!user || user.is_deleted) throw new AppError('User no longer exists.', 401);
  req.user = user;
  next();
}

// Must run after protect
export function requireAdmin(req, _res, next) {
  if (!req.user?.is_admin) throw new AppError('Admin access only.', 403);
  next();
}
