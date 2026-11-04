import { MovieLog } from '../models/MovieLog.js';

// Recent reviews for the landing page (public)
export async function listRecent(req, res) {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const logs = await MovieLog.find()
    .sort({ added_date_time: -1 })
    .limit(limit)
    .populate('user_id_fk', 'username');
  res.json({
    success: true,
    data: logs.map((log) => {
      const { user_id_fk, ...rest } = log.toJSON();
      return { ...rest, user_id_fk: user_id_fk?.id, username: user_id_fk?.username };
    }),
  });
}

export async function listMine(req, res) {
  const logs = await MovieLog.find({ user_id_fk: req.user.id }).sort({ added_date_time: -1 });
  res.json({ success: true, data: logs });
}

// Add a review, or update yours if you already reviewed that movie
export async function upsert(req, res) {
  const { title_name, release_year, rating, comment } = req.body;
  const log = await MovieLog.findOneAndUpdate(
    { user_id_fk: req.user.id, title_name, release_year },
    { $set: { rating, comment: comment ?? '', added_date_time: new Date() } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.status(201).json({ success: true, data: log });
}
