import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Digit Properties' }} />
        <Stack.Screen name="listings/index" options={{ title: 'Listings' }} />
        <Stack.Screen name="auth/signin" options={{ title: 'Sign in' }} />
        <Stack.Screen name="auth/signup" options={{ title: 'Sign up' }} />
        <Stack.Screen name="dashboard" options={{ title: 'Dashboard' }} />
        <Stack.Screen name="dashboard/listings" options={{ title: 'My Listings' }} />
        <Stack.Screen name="dashboard/claims" options={{ title: 'My Claims' }} />
      </Stack>
    </AuthProvider>
  );
}
