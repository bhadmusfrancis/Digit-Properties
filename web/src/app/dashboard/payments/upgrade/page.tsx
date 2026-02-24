'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

type PackageDisplay = {
  tier: string;
  label: string;
  priceMonthly: number;
};

function formatPrice(n: number): string {
  if (n === 0) return 'Free';
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export default function UpgradePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const tierParam = searchParams.get('tier');
  const success = searchParams.get('success') === 'true';

  const [pkg, setPkg] = useState<PackageDisplay | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<'paystack' | 'test' | null>(null);
  const [error, setError] = useState('');

  const tier = tierParam === 'gold' || tierParam === 'premium' ? tierParam : null;
  const isAdmin = session?.user?.role === 'admin';

  useEffect(() => {
    if (!tier) {
      setLoading(false);
      return;
    }
    fetch('/api/packages')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const found = data.find((p: PackageDisplay & { tier: string }) => p.tier === tier);
          if (found) setPkg({ tier: found.tier, label: found.label, priceMonthly: found.priceMonthly });
          else setPkg({ tier, label: tier.charAt(0).toUpperCase() + tier.slice(1), priceMonthly: tier === 'gold' ? 10000 : 30000 });
        } else {
          setPkg({ tier, label: tier.charAt(0).toUpperCase() + tier.slice(1), priceMonthly: tier === 'gold' ? 10000 : 30000 });
        }
      })
      .catch(() => setPkg({ tier, label: tier.charAt(0).toUpperCase() + tier.slice(1), priceMonthly: tier === 'gold' ? 10000 : 30000 }))
      .finally(() => setLoading(false));
  }, [tier]);

  const startPayment = async (gateway: 'paystack' | 'test') => {
    if (!tier) return;
    setError('');
    setPaying(gateway);
    try {
      const res = await fetch('/api/payments/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, gateway }),
      });
      let data: { error?: string; test?: boolean; authorization_url?: string } = {};
      try {
        data = await res.json();
      } catch {
        setError(res.statusText || 'Request failed');
        setPaying(null);
        return;
      }
      if (!res.ok) {
        setError(data.error || res.statusText || 'Something went wrong');
        setPaying(null);
        return;
      }
      if (data.test) {
        router.push('/dashboard?upgraded=true');
        return;
      }
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
        return;
      }
      setError('No payment link received');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    }
    setPaying(null);
  };

  if (success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6">
        <h2 className="text-lg font-semibold text-green-800">Payment successful</h2>
        <p className="mt-2 text-green-700">Your subscription has been updated. You can now use your new plan benefits.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-green-800 underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (status === 'loading' || !session) {
    return (
      <div>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!tier || (!loading && !pkg)) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upgrade your plan</h1>
        <p className="mt-2 text-gray-600">Choose a plan to upgrade:</p>
        <div className="mt-6 flex gap-4">
          <Link
            href="/dashboard/payments/upgrade?tier=gold"
            className="rounded-xl border-2 border-amber-400 bg-white px-6 py-4 text-center font-semibold text-gray-900 hover:bg-amber-50"
          >
            Gold — NGN 10,000/month
          </Link>
          <Link
            href="/dashboard/payments/upgrade?tier=premium"
            className="rounded-xl border-2 border-sky-500 bg-white px-6 py-4 text-center font-semibold text-gray-900 hover:bg-sky-50"
          >
            Premium — NGN 30,000/month
          </Link>
        </div>
        <p className="mt-6">
          <Link href="/dashboard/payments" className="text-sm text-gray-600 underline">← Payment history</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Upgrade to {pkg?.label ?? tier}</h1>
      <p className="mt-1 text-gray-600">
        {pkg?.priceMonthly ? formatPrice(pkg.priceMonthly) + ' per month' : 'Monthly subscription'}
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="font-medium text-red-800">Payment could not be started</p>
          <p className="mt-1 text-sm text-red-700">{error}</p>
          <p className="mt-2 text-xs text-red-600">
            {error.toLowerCase().includes('paystack') || error.toLowerCase().includes('not configured')
              ? 'Set PAYSTACK_SECRET_KEY in .env.local and restart the dev server (npm run dev).'
              : error.includes('ECONNREFUSED') || error.toLowerCase().includes('mongodb')
                ? 'Database connection failed. Check MONGODB_URI and network.'
                : 'Check the message above and try again.'}
          </p>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-4">
        <button
          type="button"
          onClick={() => startPayment('paystack')}
          disabled={!!paying}
          className="rounded-xl bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {paying === 'paystack' ? 'Redirecting…' : 'Pay with Paystack'}
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => startPayment('test')}
            disabled={!!paying}
            className="rounded-xl border-2 border-dashed border-gray-400 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {paying === 'test' ? 'Applying…' : 'Test upgrade (no charge)'}
          </button>
        )}
      </div>

      <p className="mt-8">
        <Link href="/dashboard/payments" className="text-sm text-gray-600 underline">← Payment history</Link>
      </p>
    </div>
  );
}
