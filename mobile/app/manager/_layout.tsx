import React, { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useStaffSession } from '../../src/services/staffAuth';
import { burgundy } from '../../src/components/manager/ManagerUI';

export default function ManagerLayout() {
  const staff = useStaffSession();

  useEffect(() => {
    // If not authenticated, send to staff login
    if (!staff) {
      router.replace('/staff/login');
      return;
    }
    // If authenticated as non-manager (e.g. host), send to staff dashboard
    if (staff.role !== 'manager') {
      router.replace('/staff/dashboard');
    }
  }, [staff]);

  if (!staff || staff.role !== 'manager') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={burgundy} />
        <Text style={styles.loadingText}>Verifying manager access...</Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FAFAFC' } }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="operations" />
      <Stack.Screen name="analytics" />
      <Stack.Screen name="queue-analytics" />
      <Stack.Screen name="walkaways-analytics" />
      <Stack.Screen name="reservations" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="daily-report" />
      <Stack.Screen name="report-history" />
      <Stack.Screen name="date-range" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFC',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#697386',
  },
});
