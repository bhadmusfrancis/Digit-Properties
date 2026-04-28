import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth-options';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/auth/signin?callbackUrl=/dashboard');
  const needsLegal = (session.user as { needsLegalAcceptance?: boolean }).needsLegalAcceptance;
  if (needsLegal) redirect('/auth/accept-terms?callbackUrl=/dashboard');

  return (
    <div className="mx-auto w-full max-w-7xl overflow-x-hidden px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-8">
        <DashboardSidebar />
        <main className="min-w-0 flex-1 pb-4">{children}</main>
      </div>
    </div>
  );
}
