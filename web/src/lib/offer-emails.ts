import {
  sendProfessionalOfferAcceptedEmail,
  sendProfessionalOfferCounterEmail,
  sendProfessionalOfferDeclinedEmail,
  sendProfessionalOfferNewEmail,
  sendProfessionalOfferWithdrawnEmail,
  sendSimpleOfferAcceptedEmail,
  sendSimpleOfferCounterEmail,
  sendSimpleOfferDeclinedEmail,
  sendSimpleOfferNewEmail,
  sendSimpleOfferWithdrawnEmail,
} from '@/lib/email';
import { LISTING_OFFER_KIND, type ListingOfferKind } from '@/models/ListingProfessionalOffer';

export function isProfessionalOfferKind(offerKind?: ListingOfferKind | string | null): boolean {
  return offerKind === LISTING_OFFER_KIND.PROFESSIONAL;
}

type OfferNewParams = Parameters<typeof sendSimpleOfferNewEmail>[0];
type OfferCounterParams = Parameters<typeof sendSimpleOfferCounterEmail>[0];
type OfferAcceptedParams = Parameters<typeof sendSimpleOfferAcceptedEmail>[0];
type OfferDeclinedParams = Parameters<typeof sendSimpleOfferDeclinedEmail>[0];
type OfferWithdrawnParams = Parameters<typeof sendSimpleOfferWithdrawnEmail>[0];

export function notifyOfferNew(offerKind: ListingOfferKind | undefined, params: OfferNewParams) {
  return isProfessionalOfferKind(offerKind)
    ? sendProfessionalOfferNewEmail(params)
    : sendSimpleOfferNewEmail(params);
}

export function notifyOfferCounter(offerKind: ListingOfferKind | undefined, params: OfferCounterParams) {
  return isProfessionalOfferKind(offerKind)
    ? sendProfessionalOfferCounterEmail(params)
    : sendSimpleOfferCounterEmail(params);
}

export function notifyOfferAccepted(offerKind: ListingOfferKind | undefined, params: OfferAcceptedParams) {
  return isProfessionalOfferKind(offerKind)
    ? sendProfessionalOfferAcceptedEmail(params)
    : sendSimpleOfferAcceptedEmail(params);
}

export function notifyOfferDeclined(offerKind: ListingOfferKind | undefined, params: OfferDeclinedParams) {
  return isProfessionalOfferKind(offerKind)
    ? sendProfessionalOfferDeclinedEmail(params)
    : sendSimpleOfferDeclinedEmail(params);
}

export function notifyOfferWithdrawn(offerKind: ListingOfferKind | undefined, params: OfferWithdrawnParams) {
  return isProfessionalOfferKind(offerKind)
    ? sendProfessionalOfferWithdrawnEmail(params)
    : sendSimpleOfferWithdrawnEmail(params);
}
