import { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Image, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../lib/api';

type Listing = {
  _id: string;
  title: string;
  price: number;
  status: string;
  listingType: string;
  rentPeriod?: string;
  formattedPrice?: string;
  createdBy?: { name?: string; email?: string };
  images?: Array<{ url: string }>;
};

type SortKey = 'default' | 'image' | 'title' | 'price' | 'status';

const STATUS_RANK: Record<string, number> = {
  draft: 0,
  pending_approval: 1,
  active: 2,
  paused: 3,
  closed: 4,
};

function sortAdminListings(listings: Listing[], sortKey: SortKey, sortAsc: boolean): Listing[] {
  if (sortKey === 'default') return [...listings];
  const copy = [...listings];
  const dir = sortAsc ? 1 : -1;
  copy.sort((a, b) => {
    switch (sortKey) {
      case 'image': {
        const ha = a.images?.[0]?.url ? 1 : 0;
        const hb = b.images?.[0]?.url ? 1 : 0;
        if (ha !== hb) return (ha - hb) * dir;
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      }
      case 'title':
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) * dir;
      case 'price':
        if (a.price !== b.price) return (a.price - b.price) * dir;
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      case 'status': {
        const ra = STATUS_RANK[a.status] ?? 99;
        const rb = STATUS_RANK[b.status] ?? 99;
        if (ra !== rb) return (ra - rb) * dir;
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      }
      default:
        return 0;
    }
  });
  return copy;
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'default', label: 'Newest' },
  { key: 'image', label: 'Image' },
  { key: 'title', label: 'Title' },
  { key: 'price', label: 'Price' },
  { key: 'status', label: 'Status' },
];

const TOP_PADDING_EXTRA = 24;

