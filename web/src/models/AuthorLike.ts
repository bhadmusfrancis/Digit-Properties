import mongoose, { Schema, Model } from 'mongoose';

export interface IAuthorLike {
  userId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const AuthorLikeSchema = new Schema<IAuthorLike>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

AuthorLikeSchema.index({ authorId: 1, userId: 1 }, { unique: true });

const AuthorLike: Model<IAuthorLike> =
  mongoose.models.AuthorLike ?? mongoose.model<IAuthorLike>('AuthorLike', AuthorLikeSchema);
export default AuthorLike;
