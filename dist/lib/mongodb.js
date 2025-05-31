"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/lib/mongodb.ts
const mongoose_1 = __importDefault(require("mongoose"));
// Load environment variables
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://vuduybachvp:TJ4obGsJleYENZzV@livechat.jcxnz9h.mongodb.net/aetherchat';
console.log('MongoDB: Attempting to connect to', MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//<username>:<password>@'));
/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections from growing exponentially
 * during API Route usage.
 */
let cached = global.mongoose;
if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}
async function dbConnect() {
    if (cached.conn) {
        console.log('MongoDB: Using cached connection');
        return cached.conn;
    }
    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
        };
        console.log('MongoDB: Creating new connection...');
        cached.promise = mongoose_1.default.connect(MONGODB_URI, opts)
            .then((mongoose) => {
            console.log('MongoDB: Successfully connected!');
            return mongoose;
        })
            .catch((error) => {
            console.error('MongoDB: Connection error:', error);
            throw error;
        });
    }
    try {
        cached.conn = await cached.promise;
        return cached.conn;
    }
    catch (error) {
        console.error('MongoDB: Error while getting cached promise:', error);
        throw error;
    }
}
exports.default = dbConnect;
