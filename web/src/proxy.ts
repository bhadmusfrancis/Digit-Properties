import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextRequest } from 'next/server';

const authHandler = withAuth({ pages: { signIn: '/auth/signin' } });

function listingIndexHasFilters(url: URL): boolean {
  for (const [key, value] of url.searchParams.entries()) {
    if (key === 'page') continue;
    if (value.trim() !== '') return true;
  }
  return false;
}

export function proxy(request: NextRequest, event?: NextFetchEvent) {
  if (request.nextUrl.pathname === '/listings') {
    const res = NextResponse.next();
    if (listingIndexHasFilters(request.nextUrl)) {
      res.headers.set('X-Robots-Tag', 'noindex, follow');
    }
    return res;
  }

  return authHandler(request as Parameters<typeof authHandler>[0], event as Parameters<typeof authHandler>[1]);
}

export const config = {
  matcher: ['/dashboard/:path*', '/listings/new', '/admin/:path*', '/listings'],
};
