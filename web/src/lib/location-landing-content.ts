import { LISTING_TYPE } from '@/lib/constants';
import type { LocationLandingParams } from '@/lib/location-seo';

type StateProfile = {
  region: string;
  overview: string;
  marketCharacter: string;
  documentation: string;
};

type CityProfile = {
  character: string;
  propertyMix: string;
  connectivity: string;
};

const STATE_PROFILES: Record<string, StateProfile> = {
  Lagos: {
    region: 'South-West Nigeria',
    overview:
      'Lagos is Nigeria\'s commercial capital and the country\'s most active real estate market. Demand spans luxury apartments on the Island, mid-market terraces on the Mainland, and fast-growing corridors in Ibeju-Lekki, Sangotedo, and Epe where new estates and mixed-use developments continue to launch.',
    marketCharacter:
      'Buyers and tenants typically weigh commute time, estate infrastructure, title clarity, and proximity to business districts. Rental yields remain attractive in established areas such as Yaba, Surulere, and Gbagada, while land and off-plan sales dominate the Lekki–Ajah axis.',
    documentation:
      'Transactions in Lagos often involve Governor\'s Consent, deed of assignment, and survey plans. Digit Properties helps buyers verify documentation before committing and connects you with listings across Lagos State markets.',
  },
  FCT: {
    region: 'North-Central Nigeria',
    overview:
      'The Federal Capital Territory (Abuja) is Nigeria\'s administrative centre and one of its most planned property markets. Districts such as Maitama, Asokoro, and Wuse attract premium buyers, while Gwarinpa, Kubwa, Lugbe, and Gwagwalada serve growing middle-income demand.',
    marketCharacter:
      'Abuja property values are influenced by district classification, road access, and power supply reliability. Renters include civil servants, diplomats, and corporate staff; investors focus on detached houses, semi-detached units, and serviced apartments.',
    documentation:
      'FCT titles typically reference Certificate of Occupancy issued by the Abuja Geographic Information Systems (AGIS). Always confirm plot numbers, land use, and outstanding ground rent before purchase.',
  },
  Rivers: {
    region: 'South-South Nigeria',
    overview:
      'Rivers State, centred on Port Harcourt, is driven by oil and gas activity, port logistics, and a growing services sector. Property demand concentrates in Port Harcourt city, Trans Amadi, GRA, Woji, and newer corridors toward Obio-Akpor.',
    marketCharacter:
      'The market mixes high-end GRA properties with more affordable options in Diobu, Rumuola, and Choba. Rental demand from expatriates and corporate tenants supports serviced apartment investments near major industrial zones.',
    documentation:
      'Buyers should verify titles with the Rivers State Ministry of Lands and confirm that survey plans align with physical boundaries, especially in areas with ongoing urban expansion.',
  },
  Ogun: {
    region: 'South-West Nigeria',
    overview:
      'Ogun State benefits from proximity to Lagos, with strong activity in Abeokuta, Mowe, Ibafo, Sagamu, and Ota. Many buyers choose Ogun for more affordable land and housing while working in Lagos.',
    marketCharacter:
      'Estate developments along the Lagos–Ibadan expressway corridor dominate new supply. Land banking, terrace housing, and commercial plots near industrial zones are common investment themes.',
    documentation:
      'Confirm whether land falls under customary, family, or government allocation and ensure proper survey and deed registration through Ogun State land authorities.',
  },
  Oyo: {
    region: 'South-West Nigeria',
    overview:
      'Oyo State is anchored by Ibadan — one of Africa\'s largest cities by land area — with additional markets in Ogbomosho, Oyo town, and growing suburban districts such as Bodija, Oluyole, and Akobo.',
    marketCharacter:
      'Ibadan offers relatively accessible entry prices compared to Lagos, with demand for detached houses, flats, and student-friendly rentals near universities and commercial hubs.',
    documentation:
      'Verify C of O or registered deeds with the Oyo State Ministry of Lands and check for encumbrances on older family land before payment.',
  },
  Delta: {
    region: 'South-South Nigeria',
    overview:
      'Delta State combines oil-sector wealth with agricultural and trade activity. Warri, Asaba, Ughelli, and Sapele are primary property markets, with Warri serving as the industrial and commercial hub.',
    marketCharacter:
      'Warri and Effurun attract mixed residential and commercial demand; Asaba benefits from proximity to Onitsha trade routes. Investors watch road upgrades and estate infrastructure when selecting locations.',
    documentation:
      'Title verification through Delta State land registry and confirmation of community consent on certain plots is essential before completing transactions.',
  },
  Kano: {
    region: 'North-West Nigeria',
    overview:
      'Kano is the commercial heart of northern Nigeria, with centuries of trading history and a large urban population. Property activity spans Nassarawa GRA, Bompai, Giginyu, and expanding suburban districts.',
    marketCharacter:
      'The market includes traditional compound houses, modern estates, and commercial shop spaces near major markets. Rental demand is steady from traders, manufacturers, and service businesses.',
    documentation:
      'Work with registered surveyors and confirm Kano State land titles, especially for properties near historic districts where ownership records may be complex.',
  },
  Kaduna: {
    region: 'North-West Nigeria',
    overview:
      'Kaduna combines manufacturing, military, and administrative functions. Barnawa, Malali, Rigasa, and Kaduna GRA remain sought-after addresses for professionals and expatriates.',
    marketCharacter:
      'Detached houses and semi-detached units dominate family purchases; investors also target flats near Kaduna\'s universities and industrial areas.',
    documentation:
      'Confirm Kaduna State Certificate of Occupancy or registered conveyance and inspect properties in person given varying security conditions across districts.',
  },
  Enugu: {
    region: 'South-East Nigeria',
    overview:
      'Enugu State\'s capital city is a coal-region heritage centre now focused on services, education, and commerce. Independence Layout, GRA, Trans Ekulu, and New Haven are established residential districts.',
    marketCharacter:
      'Enugu offers moderate price points with demand from public-sector workers, academics, and diaspora buyers building retirement homes.',
    documentation:
      'Verify Enugu State land documents and ensure sellers provide clear chain of title, particularly for plots on the city\'s expanding outskirts.',
  },
  Anambra: {
    region: 'South-East Nigeria',
    overview:
      'Anambra is one of Nigeria\'s most entrepreneurial states. Awka (the capital), Onitsha, and Nnewi drive property demand tied to trade, manufacturing, and logistics.',
    marketCharacter:
      'Onitsha commercial property and Awka residential estates see consistent activity. Nnewi industrial growth supports warehouse and residential demand nearby.',
    documentation:
      'Buyers should confirm Anambra State titles and, for Onitsha riverfront or market-adjacent plots, check planning restrictions with local authorities.',
  },
};

