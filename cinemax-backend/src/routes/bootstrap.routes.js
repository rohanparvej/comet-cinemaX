// ONE-TIME ADMIN SETUP ROUTE  (POST /api/auth/signup)
//
// Creates an ADMIN account from just a username and password, so the very first
// admins can exist without touching the database by hand.
//   - It closes itself once MAX_BOOTSTRAP_ADMINS admins exist (default 2).
//   - Optional: set SETUP_KEY in .env and send it as the `x-setup-key` header.
//
// TO REMOVE IT FOR GOOD: delete this file. Nothing else imports it and nothing
// else needs editing (src/app.js mounts it only if the file exists).

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../utils/AppError.js';

const router = Router();

const body = Joi.object({
  username: Joi.string().trim().min(3).max(30).pattern(/^[a-zA-Z0-9_.-]+$/).required(),
  password: Joi.string().min(6).max(72).required(),
});

router.post(
  '/signup',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }),
  validate({ body }),
  async (req, res) => {
    const setupKey = process.env.SETUP_KEY;
    if (setupKey && req.headers['x-setup-key'] !== setupKey) {
      throw new AppError('Invalid setup key.', 403);
    }

    const raw = process.env.MAX_BOOTSTRAP_ADMINS;
    const max = raw === undefined || raw === '' ? 2 : Number(raw);
    const admins = await User.countDocuments({ is_admin: true, is_deleted: { $ne: true } });
    if (admins >= max) {
      throw new AppError('Admin setup is closed.', 403);
    }

    const user = await User.create({
      username: req.body.username,
      hashed_password: await bcrypt.hash(req.body.password, 12),
      is_admin: true,
    });
    res.status(201).json({ success: true, message: 'Admin created.', data: user.toJSON() });
  }
);

export default router;
