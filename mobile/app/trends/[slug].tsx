import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getApiUrl } from '../../lib/api';

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
      {post.imageUrl && (
        <Image source={{ uri: post.imageUrl }} style={styles.image} resizeMode="cover" />
      )}
      {post.excerpt ? <Text style={styles.excerpt}>{post.excerpt}</Text> : null}
      <Text style={styles.body}>{post.content}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  notFound: { fontSize: 18, color: '#64748b' },
  backBtn: { marginTop: 16 },
  backBtnText: { fontSize: 16, color: '#0d9488', fontWeight: '600' },
  scroll: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 40 },
  backLink: { marginBottom: 12 },
  backLinkText: { fontSize: 14, color: '#0d9488', fontWeight: '500' },
  category: { fontSize: 13, fontWeight: '600', color: '#0d9488' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#0f172a', marginTop: 8 },
  meta: { fontSize: 14, color: '#64748b', marginTop: 8 },
  image: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, marginTop: 16, backgroundColor: '#f1f5f9' },
  excerpt: { fontSize: 17, color: '#475569', lineHeight: 26, marginTop: 16 },
  body: { fontSize: 16, color: '#334155', lineHeight: 26, marginTop: 16 },
});
