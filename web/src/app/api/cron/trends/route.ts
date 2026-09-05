import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { generateDailyTrends } from '@/lib/trends/generator';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function envStatus() {
  return {
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    cronSecretConfigured: Boolean((process.env.CRON_SECRET || process.env.TRENDS_CRON_SECRET)?.trim()),
  };
}

function authorized(req: Request): boolean {
  if (req.headers.get('x-vercel-cron') === '1') return true;
  const secret = process.env.CRON_SECRET || process.env.TRENDS_CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return token === secret;
}

async function run(req: Request) {
  if (new URL(req.url).searchParams.get('status') === '1') {
    return NextResponse.json(envStatus());
  }
  if (!authorized(req)) {
    const status = envStatus();
    return NextResponse.json(
      {
        error: status.cronSecretConfigured ? 'Unauthorized' : 'CRON_SECRET is not configured',
        ...status,
      },
      { status: status.cronSecretConfigured ? 401 : 503 }
    );
  }
  if (!process.env.MONGODB_URI?.trim()) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 500 });
  }
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const force = searchParams.get('force') === '1';
  const result = await generateDailyTrends({ force });
  return NextResponse.json(result);
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
