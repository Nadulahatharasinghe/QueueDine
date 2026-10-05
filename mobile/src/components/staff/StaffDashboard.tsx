import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Dashboard } from '../../services/staffData';
import { StaffShell, Button, Card, Chip, Feedback, go, ui, useStaffResource, burgundy, tones } from './StaffUI';

export default function StaffDashboard() {
  const { data, loading, error, reload } = useStaffResource<Dashboard>('dashboard');
  return <StaffShell title="QueueDine" tab="dashboard" onRefresh={() => { void reload(); }} refreshing={loading}
    headerAction={<Pressable style={ui.headerButton} onPress={() => go('notifications')} accessibilityRole="button" accessibilityLabel="Notifications"><Text style={{ color: burgundy, fontSize: 23 }}>♧{data?.unread ? '•' : ''}</Text></Pressable>}>
    <Feedback loading={loading} error={error} retry={() => { void reload(); }} />
    {data && <>
      <Text style={ui.muted}>{data.restaurant?.name || 'Restaurant'} · Staff service tools</Text>
      <Pressable onPress={() => go('profile')} accessibilityRole="button" accessibilityLabel="Staff profile" style={ui.row}>
        <View style={styles.avatar}><Text style={styles.initial}>{data.user.fullName.split(' ').map(n => n[0]).slice(0, 2).join('')}</Text></View>
        <View style={ui.grow}><Text style={ui.muted}>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},</Text><Text style={styles.name}>{data.user.fullName.split(' ')[0]}</Text></View>
      </Pressable>
      <View style={ui.row}><Chip value={data.user.onDuty ? 'on duty' : 'off duty'} /><Text style={ui.muted}>{new Date().toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text></View>
      <View style={styles.metrics}>{(['available', 'occupied', 'reserved', 'cleaning'] as const).map(status => <Pressable key={status} onPress={() => go('tables', { status })} accessibilityRole="button" style={[styles.metric, { backgroundColor: tones[status].background }]}><Text style={[styles.number, { color: tones[status].color }]}>{data.tables.filter(t => t.status === status).length}</Text><Text style={ui.muted}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text></Pressable>)}</View>
      <View style={styles.metrics}><View style={styles.metric}><Text style={styles.number}>{data.waiting}</Text><Text style={ui.muted}>Waiting Parties</Text></View><View style={styles.metric}><Text style={styles.number}>{data.estimate} min</Text><Text style={ui.muted}>Estimated Wait</Text></View></View>
      <Button title="＋ Add Walk-in" onPress={() => go('add-walk-in')} />
      <Button title="▦ New Reservation" onPress={() => go('new-reservation')} secondary />
      {data.next && <Pressable onPress={() => go('party', { id: data.next!._id })} accessibilityRole="button"><Card><Text style={ui.label}>NEXT PARTY</Text><Text style={ui.heading}>{data.next.customerName}</Text><Text style={ui.muted}>{data.next.number} · {data.next.partySize} guests</Text><Chip value={data.next.status} /></Card></Pressable>}
    </>}
  </StaffShell>;
}
const styles = StyleSheet.create({
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#F3E5E8', alignItems: 'center', justifyContent: 'center' },
  initial: { color: burgundy, fontSize: 16, fontWeight: '700' }, name: { fontSize: 23, fontWeight: '700', color: '#151D2E' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  metric: { width: '48%', padding: 18, borderRadius: 12, gap: 6, backgroundColor: '#FAFAFC' }, number: { fontSize: 24, fontWeight: '700', color: burgundy },
});
