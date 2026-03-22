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
  location?: { city?: string; state?: string };
  images?: Array<{ url: string }>;
};

function formatPrice(n: number, rentPeriod?: string) {
  const fmt = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
  return rentPeriod ? `${fmt}/${rentPeriod}` : fmt;
}

type SortKey = 'default' | 'image' | 'title' | 'price' | 'status';

const STATUS_RANK: Record<string, number> = {
  draft: 0,
  pending_approval: 1,
  active: 2,
  paused: 3,
  closed: 4,
};

function sortListingRows(listings: Listing[], sortKey: SortKey, sortAsc: boolean): Listing[] {
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
const PER_PAGE = 25;

export default function MyListingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [sortAsc, setSortAsc] = useState(true);
  const topPad = (insets.top || 0) + TOP_PADDING_EXTRA;

  const sortedListings = useMemo(
    () => sortListingRows(listings, sortKey, sortAsc),
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

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    fetch(
      getApiUrl('listings', {
        mine: '1',
        limit: String(PER_PAGE),
        page: String(page),
      }),
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )
      .then((r) => r.json())
      .then((d) => {
        const list = d.listings || [];
        const pag = d.pagination || {};
        const pages = Math.max(1, Number(pag.pages) || 1);
        setListings(list);
        setPagination({ total: Number(pag.total) || 0, pages });
        if (list.length === 0 && page > 1) {
          setPage((p) => Math.max(1, p - 1));
        }
      })
      .catch(() => {
        setListings([]);
        setPagination({ total: 0, pages: 1 });
      })
      .finally(() => setLoading(false));
  }, [token, page]);

  useEffect(() => {
    load();
  }, [load]);

  const deleteListing = (id: string, title: string) => {
    Alert.alert('Delete listing', `Delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          fetch(getApiUrl('listings/' + id), {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((r) => {
              if (r.ok) {
                if (listings.length === 1 && page > 1) setPage((p) => Math.max(1, p - 1));
                else load();
              }
            })
            .catch(() => {});
        },
      },
    ]);
  };

  if (!token) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Sign in to view your listings.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()}><Text style={styles.backText}>← Back</Text></Pressable>
        <Pressable style={styles.addBtn} onPress={() => router.push('/listings/new')}>
          <Text style={styles.addBtnText}>+ Add listing</Text>
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#0c4a6e" style={styles.loader} />
      ) : listings.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No listings yet.</Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.push('/listings/new')}>
            <Text style={styles.emptyBtnText}>Create one</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={sortedListings}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.sortSection}>
              {pagination.total > 0 && (
                <Text style={styles.pageInfo}>
                  {(page - 1) * PER_PAGE + 1}–{(page - 1) * PER_PAGE + listings.length} of {pagination.total}
                  {pagination.pages > 1 ? ` · Page ${page}/${pagination.pages}` : ''}
                </Text>
              )}
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
          ListFooterComponent={
            pagination.pages > 1 ? (
              <View style={styles.pageNav}>
                <Pressable
                  style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                  disabled={page <= 1}
                  onPress={() => setPage(1)}
                >
                  <Text style={[styles.pageBtnText, page <= 1 && styles.pageBtnTextDisabled]}>First</Text>
                </Pressable>
                <Pressable
                  style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                  disabled={page <= 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <Text style={[styles.pageBtnText, page <= 1 && styles.pageBtnTextDisabled]}>Prev</Text>
                </Pressable>
                <Text style={styles.pageNavLabel}>
                  {page} / {pagination.pages}
                </Text>
                <Pressable
                  style={[styles.pageBtn, page >= pagination.pages && styles.pageBtnDisabled]}
                  disabled={page >= pagination.pages}
                  onPress={() => setPage((p) => p + 1)}
                >
                  <Text style={[styles.pageBtnText, page >= pagination.pages && styles.pageBtnTextDisabled]}>Next</Text>
                </Pressable>
                <Pressable
                  style={[styles.pageBtn, page >= pagination.pages && styles.pageBtnDisabled]}
                  disabled={page >= pagination.pages}
                  onPress={() => setPage(pagination.pages)}
                >
                  <Text style={[styles.pageBtnText, page >= pagination.pages && styles.pageBtnTextDisabled]}>Last</Text>
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              {item.images?.[0]?.url ? (
                <Image source={{ uri: item.images[0].url }} style={styles.cardImage} />
              ) : <View style={[styles.cardImage, styles.placeholder]} />}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.cardPrice}>{formatPrice(item.price, item.listingType === 'rent' ? item.rentPeriod : undefined)}</Text>
                <View style={styles.cardRow}>
                  <Text style={[styles.badge, item.status === 'active' ? styles.badgeActive : styles.badgeDraft]}>{item.status}</Text>
                  <View style={styles.actions}>
                    <Pressable onPress={() => router.push({ pathname: '/listings/[id]', params: { id: item._id } })}><Text style={styles.actionText}>View</Text></Pressable>
                    <Pressable onPress={() => router.push({ pathname: '/listings/[id]/edit', params: { id: item._id } })}><Text style={styles.actionText}>Edit</Text></Pressable>
                    <Pressable onPress={() => deleteListing(item._id, item.title)}><Text style={[styles.actionText, styles.actionDanger]}>Delete</Text></Pressable>
                  </View>
                </View>
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
  msg: { fontSize: 16, color: '#64748b' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backText: { fontSize: 16, color: '#0c4a6e', fontWeight: '500' },
  addBtn: { backgroundColor: '#0c4a6e', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  loader: { marginTop: 24 },
  sortSection: { marginBottom: 12 },
  pageInfo: { fontSize: 13, color: '#64748b', marginBottom: 10 },
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
  sortChipActive: { backgroundColor: '#0c4a6e', borderColor: '#0c4a6e' },
  sortChipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  sortChipTextActive: { color: '#fff' },
  list: { padding: 16, paddingBottom: 32 },
  pageNav: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  pageBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    minWidth: 56,
    alignItems: 'center',
  },
  pageBtnDisabled: { opacity: 0.45 },
  pageBtnText: { fontSize: 13, fontWeight: '600', color: '#0c4a6e' },
  pageBtnTextDisabled: { color: '#94a3b8' },
  pageNavLabel: { fontSize: 14, fontWeight: '600', color: '#334155', paddingHorizontal: 8 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 16, color: '#64748b', marginBottom: 12 },
  emptyBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  emptyBtnText: { color: '#0c4a6e', fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 2 },
  cardImage: { width: '100%', height: 140 },
  placeholder: { backgroundColor: '#e2e8f0' },
  cardBody: { padding: 14 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  cardPrice: { fontSize: 17, fontWeight: 'bold', color: '#0c4a6e', marginTop: 4 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  badge: { fontSize: 12, fontWeight: '600', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 6 },
  badgeActive: { backgroundColor: '#dcfce7', color: '#166534' },
  badgeDraft: { backgroundColor: '#f1f5f9', color: '#475569' },
  actions: { flexDirection: 'row', gap: 16 },
  actionText: { fontSize: 14, color: '#0c4a6e', fontWeight: '500' },
  actionDanger: { color: '#dc2626' },
});
