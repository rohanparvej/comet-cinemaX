import { env } from './src/config/env.js';
import { connectDb } from './src/config/db.js';
import app from './src/app.js';

await connectDb(env.mongoUri);
app.listen(env.port, () => console.log(`Cinemax API running on http://localhost:${env.port}`));