const CITY_PROFILES: Record<string, Record<string, CityProfile>> = {
  Lagos: {
    Lekki: {
      character: 'Lekki stretches from Victoria Island extensions through Ikate, Chevron, and Ajah toward Epe, mixing luxury towers, gated estates, and new land releases.',
      propertyMix: 'Expect apartments, duplexes, terrace houses, and bare land in approved schemes. Short-let and long-term rental demand is strong near Lekki Phase 1 and Jakande.',
      connectivity: 'The Lekki–Epe Expressway and ongoing road projects shape commute times; buyers should factor toll routes and peak-hour traffic into location choice.',
    },
    Ikeja: {
      character: 'Ikeja is Lagos Mainland\'s commercial core, home to the airport, computer village, and major corporate offices.',
      propertyMix: 'Flats, detached houses, and commercial units near Allen Avenue, Opebi, and Maryland attract professionals seeking central access.',
      connectivity: 'Strong bus and ride-hailing links to the Island and mainland districts; proximity to Murtala Muhammed Airport supports short-let investments.',
    },
    Yaba: {
      character: 'Yaba is a tech and education hub with University of Lagos and Yaba College of Technology nearby.',
      propertyMix: 'Older flats and renovated units serve students and young professionals; commercial space along Herbert Macaulay Way remains active.',
      connectivity: 'Mainland bridge access and BRT corridors make Yaba a practical choice for commuters to Victoria Island and Lekki.',
    },
    Surulere: {
      character: 'Surulere blends established residential neighbourhoods with sports and entertainment landmarks including the National Stadium.',
      propertyMix: 'Terraces, flats, and detached houses at mid-market prices; popular with families seeking mainland stability.',
      connectivity: 'Well connected to Lagos Island via Third Mainland Bridge routes and mainland arterial roads.',
    },
    Ikoyi: {
      character: 'Ikoyi is among Lagos\'s most exclusive addresses, known for diplomatic missions, waterfront views, and premium estates.',
      propertyMix: 'Luxury apartments, detached mansions, and scarce land parcels command top-tier pricing.',
      connectivity: 'Direct access to Victoria Island and Falomo bridge links; security and estate management are key buyer considerations.',
    },
    Agege: {
      character: 'Agege is a dense mainland district with strong local commerce and improving road links.',
      propertyMix: 'Affordable flats and land parcels attract first-time buyers and developers building multi-unit blocks.',
      connectivity: 'Agege motor road and rail connections support access to Ikeja and broader mainland markets.',
    },
  },
  FCT: {
    Gwarinpa: {
      character: 'Gwarinpa is one of Abuja\'s largest residential districts with a mix of flats, duplexes, and detached houses.',
      propertyMix: 'Popular with middle-income families and civil servants; estate streets vary in infrastructure quality.',
      connectivity: 'Links to Kubwa expressway and central Abuja districts; verify estate road maintenance before purchase.',
    },
    Gwagwalada: {
      character: 'Gwagwalada hosts University of Abuja and growing suburban development at lower price points than central districts.',
      propertyMix: 'Land, unfinished houses, and student-oriented rentals dominate; investors target rental near the university.',
      connectivity: 'Abuja–Lokoja road access; commute to central Abuja should be tested at peak hours.',
    },
    Kubwa: {
      character: 'Kubwa is a large satellite town with diverse housing from estate developments to individual builds.',
      propertyMix: 'Terraces, detached houses, and commercial shop fronts along major roads.',
      connectivity: 'Abuja–Kaduna highway access; ongoing infrastructure upgrades influence values.',
    },
  },
  Rivers: {
    'Port Harcourt': {
      character: 'Port Harcourt is the Niger Delta\'s primary urban centre with GRA, Old GRA, and Trans Amadi as key sub-markets.',
      propertyMix: 'From executive duplexes in GRA to flats in Rumuola and Woji; commercial yards near industrial zones.',
      connectivity: 'Airport and port proximity drive logistics-adjacent property demand.',
    },
  },
  Oyo: {
    Ibadan: {
      character: 'Ibadan spans vast terrain from Bodija and Jericho to Challenge, Ring Road, and Akobo corridors.',
      propertyMix: 'Detached houses, flats, and land at prices typically below Lagos equivalents.',
      connectivity: 'Lagos–Ibadan expressway links support inter-city commuters; local traffic varies by district.',
    },
  },
};

