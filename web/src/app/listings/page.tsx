import type { Metadata } from 'next';
import { siteOrigin } from '@/lib/site-metadata';
import { ListingsPageClient } from './ListingsPageClient';

function hasListingIndexFilters(params: Record<string, string | string[] | undefined>): boolean {
  for (const [key, value] of Object.entries(params)) {
    if (key === 'page') continue;
    if (value == null) continue;
    if (Array.isArray(value)) {
      if (value.some((v) => String(v).trim() !== '')) return true;
    } else if (String(value).trim() !== '') {
      return true;
    }
  }
  return false;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const canonical = `${siteOrigin()}/listings`;
  if (!hasListingIndexFilters(params)) {
    return {
      alternates: { canonical },
      robots: { index: true, follow: true },
    };
  }
  return {
    alternates: { canonical },
    robots: { index: false, follow: true },
  };
}

export default function ListingsPage() {
  return <ListingsPageClient />;
}
