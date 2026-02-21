import { dbConnect } from '@/lib/db';
import EmailTemplate from '@/models/EmailTemplate';

export async function getEmailTemplate(key: string): Promise<{ subject: string; body: string } | null> {
  try {
    await dbConnect();
    const t = await EmailTemplate.findOne({ key }).lean();
    return t ? { subject: t.subject, body: t.body } : null;
  } catch {
    return null;
  }
}

export async function setEmailTemplate(key: string, subject: string, body: string): Promise<void> {
  await dbConnect();
  await EmailTemplate.findOneAndUpdate(
    { key },
    { subject, body },
    { upsert: true, new: true }
  );
}
