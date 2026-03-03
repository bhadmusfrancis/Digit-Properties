import mongoose, { Schema, Model } from 'mongoose';

export const VERIFICATION_REQUEST_TYPES = [
  'verified_individual',
  'registered_agent',
  'registered_developer',
] as const;

export const VERIFICATION_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type VerificationRequestType = (typeof VERIFICATION_REQUEST_TYPES)[number];
export type VerificationRequestStatus =
  (typeof VERIFICATION_REQUEST_STATUS)[keyof typeof VERIFICATION_REQUEST_STATUS];

export interface IVerificationRequest {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: VerificationRequestType;
  status: VerificationRequestStatus;
  documentUrls: string[];
  companyPosition?: string;
  message?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  /** Audit: how document was verified (manual, automated, third_party). */
  documentVerificationMethod?: 'manual' | 'automated' | 'third_party';
  createdAt: Date;
  updatedAt: Date;
}

const VerificationRequestSchema = new Schema<IVerificationRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: VERIFICATION_REQUEST_TYPES,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(VERIFICATION_REQUEST_STATUS),
      default: VERIFICATION_REQUEST_STATUS.PENDING,
    },
    documentUrls: [{ type: String }],
    companyPosition: String,
    message: String,
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    rejectionReason: String,
    documentVerificationMethod: String,
  },
  { timestamps: true }
);

VerificationRequestSchema.index({ userId: 1, type: 1 });
VerificationRequestSchema.index({ status: 1 });

const VerificationRequest: Model<IVerificationRequest> =
  mongoose.models.VerificationRequest ??
  mongoose.model<IVerificationRequest>('VerificationRequest', VerificationRequestSchema);

export default VerificationRequest;
