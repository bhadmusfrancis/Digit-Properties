import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../contexts/AuthContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="listings/index" />
          <Stack.Screen name="listings/new" />
          <Stack.Screen name="listings/[id]" />
          <Stack.Screen name="listings/[id]/edit" />
          <Stack.Screen name="auth/signin" options={{ title: 'Sign in' }} />
          <Stack.Screen name="auth/signup" options={{ title: 'Sign up' }} />
          <Stack.Screen name="dashboard/listings" />
          <Stack.Screen name="dashboard/claims" />
          <Stack.Screen name="admin/users" />
          <Stack.Screen name="admin/users/[id]/edit" />
          <Stack.Screen name="admin/listings" />
          <Stack.Screen name="admin/claims" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
