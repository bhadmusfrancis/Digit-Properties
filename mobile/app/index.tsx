import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Link } from 'expo-router';

const WEB_APP_URL = (typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_APP_URL) || 'https://digitproperties.com';

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
      <Pressable
        style={[styles.button, styles.buttonSecondary]}
        onPress={() => Linking.openURL(WEB_APP_URL + '/listings/new')}
      >
        <Text style={styles.buttonText}>Create Listing</Text>
      </Pressable>
      <Text style={styles.note}>
        Create listing opens the web form with address autocomplete, GPS, map picker, camera upload, and title generator.
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
    marginTop: 16,
    backgroundColor: '#0ea5e9',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonSecondary: {
    backgroundColor: '#0d9488',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  note: {
    marginTop: 32,
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});