const INTENT_INTRO: Record<string, string> = {
  [LISTING_TYPE.SALE]:
    'Properties listed for sale in this area include apartments, detached houses, duplexes, terraces, commercial units, and bare land. Compare asking prices against recent sales in the same neighbourhood, inspect title documents, and confirm physical boundaries before making an offer.',
  [LISTING_TYPE.RENT]:
    'Rental listings here cover short-let apartments, annual leases, and monthly arrangements. Clarify service charge, agency fees, and who handles repairs before signing. Popular with professionals, families, and corporate tenants seeking flexible lease terms.',
  [LISTING_TYPE.JOINT_VENTURE]:
    'Joint venture opportunities pair landowners with developers to build residential or commercial projects. Review profit-sharing terms, timeline, licensing, and exit clauses with qualified legal counsel before committing.',
};

const DEFAULT_STATE_PROFILE = (state: string): StateProfile => ({
  region: 'Nigeria',
  overview: `${state} offers diverse property opportunities across its urban centres and growing towns. Local markets reflect regional commerce, agriculture, and services activity, with demand for residential, commercial, and land investments.`,
  marketCharacter: `Buyers in ${state} should compare prices across districts, inspect properties in person, and confirm seller identity. Rental and sales activity varies by city; use filters below to narrow results by price, bedrooms, and property type.`,
  documentation: `Always verify land titles, survey plans, and any applicable Certificate of Occupancy with ${state} land authorities or qualified legal advisers before completing a transaction on Digit Properties.`,
});

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function pickVariant<T>(key: string, variants: T[]): T {
  return variants[hashString(key) % variants.length]!;
}

function listingIntentLabel(listingType?: string): string {
  if (listingType === LISTING_TYPE.SALE) return 'for sale';
  if (listingType === LISTING_TYPE.RENT) return 'for rent';
  if (listingType === LISTING_TYPE.JOINT_VENTURE) return 'for joint venture';
  return 'for sale and rent';
}

function placeDisplay(input: LocationLandingParams): string {
  const stateLabel = input.state === 'FCT' ? 'Abuja (FCT)' : input.state;
  if (input.placeName.trim().toLowerCase() === stateLabel.trim().toLowerCase()) return stateLabel;
  return `${input.placeName}, ${stateLabel}`;
}

export type LocationEditorialContent = {
  metaDescription: string;
  html: string;
  wordCount: number;
};

