import { Stack } from 'expo-router';
import { COLORS } from '../src/constants/theme';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="home" />
      <Stack.Screen name="staff" />
      <Stack.Screen name="manager" />
    </Stack>
  );
}
