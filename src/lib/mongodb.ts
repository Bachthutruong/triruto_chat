// src/lib/mongodb.ts
import mongoose from 'mongoose';

// Load environment variables
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://vuduybachvp:TJ4obGsJleYENZzV@livechat.jcxnz9h.mongodb.net/aetherchat?retryWrites=true&w=majority';

// Mask sensitive information in logs
const maskedUri = MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//<username>:<password>@');
console.log('MongoDB: Attempting to connect to', maskedUri);

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections from growing exponentially
 * during API Route usage.
 */
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    console.log('MongoDB: Using cached connection');
    return cached.conn;
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      // Connection options
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      // SSL options for Atlas
      ssl: true,
      // Auth options
      authSource: 'admin',
      // Connection pool options
      maxPoolSize: 10,
      minPoolSize: 5,
      maxIdleTimeMS: 60000,
      waitQueueTimeoutMS: 10000,
      // Write concern options
      w: 1,
      wtimeoutMS: 2500,
      // Read preference options
      readPreference: 'primaryPreferred',
      // Retry options
      retryWrites: true,
      retryReads: true,
      // Other options
      family: 4,
      // Remove directConnection as it may cause issues with Atlas
      autoIndex: true,
      autoCreate: true,
    };

    console.log('MongoDB: Creating new connection...');
    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then((mongoose) => {
        console.log('MongoDB: Successfully connected!');
        
        // Add connection event handlers
        mongoose.connection.on('error', (err) => {
          console.error('MongoDB connection error:', err);
          // Check if it's an IP whitelist error
          if (err.message && err.message.includes('whitelist')) {
            console.error('MongoDB: IP whitelist error detected. Please add your IP to MongoDB Atlas whitelist.');
            console.error('Visit: https://www.mongodb.com/docs/atlas/security-whitelist/');
            console.error('Current error details:', err);
          }
        });

        mongoose.connection.on('disconnected', () => {
          console.log('MongoDB disconnected, attempting to reconnect...');
          // Clear the cached connection
          cached.conn = null;
          cached.promise = null;
          // Attempt to reconnect
          dbConnect().catch(err => {
            console.error('MongoDB reconnection error:', err);
          });
        });

        mongoose.connection.on('reconnected', () => {
          console.log('MongoDB reconnected successfully');
        });

        return mongoose;
      })
      .catch((error) => {
        console.error('MongoDB: Connection error:', error);
        // Check if it's an IP whitelist error
        if (error.message && error.message.includes('whitelist')) {
          console.error('MongoDB: IP whitelist error detected. Please add your IP to MongoDB Atlas whitelist.');
          console.error('Visit: https://www.mongodb.com/docs/atlas/security-whitelist/');
          console.error('Current error details:', error);
        }
        // Clear the cached promise on error to allow retry
        cached.promise = null;
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    console.error('MongoDB: Error while getting cached promise:', error);
    // Clear the cached connection on error
    cached.conn = null;
    cached.promise = null;
    throw error;
  }
}

export default dbConnect;
