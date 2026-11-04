// Creates the predefined sample data. Safe to run more than once.
//   npm run seed
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { connectDb } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { ScreeningChoice } from '../src/models/ScreeningChoice.js';
import { ScreeningWinner } from '../src/models/ScreeningWinner.js';

await connectDb(env.mongoUri);

async function upsertUser(username, password, is_admin, email) {
  const existing = await User.findOne({ username });
  if (existing) return existing;
  return User.create({
    username,
    email,
    hashed_password: await bcrypt.hash(password, 12),
    is_admin,
  });
}

await upsertUser('admin', 'admin123', true, 'admin@cinemax.test');
const alex = await upsertUser('alex', 'alex123', false, 'alex@cinemax.test');
const sarah = await upsertUser('sarah', 'sarah123', false, 'sarah@cinemax.test');

const polls = [
  ['Interstellar (IMAX 70mm)', 2014, 169, alex],
  ['Blade Runner 2049', 2017, 164, sarah],
  ['Spirited Away', 2001, 125, alex],
  ['The Dark Knight', 2008, 152, sarah],
];
for (const [title_name, release_year, runtime, recommender] of polls) {
  await ScreeningChoice.updateOne(
    { title_name, release_year },
    {
      $setOnInsert: {
        recommended_by: recommender._id,
        chosen_by: [],
        runtime,
        number_of_votes: 0,
        details: `${title_name} - community pick for the next screening.`,
      },
    },
    { upsert: true }
  );
}

if (!(await ScreeningWinner.exists({}))) {
  await ScreeningWinner.create({
    title_name: 'The Last Projection',
    release_year: 2026,
    recommended_by: alex._id,
    runtime: 134,
    details: 'In a fading single-screen theater, one projectionist runs a final week of films before the lights go out for good.',
    is_current: false, // a past winner; the admin declares a new current one (that also closes voting)
  });
}

console.log('Seed done.  admin / admin123   alex / alex123   sarah / sarah123');
await mongoose.disconnect();
