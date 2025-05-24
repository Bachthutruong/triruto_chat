import mongoose, { Schema, models } from 'mongoose';
import bcrypt from 'bcryptjs';
const UserSchema = new Schema({
    phoneNumber: { type: String, required: true, unique: true },
    name: { type: String },
    role: { type: String, enum: ['customer', 'admin', 'staff'], required: true },
    password: { type: String, select: false }, // select: false means it won't be returned by default
    // Staff/Admin specific fields can be added here
}, { timestamps: true });
// Pre-save hook to hash password
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password') || !this.password) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        return next();
    }
    catch (err) {
        return next(err);
    }
});
UserSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password)
        return false;
    return bcrypt.compare(candidatePassword, this.password);
};
// Ensure the model is not recompiled if it already exists
const UserModel = models.User || mongoose.model('User', UserSchema);
export default UserModel;
