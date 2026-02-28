import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../contexts/AuthContext';
import { getApiUrl } from '../../../lib/api';

type ListingItem = {
  _id: string;
  title: string;
  price: number;
  listingType: string;
  rentPeriod?: string;
  location?: { suburb?: string; city?: string; state?: string };
  images?: Array<{ url: string }>;
};

function formatPrice(n: number, rentPeriod?: string) {
  const formatted = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
  if (rentPeriod) {
    const suffix = rentPeriod === 'day' ? '/day' : rentPeriod === 'month' ? '/month' : '/year';
    return `${formatted}${suffix}`;
  }
  return formatted;
}

type TrendItem = { _id: string; title: string; slug: string; excerpt: string; category: string; imageUrl?: string };
function TrendsSection() {
  const router = useRouter();
  const [posts, setPosts] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(getApiUrl('trends', { limit: '6' }))
      .then((r) => r.json())
      .then((d) => setPosts(d.posts || []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);
  if (loading || posts.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Trends</Text>
        <Pressable onPress={() => router.push('/trends')}>
          <Text style={styles.viewAll}>View all →</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
        {posts.slice(0, 6).map((p) => (
          <Pressable key={p._id} style={styles.trendCard} onPress={() => router.push({ pathname: '/trends/[slug]', params: { slug: p.slug } })}>
            {p.imageUrl ? <Image source={{ uri: p.imageUrl }} style={styles.trendCardImage} /> : <View style={[styles.trendCardImage, styles.placeholder]} />}
            <View style={styles.trendCardContent}>
              <Text style={styles.trendCategory}>{p.category}</Text>
              <Text style={styles.trendTitle} numberOfLines={2}>{p.title}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut, isLoaded } = useAuth();
  const [featured, setFeatured] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(getApiUrl('listings', { limit: '8' }))
      .then((r) => r.json())
      .then((d) => setFeatured(d.listings || []))
      .catch(() => setFeatured([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, { paddingTop: (insets.top || 0) + 20 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Find Your Dream Property in Nigeria</Text>
        <Text style={styles.heroSub}>
          Browse thousands of apartments, houses, land, and commercial properties for sale and rent across Lagos, Abuja, Port Harcourt, and beyond.
        </Text>
        <View style={styles.heroButtons}>
          <Pressable style={styles.heroBtnPrimary} onPress={() => router.push('/listings?listingType=sale')}>
            <Text style={styles.heroBtnPrimaryText}>Buy Property</Text>
          </Pressable>
          <Pressable style={styles.heroBtnSecondary} onPress={() => router.push('/listings?listingType=rent')}>
            <Text style={styles.heroBtnSecondaryText}>Rent Property</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.accountRow}>
        {isLoaded && user ? (
          <>
            <Text style={styles.accountLabel}>Signed in as {user.name || 'User'}</Text>
            <Pressable style={styles.signOutBtn} onPress={() => signOut()}>
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Link href="/auth/signin" asChild>
              <Pressable style={styles.authBtn}>
                <Text style={styles.authBtnText}>Sign in</Text>
              </Pressable>
            </Link>
            <Link href="/auth/signup" asChild>
              <Pressable style={[styles.authBtn, styles.authBtnPrimary]}>
                <Text style={styles.authBtnPrimaryText}>Sign up</Text>
              </Pressable>
            </Link>
          </>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Featured Listings</Text>
          <Pressable onPress={() => router.push('/listings')}>
            <Text style={styles.viewAll}>View all →</Text>
          </Pressable>
        </View>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#0ea5e9" />
          </View>
        ) : featured.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No listings yet. Be the first to Add a property!</Text>
            <Link href="/auth/signup" asChild>
              <Pressable style={styles.emptyLink}>
                <Text style={styles.emptyLinkText}>Sign up to list</Text>
              </Pressable>
            </Link>
          </View>
        ) : (
          <View style={styles.grid}>
            {featured.map((item) => (
              <Pressable
                key={item._id}
                style={styles.card}
                onPress={() => router.push({ pathname: '/listings/[id]', params: { id: item._id } })}
              >
                {item.images?.[0]?.url ? (
                  <Image source={{ uri: item.images[0].url }} style={styles.cardImage} />
                ) : (
                  <View style={[styles.cardImage, styles.placeholder]} />
                )}
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.cardPrice}>
                    {formatPrice(item.price, item.listingType === 'rent' ? item.rentPeriod : undefined)}
                  </Text>
                  <Text style={styles.cardLocation} numberOfLines={1}>
                    {[item.location?.suburb, item.location?.city, item.location?.state].filter(Boolean).join(', ') || '—'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <TrendsSection />

      <View style={styles.ctaSection}>
        <Link href="/listings" asChild>
          <Pressable style={styles.browseBtn}>
            <Text style={styles.browseBtnText}>Browse all listings</Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerTitle}>How it works</Text>
        <View style={styles.footerSteps}>
          <Text style={styles.footerStep}>1. Search — Filter by location, price & type</Text>
          <Text style={styles.footerStep}>2. Connect — View contact details & reach out</Text>
          <Text style={styles.footerStep}>3. Close — Work with agents to close the deal</Text>
        </View>
        <Text style={styles.footerCopy}>© Digit Properties. Listings sync with the app and web.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { paddingBottom: 48 },
  hero: {
    backgroundColor: '#0c4a6e',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 32,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  heroButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 20,
    justifyContent: 'center',
  },
  heroBtnPrimary: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  heroBtnPrimaryText: { color: '#0c4a6e', fontWeight: '600', fontSize: 15 },
  heroBtnSecondary: {
    borderWidth: 2,
    borderColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  heroBtnSecondaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  accountLabel: { fontSize: 14, color: '#64748b' },
  signOutBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  signOutText: { color: '#0ea5e9', fontSize: 15, fontWeight: '500' },
  authBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  authBtnPrimary: { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  authBtnText: { fontSize: 15, fontWeight: '600', color: '#334155' },
  authBtnPrimaryText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  section: { paddingHorizontal: 20, marginTop: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  viewAll: { fontSize: 15, color: '#0ea5e9', fontWeight: '500' },
  loading: { paddingVertical: 40, alignItems: 'center' },
  empty: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  emptyText: { color: '#64748b', textAlign: 'center' },
  emptyLink: { marginTop: 12 },
  emptyLinkText: { color: '#0ea5e9', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardImage: { width: '100%', aspectRatio: 4 / 3 },
  placeholder: { backgroundColor: '#e2e8f0' },
  cardContent: { padding: 12 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  cardPrice: { fontSize: 15, fontWeight: 'bold', color: '#0ea5e9', marginTop: 4 },
  cardLocation: { fontSize: 12, color: '#64748b', marginTop: 2 },
  ctaSection: { paddingHorizontal: 20, paddingTop: 28, gap: 12 },
  browseBtn: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  browseBtnText: { fontSize: 17, fontWeight: '600', color: '#fff' },
  footer: {
    marginTop: 32,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    backgroundColor: '#e2e8f0',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  footerTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  footerSteps: { gap: 6 },
  footerStep: { fontSize: 14, color: '#475569', lineHeight: 20 },
  footerCopy: { marginTop: 16, fontSize: 12, color: '#64748b', textAlign: 'center' },
  trendCard: { width: 260, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', marginRight: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  trendCardImage: { width: '100%', aspectRatio: 16 / 9 },
  trendCardContent: { padding: 12 },
  trendCategory: { fontSize: 11, fontWeight: '600', color: '#0d9488' },
  trendTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginTop: 4 },
});
