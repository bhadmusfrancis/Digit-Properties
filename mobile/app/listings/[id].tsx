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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getApiUrl } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMG_HEIGHT = 260;

export default function ListingDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const router = useRouter();
  const { token } = useAuth();
  const [listing, setListing] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [contact, setContact] = useState<{ agentName?: string; agentPhone?: string; agentEmail?: string } | null>(null);

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
    fetch(getApiUrl(`listings/${id}/like`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.liked === 'boolean') setLiked(d.liked);
      })
      .catch(() => {});
  }, [id, token]);

  useEffect(() => {
    if (!id || !token) return;
    fetch(getApiUrl(`listings/${id}/contact`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d && (d.agentPhone || d.agentEmail)) setContact(d);
      })
      .catch(() => {});
  }, [id, token]);

  const formatPrice = (n: number, rentPeriod?: string) => {
    const formatted = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(n);
    if (rentPeriod) {
      const suffix = rentPeriod === 'day' ? '/day' : rentPeriod === 'month' ? '/month' : '/year';
      return `${formatted}${suffix}`;
    }
    return formatted;
  };

  const viewCount = (listing?.viewCount as number) ?? 0;

  const toggleLike = () => {
    if (!token || likePending) return;
    setLikePending(true);
    fetch(getApiUrl(`listings/${id}/like`), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.likeCount === 'number') setLikeCount(d.likeCount);
        if (typeof d.liked === 'boolean') setLiked(d.liked);
      })
      .finally(() => setLikePending(false));
  };

  const contactPhone = contact?.agentPhone ?? (listing?.agentPhone as string);
  const contactName = contact?.agentName ?? (listing?.agentName as string);

  const openWhatsApp = () => {
    const phone = contactPhone || '';
    if (!phone) return;
    const title = (listing?.title as string) || 'Property';
    const msg = `Hi, I'm interested in: ${title}`;
    const url = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
    Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0c4a6e" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error || !listing) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || 'Not found'}</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  const loc = (listing.location as Record<string, string>) || {};
  const locationLine = [loc.suburb, loc.city, loc.state].filter(Boolean).join(', ') || '—';
  const rawImages = (listing.images as Array<{ url?: string; public_id?: string }>) || [];
  const images = rawImages.map((img) => ({ url: img?.url ?? '' })).filter((img) => img.url);
  const currentImage = images[imageIndex]?.url ? { uri: images[imageIndex].url } : null;
  const goPrev = () => setImageIndex((i) => (i <= 0 ? images.length - 1 : i - 1));
  const goNext = () => setImageIndex((i) => (i >= images.length - 1 ? 0 : i + 1));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBack}>
          <Text style={styles.headerBackText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {(listing.title as string) || 'Listing'}
        </Text>
      </View>

      <View style={styles.gallery}>
        {currentImage ? (
          <Image source={currentImage} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={[styles.heroImage, styles.placeholder]} />
        )}
        {images.length > 1 && (
          <>
            <Pressable style={styles.galleryPrev} onPress={goPrev} accessibilityLabel="Previous image">
              <Text style={styles.galleryArrow}>‹</Text>
            </Pressable>
            <Pressable style={styles.galleryNext} onPress={goNext} accessibilityLabel="Next image">
              <Text style={styles.galleryArrow}>›</Text>
            </Pressable>
            <View style={styles.dots}>
              {images.slice(0, 10).map((_, i) => (
                <Pressable
                  key={i}
                  onPress={() => setImageIndex(i)}
                  style={[styles.dot, i === imageIndex && styles.dotActive]}
                />
              ))}
            </View>
          </>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.statsRow}>
          <Text style={styles.statsText}>{viewCount} view{viewCount !== 1 ? 's' : ''}</Text>
          <Text style={styles.statsText}>{likeCount} like{likeCount !== 1 ? 's' : ''}</Text>
        </View>
        {token && (
          <Pressable style={styles.likeBtn} onPress={toggleLike} disabled={likePending}>
            <Text style={styles.likeBtnText}>{liked ? 'Unlike' : 'Like'}</Text>
          </Pressable>
        )}
        <Text style={styles.price}>
          {formatPrice(
            (listing.price as number) || 0,
            (listing.listingType as string) === 'rent' ? (listing.rentPeriod as string) : undefined
          )}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {(listing.bedrooms as number) ?? 0} beds · {(listing.bathrooms as number) ?? 0} baths
            {(listing.area as number) ? ` · ${listing.area} sqm` : ''}
          </Text>
        </View>
        <Text style={styles.meta}>
          {(listing.propertyType as string) ?? ''} · {(listing.listingType as string) ?? ''}
        </Text>
        <View style={styles.locationRow}>
          <Text style={styles.locationLabel}>Location</Text>
          <Text style={styles.location}>{locationLine}</Text>
          {loc.address ? <Text style={styles.address}>{loc.address}</Text> : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{(listing.description as string) || '—'}</Text>
      </View>

      {Array.isArray(listing.amenities) && (listing.amenities as string[]).length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Amenities</Text>
          <View style={styles.chips}>
            {(listing.amenities as string[]).map((a: string) => (
              <View key={a} style={styles.chip}>
                <Text style={styles.chipText}>{a}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {(contactPhone || (listing?.agentPhone as string)) && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact</Text>
          {contactName && (
            <Text style={styles.contactName}>{contactName}</Text>
          )}
          <Pressable style={styles.whatsappBtn} onPress={openWhatsApp}>
            <Text style={styles.whatsappBtnText}>Contact via WhatsApp</Text>
          </Pressable>
        </View>
      )}

      <Pressable style={styles.backToLink} onPress={() => router.push('/listings')}>
        <Text style={styles.backToLinkText}>← All listings</Text>
      </Pressable>
      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: '#64748b' },
  error: { color: '#dc2626', textAlign: 'center', fontSize: 16 },
  backBtn: { marginTop: 20, paddingVertical: 10, paddingHorizontal: 16 },
  backBtnText: { color: '#0c4a6e', fontSize: 16, fontWeight: '600' },
  scroll: { flex: 1, backgroundColor: '#f1f5f9' },
  container: { paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerBack: { marginRight: 12 },
  headerBackText: { color: '#0c4a6e', fontSize: 16 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: '#0f172a' },
  gallery: { backgroundColor: '#000', position: 'relative' },
  heroImage: { width: SCREEN_WIDTH, height: IMG_HEIGHT },
  placeholder: { backgroundColor: '#e2e8f0' },
  galleryPrev: {
    position: 'absolute',
    left: 8,
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryNext: {
    position: 'absolute',
    right: 8,
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryArrow: { color: '#fff', fontSize: 28, fontWeight: '300' },
  dots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: { backgroundColor: '#fff' },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  price: { fontSize: 24, fontWeight: 'bold', color: '#0c4a6e' },
  metaRow: { marginTop: 6 },
  meta: { fontSize: 14, color: '#64748b', marginTop: 2 },
  locationRow: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  locationLabel: { fontSize: 12, fontWeight: '600', color: '#94a3b8', marginBottom: 4 },
  location: { fontSize: 15, color: '#334155' },
  address: { fontSize: 14, color: '#64748b', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 10 },
  description: { fontSize: 15, color: '#475569', lineHeight: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  chipText: { fontSize: 14, color: '#475569' },
  contactName: { fontSize: 15, color: '#334155', marginBottom: 10 },
  whatsappBtn: {
    backgroundColor: '#25D366',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  whatsappBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  backToLink: { marginTop: 24, marginHorizontal: 16, paddingVertical: 12 },
  backToLinkText: { color: '#0c4a6e', fontSize: 15, fontWeight: '500' },
  bottomPad: { height: 24 },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  statsText: { fontSize: 13, color: '#64748b' },
  likeBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    marginBottom: 12,
  },
  likeBtnText: { fontSize: 14, color: '#0c4a6e', fontWeight: '500' },
});
