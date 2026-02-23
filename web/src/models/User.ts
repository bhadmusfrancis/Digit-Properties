import mongoose, { Schema, Model } from 'mongoose';
import { USER_ROLES, SUBSCRIPTION_TIERS } from '@/lib/constants';

export interface IUser {
  _id: mongoose.Types.ObjectId;
  email: string;
  name: string;
  image?: string;
  password?: string;
  role: (typeof USER_ROLES)[keyof typeof USER_ROLES];
  subscriptionTier?: (typeof SUBSCRIPTION_TIERS)[keyof typeof SUBSCRIPTION_TIERS];
  phone?: string;
  /** Set when user verified their email (credentials signup or after verify-email link). */
  verifiedAt?: Date;
  /** One-time token for email verification link; cleared after verify. */
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  /** One-time token for password reset link; cleared after reset. */
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  fcmTokens: string[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    image: String,
    password: String,
    role: { type: String, enum: Object.values(USER_ROLES), default: USER_ROLES.GUEST },
    subscriptionTier: { type: String, enum: Object.values(SUBSCRIPTION_TIERS) },
    phone: String,
    verifiedAt: Date,
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    fcmTokens: [{ type: String }],
  },
  { timestamps: true }
);

const User: Model<IUser> = mongoose.models.User ?? mongoose.model<IUser>('User', UserSchema);
export default User;
