import mongoose, { Schema, Model } from 'mongoose';
import { USER_ROLES } from '@/lib/constants';

export interface IUser {
  _id: mongoose.Types.ObjectId;
  email: string;
  name: string;
  image?: string;
  password?: string;
  role: (typeof USER_ROLES)[keyof typeof USER_ROLES];
  phone?: string;
  verifiedAt?: Date;
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
    phone: String,
    verifiedAt: Date,
    fcmTokens: [{ type: String }],
  },
  { timestamps: true }
);

const User: Model<IUser> = mongoose.models.User ?? mongoose.model<IUser>('User', UserSchema);
export default User;
