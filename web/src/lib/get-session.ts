import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { verifyToken } from '@/lib/auth-token';

/**
 * Get session for API routes: prefers Authorization Bearer (mobile app), else NextAuth cookie session.
 */
export async function getSession(request: Request): Promise<Session | null> {
  const authz = request.headers.get('authorization');
  const token = authz?.startsWith('Bearer ') ? authz.slice(7).trim() : null;
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      return {
        user: {
          id: payload.id,
          email: payload.email,
          name: payload.name,
          role: payload.role,
        } as Session['user'] & { role: string },
        expires: new Date((payload.exp ?? 0) * 1000).toISOString(),
      };
    }
  }
  return getServerSession(authOptions);
}
