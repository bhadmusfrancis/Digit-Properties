import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { siteOrigin } from '@/lib/site-metadata';
import { JsonLd } from '@/components/seo/JsonLd';
import { buildBreadcrumbJsonLd, buildCollectionPageJsonLd } from '@/lib/seo/structured-data';
import { ListingsPageClient } from '@/app/listings/ListingsPageClient';
import {
  buildLocationLandingMetadata,
  buildLocationLandingPath,
  locationLandingPresetFilters,
  parseLocationLandingRest,
  relatedLocationLinks,
  resolveCityFromSlug,
  resolveStateFromSlug,
} from '@/lib/location-seo';

type PageProps = {
  params: Promise<{ stateSlug: string; rest?: string[] }>;
};

function resolveLanding(stateSlug: string, rest?: string[]) {
  const state = resolveStateFromSlug(stateSlug);
  if (!state) return null;

  const parsed = parseLocationLandingRest(rest);
  if (parsed === null) return null;

  let city: string | undefined;
  if (parsed.city) {
    const resolvedCity = resolveCityFromSlug(state, parsed.city);
    if (!resolvedCity) return null;
    city = resolvedCity;
  }

  const landing = { state, city, listingType: parsed.listingType };
  const path = buildLocationLandingPath(state, { city, listingType: parsed.listingType });
  const meta = buildLocationLandingMetadata(landing);
  return { landing, path, meta };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { stateSlug, rest } = await params;
  const resolved = resolveLanding(stateSlug, rest);
  if (!resolved) return {};

  const { path, meta } = resolved;
  const canonical = `${siteOrigin()}${path}`;

  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${meta.title} | Digit Properties`,
      description: meta.description,
      url: canonical,
      siteName: 'Digit Properties',
      locale: 'en_NG',
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
    },
  };
}

export default async function LocationLandingPage({ params }: PageProps) {
  const { stateSlug, rest } = await params;
  const resolved = resolveLanding(stateSlug, rest);
  if (!resolved) notFound();

  const { landing, path, meta } = resolved;
  const presetFilters = locationLandingPresetFilters(landing);
  const related = relatedLocationLinks(landing.state, {
    city: landing.city,
    listingType: landing.listingType,
  });

  return (
    <>
      <JsonLd
        data={[
          buildBreadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Listings', path: '/listings' },
            ...(landing.city
              ? [
                  { name: landing.state, path: buildLocationLandingPath(landing.state) },
                  { name: landing.city, path },
                ]
              : [{ name: meta.place, path }]),
          ]),
          buildCollectionPageJsonLd({
            name: meta.title,
            description: meta.description,
            path,
          }),
        ]}
      />
      <ListingsPageClient
        presetFilters={presetFilters}
        pageTitle={meta.title}
        pageDescription={meta.description}
        relatedLinks={related}
      />
    </>
  );
}
