'use client';

import { useState } from 'react';
import { LISTING_TYPE } from '@/lib/constants';
import type { PublicCreatedBy } from '@/lib/verification';
import { isBotListingAuthor } from '@/lib/claimable-listing';
import { ListingAuthorPanel } from '@/components/listings/ListingAuthorPanel';
import { ListingDetailClient } from '@/components/listings/ListingDetailClient';
import { ProfessionalOffersPanel } from '@/components/listings/ProfessionalOffersPanel';

type SidebarTab = 'contact' | 'author' | 'offers';

const TAB_META: Record<SidebarTab, { label: string; icon: React.ReactNode }> = {
  contact: {
    label: 'Contact',
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
  },
  author: {
    label: 'Author',
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  offers: {
    label: 'Offers',
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
};

export function ListingSidebarTabs({
  listingId,
  listingType,
  listingTitle,
  propertyType,
  listingDescription,
  locationDisplay,
  title,
  createdBy,
  createdByType,
  listingTags,
  isBotListing,
  baseUrl,
  isOwner,
  viewCount,
  likeCount,
}: {
  listingId: string;
  listingType: string;
  listingTitle: string;
  propertyType: string;
  listingDescription: string;
  locationDisplay: string;
  title: string;
  createdBy: PublicCreatedBy | null;
  createdByType: string;
  listingTags?: string[];
  /** Bot-ingested or BOT-user listings: hide Author / Listed-by tab. */
  isBotListing?: boolean;
  baseUrl: string;
  isOwner: boolean;
  viewCount: number;
  likeCount: number;
}) {
  const showOffersTab = listingType === LISTING_TYPE.SALE;
  const hideAuthorTab =
    isBotListing ??
    isBotListingAuthor({ createdByType, createdBy, tags: listingTags });
  const tabs: SidebarTab[] = hideAuthorTab
    ? showOffersTab
      ? ['contact', 'offers']
      : ['contact']
    : showOffersTab
      ? ['contact', 'author', 'offers']
      : ['contact', 'author'];
  const showTabBar = tabs.length > 1;
  const [activeTab, setActiveTab] = useState<SidebarTab>('contact');

  const resolvedTab = tabs.includes(activeTab) ? activeTab : 'contact';

  return (
    <div className="mt-6 min-w-0">
      {showTabBar && (
        <div
          className="flex gap-1 rounded-xl bg-gray-100/90 p-1"
          role="tablist"
          aria-label="Listing actions"
        >
          {tabs.map((tab) => {
            const selected = resolvedTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`listing-sidebar-panel-${tab}`}
                id={`listing-sidebar-tab-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold transition sm:text-sm ${
                  selected
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
                }`}
              >
                {TAB_META[tab].icon}
                <span className="truncate">{TAB_META[tab].label}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className={`min-w-0 ${showTabBar ? 'mt-4' : ''}`}>
        <div
          id="listing-sidebar-panel-contact"
          role="tabpanel"
          aria-labelledby="listing-sidebar-tab-contact"
          hidden={showTabBar && resolvedTab !== 'contact'}
          className="min-w-0"
        >
          <div className="min-w-0 space-y-5">
            <ListingDetailClient
              embedded
              listingId={listingId}
              title={title}
              createdBy={createdBy}
              createdByType={createdByType}
              baseUrl={baseUrl}
              isOwner={isOwner}
              viewCount={viewCount}
              likeCount={likeCount}
            />
          </div>
        </div>

        {!hideAuthorTab && (
          <div
            id="listing-sidebar-panel-author"
            role="tabpanel"
            aria-labelledby="listing-sidebar-tab-author"
            hidden={showTabBar && resolvedTab !== 'author'}
            className="min-w-0"
          >
            <ListingAuthorPanel
              embedded
              authorId={createdBy?._id}
              createdBy={createdBy}
              createdByType={createdByType}
              currentListingId={listingId}
            />
          </div>
        )}

        {showOffersTab && (
          <div
            id="listing-sidebar-panel-offers"
            role="tabpanel"
            aria-labelledby="listing-sidebar-tab-offers"
            hidden={showTabBar && resolvedTab !== 'offers'}
            className="min-w-0"
          >
            <ProfessionalOffersPanel
              embedded
              listingId={listingId}
              listingType={listingType}
              isOwner={isOwner}
              listingTitle={listingTitle}
              propertyType={propertyType}
              listingDescription={listingDescription}
              locationDisplay={locationDisplay}
            />
          </div>
        )}
      </div>
    </div>
  );
}