export default function AdminListingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [sortAsc, setSortAsc] = useState(true);
  const topPad = (insets.top || 0) + TOP_PADDING_EXTRA;

  const sortedListings = useMemo(
    () => sortAdminListings(listings, sortKey, sortAsc),
    [listings, sortKey, sortAsc]
  );

  const cycleSort = useCallback(
    (key: Exclude<SortKey, 'default'>) => {
      setSortKey((prev) => {
        if (prev !== key) {
          setSortAsc(key === 'image' ? false : true);
          return key;
        }
        setSortAsc((a) => !a);
        return prev;
      });
    },
    []
  );

  const PER_PAGE = 50;

  const load = (opts?: { reset?: boolean; nextPage?: number }) => {
    if (!token || user?.role !== 'admin') return;
    const reset = opts?.reset !== false;
    const targetPage = reset ? 1 : opts?.nextPage ?? page + 1;
    if (!reset && targetPage > totalPages) return;

    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    const qs = new URLSearchParams({ page: String(targetPage), limit: String(PER_PAGE) });
    fetch(getApiUrl('admin/listings?' + qs.toString()), {
      headers: { Authorization: 'Bearer ' + token },
    })
      .then((r) => r.json())
      .then((d) => {
        const batch: Listing[] = d?.listings || [];
        const tp = typeof d?.totalPages === 'number' ? d.totalPages : 1;
        setTotalPages(Math.max(1, tp));
        setPage(typeof d?.page === 'number' ? d.page : targetPage);
        if (reset) {
          setListings(batch);
        } else {
          setListings((prev) => [...prev, ...batch]);
        }
      })
      .catch(() => {
        if (reset) setListings([]);
      })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  };

  const loadMore = () => {
    if (loading || loadingMore || page >= totalPages) return;
    load({ reset: false, nextPage: page + 1 });
  };

  useEffect(() => {
    load();
  }, [token, user?.role]);

  const deleteListing = (listingId: string, title: string) => {
    Alert.alert('Delete listing', `Delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          fetch(getApiUrl('listings/' + listingId), {
            method: 'DELETE',
            headers: { Authorization: 'Bearer ' + token },
          })
            .then((r) => r.json())
            .then((d) => {
              if (d?.error) Alert.alert('Error', d.error);
              else load({ reset: true });
            })
            .catch(() => Alert.alert('Error', 'Failed to delete'));
        },
      },
    ]);
  };

  if (user?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={styles.msg}>Admin only.</Text>
          <Pressable onPress={() => router.back()} style={styles.btn}><Text style={styles.btnText}>Back</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const formatPrice = (n: number, rentPeriod?: string) => {
    const fmt = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
    return rentPeriod ? `${fmt}/${rentPeriod}` : fmt;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()}><Text style={styles.backText}>← Back</Text></Pressable>
        <Text style={styles.title}>Listings</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#0d9488" style={styles.loader} />
      ) : (
        <FlatList
          data={sortedListings}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            page < totalPages ? (
              <View style={styles.footerLoad}>
                {loadingMore ? (
                  <ActivityIndicator size="small" color="#0d9488" />
                ) : (
                  <Text style={styles.footerHint}>Scroll for more</Text>
                )}
              </View>
            ) : null
          }
          ListHeaderComponent={
            <View style={styles.sortSection}>
              <Text style={styles.sortLabel}>Sort by</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortChips}>
                {SORT_OPTIONS.map(({ key, label }) => {
                  const active = sortKey === key;
                  return (
                    <Pressable
                      key={key}
                      style={[styles.sortChip, active && styles.sortChipActive]}
                      onPress={() => {
                        if (key === 'default') {
                          setSortKey('default');
                          setSortAsc(true);
                        } else {
                          cycleSort(key);
                        }
                      }}
                    >
                      <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>
                        {label}
                        {key !== 'default' && active ? (sortAsc ? ' ↑' : ' ↓') : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable style={styles.cardPress} onPress={() => router.push({ pathname: '/listings/[id]', params: { id: item._id } })}>
                {item.images?.[0]?.url ? (
                  <Image source={{ uri: item.images[0].url }} style={styles.thumb} />
                ) : <View style={[styles.thumb, styles.placeholder]} />}
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.price}>{item.formattedPrice || formatPrice(item.price, item.listingType === 'rent' ? item.rentPeriod : undefined)}</Text>
                  <View style={styles.row}>
                    <Text style={[styles.badge, item.status === 'active' ? styles.badgeActive : styles.badgeDraft]}>{item.status}</Text>
                    <Text style={styles.creator}>{item.createdBy?.name || item.createdBy?.email || '—'}</Text>
                  </View>
                </View>
              </Pressable>
              <View style={styles.cardActions}>
                <Pressable onPress={() => router.push({ pathname: '/listings/[id]/edit', params: { id: item._id } })}>
                  <Text style={styles.actionText}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => deleteListing(item._id, item.title)}>
                  <Text style={[styles.actionText, styles.actionDanger]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  msg: { fontSize: 16, color: '#64748b', marginBottom: 12 },
  btn: { padding: 12 }, btnText: { color: '#0d9488', fontWeight: '600' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backText: { fontSize: 16, color: '#0d9488', fontWeight: '500', marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  loader: { marginTop: 24 },
  sortSection: { marginBottom: 12 },
  sortLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  sortChips: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  sortChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sortChipActive: { backgroundColor: '#0d9488', borderColor: '#0d9488' },
  sortChipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  sortChipTextActive: { color: '#fff' },
  list: { padding: 16, paddingBottom: 32 },
  card: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  cardPress: { flexDirection: 'row' },
  thumb: { width: 90, height: 90 },
  placeholder: { backgroundColor: '#e2e8f0' },
  cardBody: { flex: 1, padding: 12, justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  price: { fontSize: 14, fontWeight: '600', color: '#0d9488', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  badge: { fontSize: 11, fontWeight: '600', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 },
  badgeActive: { backgroundColor: '#dcfce7', color: '#166534' },
  badgeDraft: { backgroundColor: '#f1f5f9', color: '#475569' },
  creator: { fontSize: 12, color: '#64748b' },
  cardActions: { flexDirection: 'row', gap: 16, padding: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  actionText: { fontSize: 14, color: '#0d9488', fontWeight: '600' },
  actionDanger: { color: '#dc2626' },
  footerLoad: { paddingVertical: 16, alignItems: 'center' },
  footerHint: { fontSize: 13, color: '#94a3b8' },
});
