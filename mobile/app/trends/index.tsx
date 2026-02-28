import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getApiUrl } from '../../lib/api';

type TrendPost = {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  imageUrl?: string;
  publishedAt?: string;
};

const CATEGORIES = ['Market Trends', 'Policy & Regulation', 'Lagos Focus', 'Abuja & FCT', 'Events & Exhibitions', 'Industry Reports', 'Investment & Finance', 'Housing & Affordability', 'Land & Titling'];

export default function TrendsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const category = params?.category ?? '';
  const [posts, setPosts] = useState<TrendPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = category ? getApiUrl('trends', { category }) : getApiUrl('trends');
    fetch(url).then((r) => r.json()).then((d) => setPosts(d.posts || [])).catch(() => setPosts([])).finally(() => setLoading(false));
  }, [category]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.title}>Trends</Text>
        <Text style={styles.subtitle}>News, market trends and insights on Nigerian real estate.</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categories} contentContainerStyle={styles.categoriesContent}>
        <Pressable style={[styles.chip, !category && styles.chipActive]} onPress={() => router.setParams({ category: undefined })}>
          <Text style={[styles.chipText, !category && styles.chipTextActive]}>All</Text>
        </Pressable>
        {CATEGORIES.map((c) => (
          <Pressable key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => router.setParams({ category: category === c ? undefined : c })}>
            <Text style={[styles.chipText, category === c && styles.chipTextActive]} numberOfLines={1}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {loading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color="#0d9488" /></View>
      ) : posts.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyText}>No posts in this category yet.</Text></View>
      ) : (
        <View style={styles.list}>
          {posts.map((p) => (
            <Pressable key={p._id} style={styles.card} onPress={() => router.push({ pathname: '/trends/[slug]', params: { slug: p.slug } })}>
              {p.imageUrl ? <Image source={{ uri: p.imageUrl }} style={styles.cardImage} /> : <View style={[styles.cardImage, styles.placeholder]} />}
              <View style={styles.cardContent}>
                <Text style={styles.category}>{p.category}</Text>
                <Text style={styles.cardTitle} numberOfLines={2}>{p.title}</Text>
                <Text style={styles.cardExcerpt} numberOfLines={2}>{p.excerpt}</Text>
                {p.publishedAt && <Text style={styles.date}>{new Date(p.publishedAt).toLocaleDateString('en-NG')}</Text>}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { paddingBottom: 24 },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  categories: { marginBottom: 16 },
  categoriesContent: { paddingHorizontal: 20, gap: 8, flexDirection: 'row', paddingRight: 40 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#e2e8f0', marginRight: 8 },
  chipActive: { backgroundColor: '#0d9488' },
  chipText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  loading: { paddingVertical: 40, alignItems: 'center' },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { color: '#64748b' },
  list: { paddingHorizontal: 20, gap: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  cardImage: { width: '100%', aspectRatio: 16 / 9 },
  placeholder: { backgroundColor: '#e2e8f0' },
  cardContent: { padding: 14 },
  category: { fontSize: 12, fontWeight: '600', color: '#0d9488' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginTop: 4 },
  cardExcerpt: { fontSize: 14, color: '#64748b', marginTop: 4 },
  date: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
});
