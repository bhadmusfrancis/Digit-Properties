import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Link } from 'expo-router';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Digit Properties</Text>
      <Text style={styles.subtitle}>Find your dream property in Nigeria</Text>
      <Link href="/listings" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Browse Listings</Text>
        </Pressable>
      </Link>
      <Text style={styles.note}>
        Mobile app — connect to web API at NEXT_PUBLIC_APP_URL for full functionality
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f9fafb',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  button: {
    marginTop: 32,
    backgroundColor: '#0ea5e9',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  note: {
    marginTop: 48,
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
