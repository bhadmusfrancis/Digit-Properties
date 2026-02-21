import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function EditListingScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const router = useRouter();
  if (!id) {
    router.back();
    return null;
  }
  return (
    <View style={styles.center}>
      <Text style={styles.msg}>Edit listing</Text>
      <Text style={styles.sub}>Open the listing and use the web app to edit with map and full form, or we can add an in-app edit form later.</Text>
      <Pressable style={styles.btn} onPress={() => router.push({ pathname: '/listings/[id]', params: { id } })}>
        <Text style={styles.btnText}>View listing</Text>
      </Pressable>
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>← Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  msg: { fontSize: 18, fontWeight: '600', color: '#0f172a', marginBottom: 8 },
  sub: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 20 },
  btn: { backgroundColor: '#0c4a6e', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '600' },
  backBtn: { marginTop: 16 },
  backBtnText: { color: '#64748b', fontSize: 15 },
});
