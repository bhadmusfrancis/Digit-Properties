import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../contexts/AuthContext';
import { SavedProvider } from '../contexts/SavedContext';
import { colors } from '../lib/theme';
import { useApplyOtaUpdate } from '../lib/apply-ota-update';

export default function RootLayout() {
  useApplyOtaUpdate();
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SavedProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="listings/index" />
            <Stack.Screen name="listings/new" />
            <Stack.Screen name="listings/[id]" />
            <Stack.Screen name="listings/[id]/edit" />
            <Stack.Screen name="messages/index" />
            <Stack.Screen name="messages/[conversationId]" />
            <Stack.Screen name="messages/listing/[listingId]" />
            <Stack.Screen name="auth/signin" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="auth/signup" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="auth/verify-required" />
            <Stack.Screen name="dashboard/claims" />
            <Stack.Screen name="admin/users" />
            <Stack.Screen name="admin/users/[id]/edit" />
            <Stack.Screen name="admin/listings" />
            <Stack.Screen name="admin/claims" />
            <Stack.Screen name="trends/index" />
            <Stack.Screen name="trends/[slug]" />
            <Stack.Screen name="settings/delete-account" />
          </Stack>
        </SavedProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
