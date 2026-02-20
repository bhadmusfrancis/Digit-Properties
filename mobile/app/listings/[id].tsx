import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

const API_URL = (typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_API_URL) || 'https://digitproperties.com';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Invalid listing');
      setLoading(false);
      return;
    }
    fetch(`${API_URL}/api/listings/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setListing(d);
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  const formatPrice = (n: number, rentPeriod?: 'day' | 'month' | 'year') => {
    const formatted = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
    if (rentPeriod) {
      const suffix = rentPeriod === 'day' ? '/day' : rentPeriod === 'month' ? '/month' : '/year';
      return `${formatted}${suffix}`;
    }
    return formatted;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error || !listing) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || 'Not found'}</Text>
        <Text style={styles.backLink} onPress={() => router.back()}>← Back</Text>
      </View>
    );
  }

  const loc = listing.location || {};
  const locationLine = [loc.suburb, loc.city, loc.state].filter(Boolean).join(', ') || '—';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {listing.images?.[0]?.url ? (
        <Image source={{ uri: listing.images[0].url }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.placeholder]} />
      )}
      <View style={styles.body}>
        <Text style={styles.title}>{listing.title}</Text>
        <Text style={styles.price}>
          {formatPrice(listing.price, listing.listingType === 'rent' ? listing.rentPeriod : undefined)}
        </Text>
        <Text style={styles.meta}>
          {listing.bedrooms} beds · {listing.bathrooms} baths
          {listing.area ? ` · ${listing.area} sqm` : ''} · {listing.propertyType} · {listing.listingType}
        </Text>
        <Text style={styles.location}>{locationLine}</Text>
        <Text style={styles.address}>{loc.address || ''}</Text>
        <Text style={styles.description}>{listing.description}</Text>
        {listing.amenities?.length > 0 && (
          <View style={styles.amenities}>
            <Text style={styles.amenitiesTitle}>Amenities</Text>
            <View style={styles.amenityChips}>
              {listing.amenities.map((a: string) => (
                <View key={a} style={styles.chip}>
                  <Text style={styles.chipText}>{a}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: '#6b7280' },
  error: { color: '#dc2626', textAlign: 'center' },
  backLink: { marginTop: 16, color: '#0ea5e9', fontSize: 16 },
  scroll: { flex: 1 },
  container: { paddingBottom: 32 },
  image: { width: '100%', height: 240 },
  placeholder: { backgroundColor: '#e5e7eb' },
  body: { padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  price: { fontSize: 20, fontWeight: '700', color: '#0ea5e9', marginTop: 8 },
  meta: { fontSize: 14, color: '#6b7280', marginTop: 8 },
  location: { fontSize: 15, color: '#374151', marginTop: 12 },
  address: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  description: { fontSize: 15, color: '#374151', marginTop: 16, lineHeight: 22 },
  amenities: { marginTop: 20 },
  amenitiesTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 },
  amenityChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  chipText: { fontSize: 14, color: '#374151' },
});
