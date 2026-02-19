import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Image, Pressable, Linking } from 'react-native';

const API_URL = (typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_API_URL) || 'https://digitproperties.com';
const WEB_APP_URL = (typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_APP_URL) || 'https://digitproperties.com';

export default function ListingsScreen() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/listings?limit=20`)
      .then((r) => r.json())
      .then((d) => setListings(d.listings || []))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, []);

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
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={listings}
      keyExtractor={(item) => item._id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <Pressable
          style={styles.createButton}
          onPress={() => Linking.openURL(WEB_APP_URL + '/listings/new')}
        >
          <Text style={styles.createButtonText}>+ Create Listing (web)</Text>
        </Pressable>
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() => Linking.openURL(`${API_URL.replace('/api', '')}/listings/${item._id}`)}
        >
          {item.images?.[0]?.url ? (
            <Image source={{ uri: item.images[0].url }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.placeholder]} />
          )}
          <View style={styles.cardContent}>
            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.price}>
              {formatPrice(item.price, item.listingType === 'rent' ? item.rentPeriod : undefined)}
            </Text>
            <Text style={styles.location}>
              {[item.location?.suburb, item.location?.city, item.location?.state].filter(Boolean).join(', ') || '—'}
            </Text>
          </View>
        </Pressable>
      )}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.empty}>No listings. Start the web app and add listings.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  list: { padding: 16, paddingBottom: 32 },
  createButton: {
    backgroundColor: '#0d9488',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  createButtonText: { color: 'white', fontWeight: '600', fontSize: 16 },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  image: { width: '100%', height: 180 },
  placeholder: { backgroundColor: '#e5e7eb' },
  cardContent: { padding: 16 },
  title: { fontSize: 16, fontWeight: '600', color: '#111827' },
  price: { fontSize: 18, fontWeight: 'bold', color: '#0ea5e9', marginTop: 4 },
  location: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  empty: { color: '#6b7280', textAlign: 'center' },
});
