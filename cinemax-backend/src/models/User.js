import mongoose from 'mongoose';
import { applyJson } from './toJson.js';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    hashed_password: { type: String, required: true },
    is_admin: { type: Boolean, required: true, default: false },
    is_deleted: { type: Boolean, default: false }, // soft delete: deleted users cannot log in
  },
  { collection: 'users', timestamps: true }
);
applyJson(userSchema);

export const User = mongoose.model('User', userSchema);
