import Link from 'next/link';
import { ListingPackages } from '@/components/listings/ListingPackages';

export const metadata = {
  title: 'Listing Boost Packages | Digit Properties',
  description: 'Starter, Pro, and Premium boost packages for more media, categories, and visibility on your listings.',
};

export default function SubscriptionPlansPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="mb-6">
        <Link href="/dashboard/payments" className="text-sm text-gray-600 hover:text-gray-900 underline">
          ← Payments
        </Link>
      </p>
      <ListingPackages />
    </div>
  );
}
