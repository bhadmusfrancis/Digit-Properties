import { withAuth } from 'next-auth/middleware';
import type { NextFetchEvent, NextRequest } from 'next/server';

const authHandler = withAuth({ pages: { signIn: '/auth/signin' } });

export function proxy(request: NextRequest, event?: NextFetchEvent) {
  return authHandler(request as Parameters<typeof authHandler>[0], event as Parameters<typeof authHandler>[1]);
}

export const config = {
  matcher: ['/dashboard/:path*', '/listings/new', '/admin/:path*'],
};
