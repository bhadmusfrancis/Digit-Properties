import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

export default function NewListingScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Listing</Text>
      <Text style={styles.body}>
        To create and manage listings, sign in on the Digit Properties website. The app and website share the same
        backend, so listings you create on the web will appear here.
      </Text>
      <Text style={styles.body}>
        Use this app to browse listings and view details. Full listing creation with address search, map picker,
        and photo upload is available on the web.
      </Text>
      <Pressable style={styles.button} onPress={() => router.back()}>
        <Text style={styles.buttonText}>← Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 16 },
  body: { fontSize: 16, color: '#4b5563', lineHeight: 24, marginBottom: 16 },
  button: {
    marginTop: 24,
    backgroundColor: '#0ea5e9',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 16 },
});
