import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth-options';
import { USER_ROLES } from '@/lib/constants';
import { AdminNav } from '@/components/layout/AdminNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== USER_ROLES.ADMIN) {
    redirect('/auth/signin?callbackUrl=/admin');
  }

  return (
    <div className="mx-auto min-h-0 w-full max-w-7xl overflow-x-hidden px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-4 flex flex-col gap-3 border-b border-gray-200 pb-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-bold text-gray-900 sm:text-xl">Admin</h1>
        <Link
          href="/dashboard"
          className="flex min-h-11 shrink-0 items-center text-sm text-gray-600 hover:underline sm:min-h-[44px]"
        >
          Back to Dashboard
        </Link>
      </div>
      <AdminNav />
      <main className="min-w-0 pb-6">{children}</main>
    </div>
  );
}
