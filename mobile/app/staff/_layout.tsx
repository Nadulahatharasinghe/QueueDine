import { Stack } from 'expo-router';
import { useStaffSession } from '../../src/services/staffAuth';

export default function StaffLayout() {
  const staff = useStaffSession();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!staff}><Stack.Screen name="login" /></Stack.Protected>
      <Stack.Protected guard={!!staff}>
        {['index', 'dashboard', 'queue', 'add-walk-in', 'party', 'reservations', 'new-reservation', 'tables', 'table', 'assign-table', 'send-alert', 'no-show', 'table-updated', 'activity', 'notifications', 'profile', 'settings', 'shift', 'help'].map(name => <Stack.Screen key={name} name={name} />)}
      </Stack.Protected>
    </Stack>
  );
}
