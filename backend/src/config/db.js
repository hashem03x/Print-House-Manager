import mongoose from 'mongoose';

// Fail fast instead of silently queueing queries while the database is down.
mongoose.set('bufferCommands', false);
mongoose.set('strictQuery', true);

/**
 * Hides credentials in a connection string so it is safe to log.
 * mongodb+srv://user:secret@host/db -> mongodb+srv://***@host/db
 */
export function redactUri(uri) {
  return uri.replace(/\/\/[^@/]+@/, '//***@');
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

export async function connectDB(uri) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    const { host, name } = mongoose.connection;
    console.info(`[db] Connected to MongoDB at ${host} (database: "${name}")`);

    mongoose.connection.on('disconnected', () => console.warn('[db] MongoDB disconnected'));
    mongoose.connection.on('reconnected', () => console.info('[db] MongoDB reconnected'));
    mongoose.connection.on('error', (error) => console.error(`[db] MongoDB error: ${error.message}`));
  } catch (error) {
    const reason = error.message.replaceAll(uri, redactUri(uri));
    throw new Error(
      `Could not connect to MongoDB at ${redactUri(uri)}.\n` +
        `       Reason: ${reason}\n` +
        '       Check that MongoDB is running and that MONGODB_URI in backend/.env is correct.',
      { cause: error }
    );
  }
}

export async function disconnectDB() {
  await mongoose.connection.close();
}
