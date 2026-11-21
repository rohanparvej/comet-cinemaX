import mongoose from 'mongoose';
import { IMAGE_SLOTS } from './imageSlots.js';
import { SiteImage } from '../models/SiteImage.js';
import { UpcomingMovie } from '../models/UpcomingMovie.js';

export async function connectDb(uri) {
  await mongoose.connect(uri);
  // Make sure unique / partial indexes exist before serving traffic
  await mongoose.connection.syncIndexes();
  // Images of slots that no longer exist (e.g. the old "Poll poster 1/2") would sit in the
  // database forever: delete them now to free the space.
  const stale = await SiteImage.deleteMany({ key: { $nin: Object.keys(IMAGE_SLOTS) } });
  if (stale.deletedCount) console.log(`Removed ${stale.deletedCount} image(s) of slots that no longer exist`);
  // Upcoming movies removed before posters were freed on removal still hold their base64 poster.
  // Only the poster is unset (the records stay). Safe to run on every start: once clean, it matches nothing.
  const posters = await UpcomingMovie.updateMany({ is_deleted: true, poster: { $exists: true } }, { $unset: { poster: 1 } });
  if (posters.modifiedCount) console.log(`Freed ${posters.modifiedCount} poster(s) of removed upcoming movies`);
  console.log('MongoDB connected');
}
