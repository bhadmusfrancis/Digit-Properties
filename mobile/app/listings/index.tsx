import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Image, Pressable, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getApiUrl } from '../../lib/api';

export default function ListingsScreen() {
  const router = useRouter();
  const { listingType } = useLocalSearchParams<{ listingType?: string }>();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [searchSubmit, setSearchSubmit] = useState('');

  const loadListings = useCallback(() => {
    const params: Record<string, string> = { limit: '20' };
    if (listingType === 'sale' || listingType === 'rent') params.listingType = listingType;
    if (searchSubmit.trim()) params.q = searchSubmit.trim();
    setLoading(true);
    fetch(getApiUrl('listings', params))
      .then((r) => r.json())
      .then((d) => setListings(d.listings || []))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, [listingType, searchSubmit]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

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
        <>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search listings..."
              placeholderTextColor="#94a3b8"
              value={searchQ}
              onChangeText={setSearchQ}
              onSubmitEditing={() => setSearchSubmit(searchQ)}
              returnKeyType="search"
            />
            <Pressable style={styles.searchBtn} onPress={() => setSearchSubmit(searchQ)}>
              <Text style={styles.searchBtnText}>Search</Text>
            </Pressable>
          </View>
          <Pressable
            style={styles.createButton}
            onPress={() => router.push('/listings/new')}
          >
            <Text style={styles.createButtonText}>+ Create Listing</Text>
          </Pressable>
        </>
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() => router.push({ pathname: '/listings/[id]', params: { id: item._id } })}
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
          <Text style={styles.empty}>No listings yet. Create one or pull to refresh.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  list: { padding: 16, paddingBottom: 32 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#0f172a',
  },
  searchBtn: {
    backgroundColor: '#0c4a6e',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
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
