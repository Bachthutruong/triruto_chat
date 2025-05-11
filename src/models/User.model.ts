// src/models/User.model.ts
import type { UserSession, UserRole } from '@/lib/types';
import mongoose, { Schema, Document, models, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document, Omit<UserSession, 'id' | 'chatHistory' | 'appointments' | 'products' | 'notes' | 'tags'> {
  password?: string; // Password will be stored hashed
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema<IUser> = new Schema({
  phoneNumber: { type: String, required: true, unique: true },
  name: { type: String },
  role: { type: String, enum: ['customer', 'admin', 'staff'], required: true },
  password: { type: String, select: false }, // select: false means it won't be returned by default
  // Staff/Admin specific fields can be added here
}, { timestamps: true });

// Pre-save hook to hash password
UserSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (err: any) {
    return next(err);
  }
});

UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Ensure the model is not recompiled if it already exists
const UserModel = models.User as Model<IUser> || mongoose.model<IUser>('User', UserSchema);

export default UserModel;
