import mongoose, { Schema, Model } from 'mongoose';
import { USER_ROLES, SUBSCRIPTION_TIERS } from '@/lib/constants';

/** Scanned data from ID document (OCR or user consent). */
export interface IIdScannedData {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
}

export interface IUser {
  _id: mongoose.Types.ObjectId;
  email: string;
  name: string;
  /** Preferred for verification and display. */
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: Date;
  /** Full address / location. */
  address?: string;
  image?: string;
  password?: string;
  role: (typeof USER_ROLES)[keyof typeof USER_ROLES];
  subscriptionTier?: (typeof SUBSCRIPTION_TIERS)[keyof typeof SUBSCRIPTION_TIERS];
  phone?: string;
  /** Set when user verified their email (credentials signup or after verify-email link). */
  verifiedAt?: Date;
  /** Set when phone (WhatsApp/SMS) OTP or link verified. */
  phoneVerifiedAt?: Date;
  /** ID document front image URL (upload only, no link). */
  idFrontUrl?: string;
  /** ID document back image URL (upload only, no link). */
  idBackUrl?: string;
  /** Type of ID: Driver's License, National ID, Voters Card, International passport. */
  idType?: 'drivers_license' | 'national_id' | 'voters_card' | 'international_passport';
  /** Scanned ID data when OCR did not match; user consented to save. */
  idScannedData?: IIdScannedData;
  /** Set when ID step done (OCR match or consent) and optionally admin-approved. */
  identityVerifiedAt?: Date;
  /** Liveness "centre your head" capture URL for admin review. */
  livenessCentreImageUrl?: string;
  /** Set when agent/developer professional doc approved. */
  professionalVerifiedAt?: Date;
  /** Set when liveness challenge passed; profile picture from liveness until Agent/Developer. */
  livenessVerifiedAt?: Date;
  /** Last time the account `image` (display photo) was set by the user or liveness; used for 3-month change limit. */
  profileImageChangedAt?: Date;
  /** True until role is registered_agent or registered_developer; then user can change profile picture. */
  profilePictureLocked?: boolean;
  /** Position in company (Agent/Developer only), e.g. "Agent", "Director". */
  companyPosition?: string;
  /** One-time token for email verification link; cleared after verify. */
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  /** One-time token for phone verification link; cleared after verify. */
  phoneVerificationToken?: string;
  phoneVerificationExpires?: Date;
  /** Hashed OTP for phone verification (alternative to link). */
  phoneVerificationCode?: string;
  /** When 'twilio', confirm-phone uses Twilio Verify; when 'termii', uses Termii Verify Token. */
  phoneVerificationProvider?: 'twilio' | 'termii';
  /** Termii pin_id from send-token; used in confirm-phone when provider is termii. */
  phoneVerificationPinId?: string;
  /** When last OTP was sent; used to enforce cooldown and prevent multiple pins. */
  phoneOtpLastSentAt?: Date;
  /** One-time token for password reset link; cleared after reset. */
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  /** Set when user accepted the Terms of Service (required at signup / first use). */
  termsAcceptedAt?: Date;
  /** Set when user accepted the Privacy Policy (required at signup / first use). */
  privacyAcceptedAt?: Date;
  fcmTokens: string[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    firstName: String,
    middleName: String,
    lastName: String,
    dateOfBirth: Date,
    address: String,
    image: String,
    password: String,
    role: { type: String, enum: Object.values(USER_ROLES), default: USER_ROLES.GUEST },
    subscriptionTier: { type: String, enum: Object.values(SUBSCRIPTION_TIERS) },
    phone: String,
    verifiedAt: Date,
    phoneVerifiedAt: Date,
    idFrontUrl: String,
    idBackUrl: String,
    idType: String,
    idScannedData: {
      firstName: String,
      middleName: String,
      lastName: String,
      dateOfBirth: String,
    },
    identityVerifiedAt: Date,
    livenessCentreImageUrl: String,
    professionalVerifiedAt: Date,
    livenessVerifiedAt: Date,
    profileImageChangedAt: Date,
    profilePictureLocked: { type: Boolean, default: false },
    companyPosition: String,
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    phoneVerificationToken: String,
    phoneVerificationExpires: Date,
    phoneVerificationCode: String,
    phoneVerificationProvider: String,
    phoneVerificationPinId: String,
    phoneOtpLastSentAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    termsAcceptedAt: Date,
    privacyAcceptedAt: Date,
    fcmTokens: [{ type: String }],
  },
  { timestamps: true }
);

const User: Model<IUser> = mongoose.models.User ?? mongoose.model<IUser>('User', UserSchema);
export default User;
