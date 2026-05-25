import { redirect } from 'next/navigation';

/** Legacy route — Ad Credit lives under Payments. */
export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ topup?: string }>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  if (sp?.topup) params.set('topup', sp.topup);
  const q = params.toString();
  redirect(q ? `/dashboard/payments?${q}` : '/dashboard/payments');
}
