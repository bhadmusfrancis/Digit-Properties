'use client';

import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { PageViewTracker } from '@/components/analytics/PageViewTracker';
import { SystemToastProvider } from '@/components/ui/SystemToast';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        <SystemToastProvider>{children}</SystemToastProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