export function buildLocationLandingEditorialContent(
  input: LocationLandingParams & { state: string },
  listingCount?: number
): LocationEditorialContent {
  const stateKey = input.state === 'FCT' ? 'FCT' : input.state;
  const stateProfile = STATE_PROFILES[stateKey] ?? DEFAULT_STATE_PROFILE(input.state);
  const cityKey = input.city ?? input.suburb ?? '';
  const cityProfile =
    cityKey && CITY_PROFILES[stateKey]?.[cityKey]
      ? CITY_PROFILES[stateKey]![cityKey]
      : cityKey
        ? {
            character: `${cityKey} is an active neighbourhood within ${input.state === 'FCT' ? 'Abuja' : input.state}, with local demand for residential and commercial property driven by proximity to markets, schools, and transport routes.`,
            propertyMix: `Listings in ${cityKey} typically include flats, detached houses, and land parcels at price points reflecting local infrastructure and access roads.`,
            connectivity: `When evaluating property in ${cityKey}, visit at different times of day to assess traffic, security, and access to utilities.`,
          }
        : null;

  const place = placeDisplay(input);
  const intent = listingIntentLabel(input.listingType);
  const cacheKey = `${stateKey}|${input.city ?? ''}|${input.suburb ?? ''}|${input.listingType ?? 'all'}`;

  const countSentence =
    typeof listingCount === 'number' && listingCount > 0
      ? `Digit Properties currently lists <strong>${listingCount.toLocaleString()} active propert${listingCount === 1 ? 'y' : 'ies'}</strong> ${intent} in ${place}.`
      : `Browse property listings ${intent} in ${place} on Digit Properties — updated as new homes, land, and commercial spaces are added.`;

  const introVariants = [
    `Searching for property ${intent} in <strong>${place}</strong>? This guide covers what buyers and tenants should know about the local market before you explore listings below.`,
    `<strong>${place}</strong> is a key market on Digit Properties. Whether you are buying, renting, or exploring joint venture deals, start with local context then filter results to match your budget and property type.`,
    `Our ${place} property hub brings together listings ${intent} with practical market notes to help you compare options confidently on Digit Properties.`,
  ];

  const suburbParagraph =
    input.suburb && input.suburb !== input.city
      ? `<p><strong>${input.suburb}</strong> sits within the broader ${input.city ?? input.state} market. Area-specific factors — street access, flood history, estate security, and nearness to schools or markets — often matter more than state-wide averages when choosing a home here.</p>`
      : '';

  const intentParagraph = input.listingType
    ? `<p>${INTENT_INTRO[input.listingType] ?? INTENT_INTRO[LISTING_TYPE.SALE]}</p>`
    : `<p>${INTENT_INTRO[LISTING_TYPE.SALE]} ${INTENT_INTRO[LISTING_TYPE.RENT]}</p>`;

  const cityBlock = cityProfile
    ? `<h2 class="text-lg font-semibold text-gray-900 mt-6">About ${input.suburb ?? input.city ?? place}</h2>
<p>${cityProfile.character}</p>
<p>${cityProfile.propertyMix}</p>
<p>${cityProfile.connectivity}</p>`
    : '';

  const tips = pickVariant(cacheKey, [
    `<p>Schedule physical viewings where possible, confirm measurement of plot sizes, and ask listing owners about outstanding levies, service charges, or development contributions before payment.</p>`,
    `<p>Compare multiple listings in ${place} by price per bedroom, road access, and title status. Digit Properties connects you directly with sellers and agents listed on each property page.</p>`,
    `<p>For land purchases, engage a registered surveyor to confirm beacon positions. For buildings, inspect plumbing, roofing, and power supply during rainy and dry seasons if you can.</p>`,
  ]);

  const html = `<div class="location-editorial space-y-4 text-gray-700 leading-relaxed">
<p>${pickVariant(`${cacheKey}-intro`, introVariants)}</p>
<p>${countSentence}</p>
<h2 class="text-lg font-semibold text-gray-900 mt-6">${input.state === 'FCT' ? 'Abuja &amp; FCT' : input.state} market overview</h2>
<p>${stateProfile.overview}</p>
<p>${stateProfile.marketCharacter}</p>
${cityBlock}
${suburbParagraph}
<h2 class="text-lg font-semibold text-gray-900 mt-6">Buying and renting ${intent} in ${place}</h2>
${intentParagraph}
<h2 class="text-lg font-semibold text-gray-900 mt-6">Documentation and due diligence</h2>
<p>${stateProfile.documentation}</p>
${tips}
<p class="text-sm text-gray-500 mt-6">Digit Properties is operated by FABHA International with offices in Lagos, Ibadan, and Warri. Questions? Email <a href="mailto:contact@digitproperties.com" class="text-primary-600 hover:underline">contact@digitproperties.com</a>.</p>
</div>`;

  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = plain.split(' ').filter(Boolean).length;
  const metaDescription = `Properties ${intent} in ${place}: ${countSentence.replace(/<[^>]+>/g, '')} Market guide, documentation tips, and verified listings on Digit Properties.`.slice(0, 320);

  return { metaDescription, html, wordCount };
}
