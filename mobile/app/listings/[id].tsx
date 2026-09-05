import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Dimensions,
  Linking,
  Share,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getApiUrl } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { HeartButton } from '../../components/HeartButton';
import { colors, radius } from '../../lib/theme';
import {
  formatBedsBaths,
  formatLocation,
  formatPrice,
  listingTypeBadge,
  stripHtml,
  toTelHref,
  toWhatsAppUrl,
} from '../../lib/format';
import { formatPropertyTypeLabel } from '../../lib/constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMG_HEIGHT = 320;

export default function ListingDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const router = useRouter();
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [listing, setListing] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [contact, setContact] = useState<{ agentName?: string; agentPhone?: string; agentEmail?: string } | null>(null);
  const [contactGate, setContactGate] = useState<'ok' | 'verify' | 'hidden'>('ok');
  const [contactIntent, setContactIntent] = useState<'call' | 'whatsapp' | 'message' | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Invalid listing');
      setLoading(false);
      return;
    }
    fetch(getApiUrl(`listings/${id}`))
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setListing(d);
          if (typeof d.likeCount === 'number') setLikeCount(d.likeCount);
        }
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id || !token) return;
    fetch(getApiUrl(`listings/${id}/contact`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (r.status === 403 && d?.code === 'EMAIL_NOT_VERIFIED') {
          setContactGate('verify');
          return;
        }
        if (!r.ok) {
          setContactGate('hidden');
          return;
        }
        setContactGate('ok');
        if (d && (d.agentPhone || d.agentName || d.agentEmail)) setContact(d);
      })
      .catch(() => setContactGate('hidden'));
  }, [id, token]);

  const loc = (listing?.location as Record<string, string>) || {};
  const locationLine = formatLocation(loc);
  const rawImages = (listing?.images as Array<{ url?: string }>) || [];
  const images = rawImages.map((img) => img?.url ?? '').filter(Boolean);
  const contactPhone = contact?.agentPhone || '';
  const contactName = contact?.agentName || '';
  const createdById =
    listing?.createdBy && typeof listing.createdBy === 'object'
      ? String((listing.createdBy as { _id?: string })._id || '')
      : '';
  const isOwner = !!user?.id && !!createdById && user.id === createdById;
  const title = (listing?.title as string) || 'Listing';
  const listingType = listing?.listingType as string;
  const rentPeriod = listingType === 'rent' ? (listing?.rentPeriod as string) : undefined;
  const viewCount = (listing?.viewCount as number) ?? 0;
  const amenities = Array.isArray(listing?.amenities) ? (listing?.amenities as string[]) : [];
  const description = stripHtml(listing?.description as string) || '—';

  const onGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (i !== imageIndex) setImageIndex(i);
  };

  const openCall = () => {
    if (!token) {
      setContactIntent('call');
      return;
    }
    if (contactGate === 'verify') {
      setContactIntent('call');
      return;
    }
    const href = toTelHref(contactPhone);
    if (!href) return;
    Linking.openURL(href);
  };

  const openWhatsApp = () => {
    if (!token) {
      setContactIntent('whatsapp');
      return;
    }
    if (contactGate === 'verify') {
      setContactIntent('whatsapp');
      return;
    }
    if (!contactPhone) return;
    Linking.openURL(toWhatsAppUrl(contactPhone, `Hi, I'm interested in: ${title}`));
  };

  const openMessages = () => {
    if (!token) {
      setContactIntent('message');
      return;
    }
    if (contactGate === 'verify') {
      setContactIntent('message');
      return;
    }
    router.push(`/messages/listing/${id}`);
  };

  const shareListing = async () => {
    try {
      await Share.share({
        title,
        message: `${title} — ${formatPrice((listing?.price as number) || 0, rentPeriod)}\nhttps://www.digitproperties.com/listings/${id}`,
      });
    } catch {
      /* cancelled */
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !listing) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || 'Not found'}</Text>
        <Pressable style={styles.backTextBtn} onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const specs = formatBedsBaths({
    bedrooms: listing.bedrooms as number,
    bathrooms: listing.bathrooms as number,
    area: listing.area as number,
    propertyType: listing.propertyType as string,
  });

  return (
    <View style={styles.flex}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 180 }}>
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            onScroll={onGalleryScroll}
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator={false}
          >
            {(images.length ? images : ['']).map((uri, i) =>
              uri ? (
                <Image key={i} source={{ uri }} style={styles.hero} />
              ) : (
                <View key={i} style={[styles.hero, styles.placeholder]}>
                  <Ionicons name="home-outline" size={48} color={colors.faint} />
                </View>
              )
            )}
          </ScrollView>
          <View style={[styles.overlayBar, { top: insets.top + 8 }]}>
            <Pressable style={styles.round} onPress={() => router.back()} accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={22} color={colors.ink} />
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable style={styles.round} onPress={shareListing} accessibilityLabel="Share">
                <Ionicons name="share-outline" size={20} color={colors.ink} />
              </Pressable>
              <HeartButton listingId={id} />
            </View>
          </View>
          {images.length > 1 ? (
            <View style={styles.counter}>
              <Text style={styles.counterText}>
                {imageIndex + 1} / {images.length}
              </Text>
            </View>
          ) : null}
        </View>

        {(listing.status as string) === 'pending_approval' ? (
          <View style={styles.pending}>
            <Text style={styles.pendingTitle}>Pending approval</Text>
            <Text style={styles.pendingText}>Hidden from search until an admin approves it.</Text>
          </View>
        ) : null}

        <View style={styles.body}>
          <Text style={styles.badge}>{listingTypeBadge(listingType)}</Text>
          <Text style={styles.price}>{formatPrice((listing.price as number) || 0, rentPeriod)}</Text>
          <Text style={styles.title}>{title}</Text>
          {locationLine ? (
            <View style={styles.locRow}>
              <Ionicons name="location-outline" size={16} color={colors.muted} />
              <Text style={styles.loc}>{locationLine}</Text>
            </View>
          ) : null}
          {loc.address ? <Text style={styles.address}>{loc.address}</Text> : null}

          <View style={styles.stats}>
            {specs ? (
              <View style={styles.stat}>
                <Ionicons name="bed-outline" size={18} color={colors.primary} />
                <Text style={styles.statText}>{specs}</Text>
              </View>
            ) : null}
            {listing.propertyType ? (
              <View style={styles.stat}>
                <Ionicons name="business-outline" size={18} color={colors.primary} />
                <Text style={styles.statText}>{formatPropertyTypeLabel(listing.propertyType as string)}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.views}>
            {viewCount} view{viewCount !== 1 ? 's' : ''} · {likeCount} save{likeCount !== 1 ? 's' : ''}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>About this home</Text>
          <Text style={styles.desc}>{description}</Text>
        </View>

        {amenities.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.section}>Amenities</Text>
            <View style={styles.chips}>
              {amenities.map((a) => (
                <View key={a} style={styles.chip}>
                  <Text style={styles.chipText}>{a}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Pressable
          style={styles.listCta}
          onPress={() => router.push('/listings/new')}
          accessibilityRole="button"
          accessibilityLabel="Sell or rent your property for free"
        >
          <Text style={styles.listCtaKicker}>FREE TO LIST</Text>
          <Text style={styles.listCtaTitle}>
            {listingType === 'rent'
              ? 'Rent or lease your property for FREE!'
              : listingType === 'sale'
                ? 'Sell your property for FREE!'
                : 'Sell or Rent your Property for FREE!'}
          </Text>
          <Text style={styles.listCtaBody}>
            Have a house, land, or apartment? List it in minutes — no listing fees.
          </Text>
          <View style={styles.listCtaBtn}>
            <Text style={styles.listCtaBtnText}>List your property free →</Text>
          </View>
        </Pressable>
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={{ flex: 1, gap: 8 }}>
          {token && (contactName || contactPhone) ? (
            <View>
              <Text style={styles.ctaHint}>Listed by</Text>
              <Text style={styles.ctaName} numberOfLines={1}>
                {contactName || 'Lister'}
              </Text>
            </View>
          ) : null}
          {!token && contactIntent ? (
            <View style={styles.gateBox}>
              <Text style={styles.gateText}>
                {contactIntent === 'call'
                  ? 'Sign in with a verified email to call the lister.'
                  : contactIntent === 'whatsapp'
                    ? 'Sign in with a verified email to send a WhatsApp message.'
                    : 'Sign in with a verified email to message the lister.'}
              </Text>
              <Pressable style={styles.primaryBtn} onPress={() => router.push('/auth/signin')}>
                <Text style={styles.primaryBtnText}>
                  {contactIntent === 'call'
                    ? 'Sign in to call'
                    : contactIntent === 'whatsapp'
                      ? 'Sign in to WhatsApp'
                      : 'Sign in to message'}
                </Text>
              </Pressable>
            </View>
          ) : null}
          {token && contactGate === 'verify' && contactIntent ? (
            <View style={styles.gateBox}>
              <Text style={styles.gateText}>
                {contactIntent === 'call'
                  ? 'Confirm your email address to call the lister.'
                  : contactIntent === 'whatsapp'
                    ? 'Confirm your email address to send a WhatsApp message.'
                    : 'Confirm your email address to message the lister.'}
              </Text>
              <Pressable style={styles.primaryBtn} onPress={() => router.push('/(tabs)/dashboard/profile')}>
                <Text style={styles.primaryBtnText}>Verify email</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.ctaRow}>
            {!isOwner && (!token || contactGate === 'verify' || !!contactPhone) ? (
              <>
                <Pressable style={[styles.call, { flex: 1 }]} onPress={openCall}>
                  <Ionicons name="call" size={18} color="#fff" />
                  <Text style={styles.waText}>Call now</Text>
                </Pressable>
                <Pressable style={[styles.wa, { flex: 1 }]} onPress={openWhatsApp}>
                  <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                  <Text style={styles.waText}>WhatsApp</Text>
                </Pressable>
              </>
            ) : null}
            <Pressable style={[styles.msg, { flex: 1 }]} onPress={openMessages}>
              <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
              <Text style={styles.waText}>{isOwner ? 'Messages' : 'Message'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  error: { color: colors.danger, fontSize: 16, textAlign: 'center' },
  backTextBtn: { marginTop: 16 },
  link: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  hero: { width: SCREEN_WIDTH, height: IMG_HEIGHT, backgroundColor: '#0f172a' },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0' },
  overlayBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: 'rgba(15,23,42,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  pending: {
    margin: 16,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
  },
  pendingTitle: { fontWeight: '700', color: colors.warning },
  pendingText: { marginTop: 4, color: '#92400e', fontSize: 13 },
  body: { paddingHorizontal: 20, paddingTop: 20 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    color: colors.primaryDark,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  price: { fontSize: 28, fontWeight: '800', color: colors.ink, letterSpacing: -0.4 },
  title: { fontSize: 18, fontWeight: '600', color: colors.ink, marginTop: 6, lineHeight: 24 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  loc: { fontSize: 15, color: colors.body, flex: 1 },
  address: { fontSize: 14, color: colors.muted, marginTop: 4 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 14, fontWeight: '600', color: colors.body },
  views: { fontSize: 13, color: colors.faint, marginTop: 12 },
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
  },
  section: { fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 10 },
  desc: { fontSize: 15, color: colors.body, lineHeight: 23 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipText: { fontSize: 13, color: colors.body, fontWeight: '500' },
  cta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  ctaHint: { fontSize: 11, color: colors.faint, fontWeight: '600' },
  ctaName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  ctaRow: { flexDirection: 'row', gap: 8 },
  gateBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 10,
  },
  gateText: { fontSize: 13, color: colors.body, lineHeight: 18 },
  call: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  wa: {
    backgroundColor: colors.whatsapp,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  msg: {
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  waText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  listCta: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: radius.lg,
    padding: 18,
    backgroundColor: '#059669',
  },
  listCtaKicker: {
    color: '#d1fae5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  listCtaTitle: {
    marginTop: 6,
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
  listCtaBody: {
    marginTop: 8,
    color: '#ecfdf5',
    fontSize: 14,
    lineHeight: 20,
  },
  listCtaBtn: {
    marginTop: 14,
    backgroundColor: '#fff',
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  listCtaBtnText: { color: '#065f46', fontWeight: '800', fontSize: 15 },
});
