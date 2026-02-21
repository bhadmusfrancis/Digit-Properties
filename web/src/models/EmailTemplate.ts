import mongoose, { Schema, Model } from 'mongoose';

export interface IEmailTemplate {
  key: string;
  subject: string;
  body: string;
  updatedAt: Date;
}

const EmailTemplateSchema = new Schema<IEmailTemplate>(
  {
    key: { type: String, required: true, unique: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
  },
  { timestamps: true }
);

const EmailTemplate: Model<IEmailTemplate> =
  mongoose.models.EmailTemplate ?? mongoose.model<IEmailTemplate>('EmailTemplate', EmailTemplateSchema);
export default EmailTemplate;
