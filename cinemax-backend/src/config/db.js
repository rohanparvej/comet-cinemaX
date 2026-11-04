import mongoose from 'mongoose';

export async function connectDb(uri) {
  await mongoose.connect(uri);
  // Make sure unique / partial indexes exist before serving traffic
  await mongoose.connection.syncIndexes();
  console.log('MongoDB connected');
}
