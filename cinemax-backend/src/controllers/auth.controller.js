import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

const signToken = (user) =>
  jwt.sign({ id: user.id }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

const authResponse = (user) => ({
  success: true,
  token: signToken(user),
  user: user.toJSON(),
});

async function checkCredentials({ username, password }) {
  const user = await User.findOne({ username: username.toLowerCase(), is_deleted: { $ne: true } });
  const ok = user && (await bcrypt.compare(password, user.hashed_password));
  if (!ok) throw new AppError('Invalid username or password.', 401);
  return user;
}

export async function login(req, res) {
  res.json(authResponse(await checkCredentials(req.body)));
}

// Same as login but only lets admins in (used by the admin page)
export async function adminLogin(req, res) {
  const user = await checkCredentials(req.body);
  if (!user.is_admin) throw new AppError('This account is not an admin.', 403);
  res.json(authResponse(user));
}

export function me(req, res) {
  res.json({ success: true, user: req.user.toJSON() });
}
