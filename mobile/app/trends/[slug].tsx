import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getApiUrl } from '../../lib/api';
import { TrendHtmlBody } from '../../components/TrendHtmlBody';

type Post = {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  imageUrl?: string;
  author?: string;
  publishedAt?: string;
  sourceUrls?: string[];
};

export default function TrendPostScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    fetch(getApiUrl(`trends/${slug}`))
      .then((r) => (r.ok ? r.json() : null))
      .then(setPost)
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (!slug || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>Post not found</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.backLink}>
        <Text style={styles.backLinkText}>← Trends</Text>
      </Pressable>
      <Text style={styles.category}>{post.category}</Text>
      <Text style={styles.title}>{post.title}</Text>
      {(post.author || post.publishedAt) && (
        <Text style={styles.meta}>
          {post.author}
          {post.author && post.publishedAt && ' · '}
          {post.publishedAt && new Date(post.publishedAt).toLocaleDateString('en-NG', { dateStyle: 'long' })}
        </Text>
      )}
      {post.imageUrl ? (
        <Image source={{ uri: post.imageUrl }} style={styles.image} resizeMode="cover" />
      ) : null}
      {post.excerpt ? <Text style={styles.excerpt}>{post.excerpt}</Text> : null}
      <TrendHtmlBody html={post.content} />
      {Array.isArray(post.sourceUrls) && post.sourceUrls.length > 0 ? (
        <View style={styles.sources}>
          <Text style={styles.sourcesTitle}>Sources</Text>
          {post.sourceUrls.map((url) => (
            <Text key={url} style={styles.sourceUrl} numberOfLines={2}>
              {url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  notFound: { fontSize: 18, color: '#64748b' },
  backBtn: { marginTop: 16 },
  backBtnText: { fontSize: 16, color: '#0d9488', fontWeight: '600' },
  scroll: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 48 },
  backLink: { marginBottom: 12 },
  backLinkText: { fontSize: 14, color: '#0d9488', fontWeight: '500' },
  category: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '700',
    color: '#0f766e',
    backgroundColor: '#ccfbf1',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  title: { fontSize: 26, fontWeight: 'bold', color: '#0f172a', marginTop: 12, lineHeight: 34 },
  meta: { fontSize: 14, color: '#64748b', marginTop: 10 },
  image: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, marginTop: 16, backgroundColor: '#f1f5f9' },
  excerpt: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 25,
    marginTop: 16,
    marginBottom: 4,
    paddingLeft: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#5eead4',
  },
  sources: {
    marginTop: 24,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
  },
  sourcesTitle: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6 },
  sourceUrl: { marginTop: 8, fontSize: 13, color: '#0d9488', fontWeight: '500' },
});
