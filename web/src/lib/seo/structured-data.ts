import { siteOrigin } from '@/lib/site-metadata';

const SCHEMA = 'https://schema.org';

function absoluteUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl;
  const origin = siteOrigin();
  return `${origin}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

export function buildOrganizationJsonLd() {
  const origin = siteOrigin();
  return {
    '@context': SCHEMA,
    '@type': 'Organization',
    name: 'Digit Properties',
    url: origin,
    logo: `${origin}/logo.svg`,
    description:
      'Nigerian real estate platform to buy, sell, and rent apartments, houses, land, and commercial property.',
    parentOrganization: {
      '@type': 'Organization',
      name: 'FABHA International',
    },
  };
}

export function buildWebSiteJsonLd() {
  const origin = siteOrigin();
  return {
    '@context': SCHEMA,
    '@type': 'WebSite',
    name: 'Digit Properties',
    url: origin,
    inLanguage: 'en-NG',
    publisher: { '@type': 'Organization', name: 'Digit Properties', url: origin },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${origin}/listings?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildBreadcrumbJsonLd(items: { name: string; path: string }[]) {
  const origin = siteOrigin();
  return {
    '@context': SCHEMA,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export type ListingStructuredDataInput = {
  id: string;
  title: string;
  description: string;
  price: number;
  listingType: string;
  propertyType: string;
  imageUrls: string[];
  bedrooms?: number;
  bathrooms?: number;
  location?: {
    address?: string;
    city?: string;
    state?: string;
    suburb?: string;
  };
  datePosted?: string;
  dateModified?: string;
};

export function buildListingJsonLd(input: ListingStructuredDataInput) {
  const url = absoluteUrl(`/listings/${input.id}`);
  const streetAddress = [input.location?.address, input.location?.suburb].filter(Boolean).join(', ') || undefined;

  return {
    '@context': SCHEMA,
    '@type': 'RealEstateListing',
    name: input.title,
    description: input.description.slice(0, 5000),
    url,
    image: input.imageUrls.map(absoluteUrl).filter(Boolean),
    datePosted: input.datePosted,
    dateModified: input.dateModified,
    numberOfBedrooms: input.bedrooms,
    numberOfBathroomsTotal: input.bathrooms,
    offers: {
      '@type': 'Offer',
      price: input.price,
      priceCurrency: 'NGN',
      availability: 'https://schema.org/InStock',
      url,
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress,
      addressLocality: input.location?.city,
      addressRegion: input.location?.state,
      addressCountry: 'NG',
    },
  };
}

export type ArticleStructuredDataInput = {
  title: string;
  description: string;
  slug: string;
  imageUrl?: string;
  publishedAt?: string;
  modifiedAt?: string;
  authorName?: string;
};

export function buildArticleJsonLd(input: ArticleStructuredDataInput) {
  const url = absoluteUrl(`/trends/${input.slug}`);
  return {
    '@context': SCHEMA,
    '@type': 'Article',
    headline: input.title,
    description: input.description.slice(0, 5000),
    url,
    mainEntityOfPage: url,
    image: input.imageUrl ? absoluteUrl(input.imageUrl) : undefined,
    datePublished: input.publishedAt,
    dateModified: input.modifiedAt ?? input.publishedAt,
    author: input.authorName
      ? { '@type': 'Person', name: input.authorName }
      : { '@type': 'Organization', name: 'Digit Properties' },
    publisher: {
      '@type': 'Organization',
      name: 'Digit Properties',
      logo: { '@type': 'ImageObject', url: absoluteUrl('/logo.svg') },
    },
  };
}
