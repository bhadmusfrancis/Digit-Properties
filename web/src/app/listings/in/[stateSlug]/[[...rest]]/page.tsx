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
  resolveStateFromSlug,
  type LocationLandingParams,
} from '@/lib/location-seo';
import { countActiveListingsForLanding, resolvePlaceForLanding } from '@/lib/location-seo-server';
import { buildLocationLandingEditorialContent } from '@/lib/location-landing-content';

type PageProps = {
  params: Promise<{ stateSlug: string; rest?: string[] }>;
};

async function resolveLanding(stateSlug: string, rest?: string[]) {
  const state = resolveStateFromSlug(stateSlug);
  if (!state) return null;

  const parsed = parseLocationLandingRest(rest);
  if (parsed === null) return null;

  let landing: LocationLandingParams = {
    state,
    placeName: state === 'FCT' ? 'Abuja (FCT)' : state,
    listingType: parsed.listingType,
  };

  if (parsed.city) {
    const place = await resolvePlaceForLanding(state, parsed.city);
    if (!place) return null;
    landing = {
      state,
      placeName: place.placeName,
      city: place.city,
      suburb: place.suburb,
      listingType: parsed.listingType,
    };
  }

  const path = buildLocationLandingPath(state, {
    city: landing.suburb ? undefined : landing.city,
    suburb: landing.suburb,
    listingType: landing.listingType,
  });
  const meta = buildLocationLandingMetadata(landing);
  return { landing, path, meta };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { stateSlug, rest } = await params;
  const resolved = await resolveLanding(stateSlug, rest);
  if (!resolved) return {};

  const { landing, path, meta } = resolved;
  const canonical = `${siteOrigin()}${path}`;

  // A landing page with no matching active listings is thin content; noindex it
  // so Google does not flag it as a soft 404. It stays crawlable (follow) and the
  // page still renders related links for users.
  const listingCount = await countActiveListingsForLanding({
    state: landing.state,
    city: landing.city,
    suburb: landing.suburb,
    listingType: landing.listingType,
  });

  const editorial = buildLocationLandingEditorialContent(landing, listingCount);

  return {
    title: meta.title,
    description: editorial.metaDescription,
    alternates: { canonical },
    robots: listingCount > 0 ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title: `${meta.title} | Digit Properties`,
      description: editorial.metaDescription,
      url: canonical,
      siteName: 'Digit Properties',
      locale: 'en_NG',
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: editorial.metaDescription,
    },
  };
}

export default async function LocationLandingPage({ params }: PageProps) {
  const { stateSlug, rest } = await params;
  const resolved = await resolveLanding(stateSlug, rest);
  if (!resolved) notFound();

  const { landing, path, meta } = resolved;
  const listingCount = await countActiveListingsForLanding({
    state: landing.state,
    city: landing.city,
    suburb: landing.suburb,
    listingType: landing.listingType,
  });
  const editorial = buildLocationLandingEditorialContent(landing, listingCount);
  const presetFilters = locationLandingPresetFilters(landing);
  const related = relatedLocationLinks(landing.state, {
    placeName: landing.placeName,
    city: landing.city,
    suburb: landing.suburb,
    listingType: landing.listingType,
  });

  const hasPlace = Boolean(landing.city || landing.suburb);

  return (
    <>
      <JsonLd
        data={[
          buildBreadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Listings', path: '/listings' },
            ...(hasPlace
              ? [
                  { name: landing.state, path: buildLocationLandingPath(landing.state) },
                  { name: landing.placeName, path },
                ]
              : [{ name: meta.place, path }]),
          ]),
          buildCollectionPageJsonLd({
            name: meta.title,
            description: editorial.metaDescription,
            path,
          }),
        ]}
      />
      <ListingsPageClient
        presetFilters={presetFilters}
        pageTitle={meta.title}
        pageDescription={editorial.metaDescription}
        editorialHtml={editorial.html}
        relatedLinks={related}
      />
    </>
  );
}
