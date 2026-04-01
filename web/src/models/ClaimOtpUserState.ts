import mongoose, { Schema, Model } from 'mongoose';

export interface IClaimOtpUserState {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  /** Last successful Termii send for claim flow */
  lastSendAt?: Date;
  /** UTC calendar day (YYYY-MM-DD) for daily send cap */
  sendsDayKey?: string;
  /** Sends recorded for sendsDayKey */
  sendsCount: number;
  /** Wrong / expired OTP attempts in a row; reset on success or after lockout expires */
  consecutiveVerifyFailures: number;
  /** After 5 failures: no send/verify until this passes */
  lockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ClaimOtpUserStateSchema = new Schema<IClaimOtpUserState>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    lastSendAt: Date,
    sendsDayKey: String,
    sendsCount: { type: Number, default: 0 },
    consecutiveVerifyFailures: { type: Number, default: 0 },
    lockedUntil: Date,
  },
  { timestamps: true }
);

const ClaimOtpUserState: Model<IClaimOtpUserState> =
  mongoose.models.ClaimOtpUserState ??
  mongoose.model<IClaimOtpUserState>('ClaimOtpUserState', ClaimOtpUserStateSchema);

export default ClaimOtpUserState;
