import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Digit Properties' }} />
      <Stack.Screen name="listings/index" options={{ title: 'Listings' }} />
    </Stack>
  );
}
