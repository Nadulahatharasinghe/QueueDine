import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  Dashboard,
  EditableStaffRestaurant,
  Party,
  StaffEvent,
  StaffTable,
  deleteStaffRestaurantPhoto,
  getStaffRestaurantPhoto,
  patchStaffData,
  postStaffData,
  putStaffRestaurantPhoto,
  putStaffData,
  requestKey,
} from '../../services/staffData';
import { StaffProfile, signOutStaff, updateStaff, useStaffSession } from '../../services/staffAuth';
import { photoUri } from '../../services/restaurantService';
import { StaffShell, Button, Card, Chip, Empty, Feedback, Field, Filters, PartySize, Search, back, burgundy, elapsed, go, time, tones, ui, useClock, useMutation, useStaffResource } from './StaffUI';

type NativeFilePart = { uri: string; name: string; type: string };
type NativeFormData = FormData & { append(name: string, value: NativeFilePart): void };
const photoMimeTypes: Record<string, { extension: string; mimeType: string }> = {
  'image/jpeg': { extension: 'jpg', mimeType: 'image/jpeg' },
  'image/jpg': { extension: 'jpg', mimeType: 'image/jpeg' },
  'image/png': { extension: 'png', mimeType: 'image/png' },
  'image/webp': { extension: 'webp', mimeType: 'image/webp' },
};
const photoExtensions: Record<string, { extension: string; mimeType: string }> = {
  jpg: photoMimeTypes['image/jpeg'],
  jpeg: photoMimeTypes['image/jpeg'],
  png: photoMimeTypes['image/png'],
  webp: photoMimeTypes['image/webp'],
};
const closed = (p: Party) => ['seated', 'cancelled', 'no-show'].includes(p.status);
const matches = (p: Party, q: string) => `${p.customerName} ${p.number} ${p.mobileNumber}`.toLowerCase().includes(q.toLowerCase());
function PartyRow({ party }: { party: Party }) {
  return <Pressable accessibilityRole="button" onPress={() => go('party', { id: party._id })}><Card><View style={ui.row}><View style={styles.person}><Text style={styles.personText}>{party.customerName[0]}</Text></View><View style={ui.grow}><Text style={ui.heading}>{party.customerName}</Text><Text style={ui.muted}>{party.number} · {party.partySize} people · {party.kind === 'queue' ? elapsed(party.createdAt) : time(party.bookingAt)}</Text></View><Chip value={party.status} /><Text style={ui.muted}>›</Text></View></Card></Pressable>;
}
export function QueueScreen() {
  const resource = useStaffResource<Party[]>('parties?kind=queue');
  const [filter, setFilter] = useState('All'), [search, setSearch] = useState('');
  const shown = resource.data?.filter(p => matches(p, search) && (filter === 'All' ? !['cancelled', 'no-show'].includes(p.status) : filter === 'Waiting' ? ['waiting', 'almost-ready'].includes(p.status) : filter === 'Ready' ? p.status === 'ready' : p.status === 'seated')) || [];
  return <StaffShell title={`Live Queue${resource.data ? ` (${resource.data.filter(p => !closed(p)).length})` : ''}`} tab="queue" onRefresh={() => { void resource.reload(); }} footer={<Button title="＋ Add Walk-in" onPress={() => go('add-walk-in')} />}>
    <Search value={search} onChangeText={setSearch} /><Filters items={['All', 'Waiting', 'Ready', 'Seated']} selected={filter} onSelect={setFilter} />
    <Feedback {...resource} retry={() => { void resource.reload(); }} />{shown.map(p => <PartyRow key={p._id} party={p} />)}
    {!resource.loading && !resource.error && !shown.length && <Empty title="No parties in this view" detail="Add a walk-in or choose another filter." />}
  </StaffShell>;
}
export function ReservationsScreen() {
  const resource = useStaffResource<Party[]>('parties?kind=reservation');
  const [filter, setFilter] = useState('Today'), [search, setSearch] = useState('');
  const now = useClock();
  const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
  const shown = resource.data?.filter(p => matches(p, search) && (filter === 'Past' ? closed(p) : !closed(p) && (filter === 'Today' ? new Date(p.bookingAt!).toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' }) === today : new Date(p.bookingAt!).getTime() >= now))) || [];
  return <StaffShell title="Reservations" tab="reservations" onRefresh={() => { void resource.reload(); }} footer={<Button title="＋ New Reservation" onPress={() => go('new-reservation')} />}>
    <Search value={search} onChangeText={setSearch} /><Filters items={['Today', 'Upcoming', 'Past']} selected={filter} onSelect={setFilter} />
    <Feedback {...resource} retry={() => { void resource.reload(); }} />{shown.map(p => <PartyRow key={p._id} party={p} />)}
    {!resource.loading && !resource.error && !shown.length && <Empty title="No reservations in this view" detail="New reservations will appear here after saving." />}
  </StaffShell>;
}
export function PartyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const resource = useStaffResource<Party>(`parties/${encodeURIComponent(id || '')}`);
  const mutation = useMutation(), [confirmCancel, setConfirmCancel] = useState(false);
  const p = resource.data;
  const change = (action: string) => { void mutation.run(async () => { await patchStaffData(`parties/${id}`, { action }); await resource.reload(); setConfirmCancel(false); }); };
  const contact = () => { if (p) void mutation.run(async () => { const url = `tel:${p.mobileNumber.replace(/[^+\d]/g, '')}`; if (!await Linking.canOpenURL(url)) throw new Error('Calling is not available on this device. Use the displayed mobile number.'); await Linking.openURL(url); }); };
  return <StaffShell title={p?.kind === 'reservation' ? 'Reservation Details' : 'Queue Details'}>
    <Feedback {...resource} retry={() => { void resource.reload(); }} />
    {p && <><Card><Text style={[ui.label, { color: burgundy }]}>{p.number}</Text><Text style={styles.largeTitle}>{p.customerName}</Text><Chip value={p.status} /><Text style={ui.muted}>{p.partySize} guests · {p.mobileNumber}</Text>{p.bookingAt && <Text style={ui.muted}>{new Date(p.bookingAt).toLocaleString()}</Text>}<Text style={ui.muted}>{p.specialRequests || 'No special requests'}</Text></Card>
      {!closed(p) && <>
        {p.kind === 'reservation' && p.status === 'upcoming' && <Button title="Mark as Arrived" busy={mutation.busy} onPress={() => change('arrived')} />}
        <Button title="Assign Table" onPress={() => go('assign-table', { id: p._id })} />
        <Button title="Send Table Ready Alert" secondary onPress={() => go('send-alert', { id: p._id })} />
        <Button title="Modify Details" secondary onPress={() => go(p.kind === 'reservation' ? 'new-reservation' : 'add-walk-in', { id: p._id })} />
        {p.kind === 'reservation' && <Button title="No-Show Handling" secondary onPress={() => go('no-show', { id: p._id })} />}
        {confirmCancel ? <Card><Text style={ui.heading}>Cancel this customer entry?</Text><Text style={ui.muted}>Any reserved table hold will be released.</Text><Button title="Confirm Cancellation" danger busy={mutation.busy} onPress={() => change('cancel')} /><Button title="Keep Entry" secondary onPress={() => setConfirmCancel(false)} /></Card> : <Button title="Cancel Entry" danger onPress={() => setConfirmCancel(true)} />}
      </>}
      <Button title="Contact Customer" secondary onPress={contact} />
      <Button title="View Activity" secondary onPress={() => go('activity', { partyId: p._id })} />
    </>}<Feedback error={mutation.error} />
  </StaffShell>;
}
export function ReservationFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [name, setName] = useState(''), [phone, setPhone] = useState(''), [size, setSize] = useState(4), [notes, setNotes] = useState('');
  const [date, setDate] = useState(''), [hour, setHour] = useState('');
  const [initialized, setInitialized] = useState(false);
  const source = useStaffResource<Party>(id ? `parties/${id}` : 'me', false, p => {
      if (!id || initialized) return;
      setName(p.customerName); setPhone(p.mobileNumber); setSize(p.partySize); setNotes(p.specialRequests);
      const d = new Date(new Date(p.bookingAt!).getTime() + 330 * 60000);
      setDate(d.toISOString().slice(0, 10)); setHour(d.toISOString().slice(11, 16)); setInitialized(true);
  });
  const key = useRef(requestKey()), mutation = useMutation();
  const save = () => { void mutation.run(async () => {
    if (!name.trim() || !phone.trim()) throw new Error('Enter a customer name and mobile number.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hour)) throw new Error('Enter a date as YYYY-MM-DD and time as HH:MM.');
    const when = new Date(`${date}T${hour}:00+05:30`);
    if (!Number.isFinite(when.getTime()) || when.getTime() < Date.now()) throw new Error('Choose a future reservation time.');
    if (new Date(when.getTime() + 330 * 60000).toISOString().slice(0, 16) !== `${date}T${hour}`) throw new Error('Enter a valid calendar date.');
    const body = { customerName: name, mobileNumber: phone, partySize: size, specialRequests: notes, kind: 'reservation', bookingAt: when.toISOString() };
    if (id) await patchStaffData(`parties/${id}`, { ...body, action: 'edit' });
    else await postStaffData('parties', body, key.current);
    router.replace('/staff/reservations');
  }); };
  return <StaffShell title={id ? 'Modify Reservation' : 'New Reservation'} footer={<Button title={id ? 'Save Changes' : 'Create Reservation'} busy={mutation.busy} disabled={!!id && !initialized} onPress={save} />}>
    {id && <Feedback loading={source.loading} error={source.error} retry={() => { void source.reload(); }} />}
    <Field label="CUSTOMER NAME" value={name} onChangeText={setName} placeholder="Enter customer name" /><PartySize value={size} onChange={setSize} />
    <Field label="MOBILE NUMBER" value={phone} onChangeText={setPhone} placeholder="e.g. +94 77 123 4567" phone />
    <Field label="DATE (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
    <Field label="TIME (24-HOUR HH:MM)" value={hour} onChangeText={setHour} placeholder="e.g. 19:00" />
    <Text style={ui.muted}>Booking times use Sri Lanka time (Asia/Colombo).</Text>
    <Field label="SPECIAL REQUESTS (OPTIONAL)" value={notes} onChangeText={setNotes} multiline placeholder="e.g. window seat" /><Feedback error={mutation.error} />
  </StaffShell>;
}
export function TablesScreen() {
  const { status: initialStatus } = useLocalSearchParams<{ status?: string }>();
  const resource = useStaffResource<StaffTable[]>('tables');
  const [area, setArea] = useState('Main Area'), [filter, setFilter] = useState(initialStatus ? initialStatus.charAt(0).toUpperCase() + initialStatus.slice(1) : 'All');
  const shown = resource.data?.filter(t => t.area === area && (filter === 'All' || t.status === filter.toLowerCase())) || [];
  return <StaffShell title="Tables" tab="tables" onRefresh={() => { void resource.reload(); }}>
    <View style={styles.legend}>{['available', 'occupied', 'reserved', 'cleaning'].map(s => <View key={s} style={ui.row}><View style={[styles.dot, { backgroundColor: tones[s].color }]} /><Text style={styles.legendText}>{s}</Text></View>)}</View>
    <Filters items={['Main Area', 'Outdoor']} selected={area} onSelect={setArea} /><Filters items={['All', 'Available', 'Occupied', 'Reserved', 'Cleaning']} selected={filter} onSelect={setFilter} />
    <Feedback {...resource} retry={() => { void resource.reload(); }} />
    <View style={styles.tableGrid}>{shown.map(t => <Pressable key={t._id} style={[styles.tableTile, { backgroundColor: tones[t.status].background, borderColor: tones[t.status].border }]} onPress={() => go('table', { id: t._id })} accessibilityRole="button" accessibilityLabel={`${t.number}, ${t.capacity} seats, ${t.status}`}><Text style={ui.heading}>{t.number}</Text><Text style={styles.legendText}>{t.capacity} seats</Text><Text style={[styles.legendText, { color: tones[t.status].color }]}>{t.status}</Text></Pressable>)}</View>
    {!resource.loading && !resource.error && !shown.length && <Empty title="No tables in this view" detail="Choose another area or status. Your manager can configure the table layout." />}
  </StaffShell>;
}
export function TableScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const resource = useStaffResource<StaffTable>(`tables/${id}`), mutation = useMutation(); const t = resource.data;
  const change = (status: string) => { void mutation.run(async () => { const result = await patchStaffData<StaffTable>(`tables/${id}`, { status }); go('table-updated', { table: result.number, status: result.status, id: result._id }); }); };
  return <StaffShell title={t ? `Table ${t.number}` : 'Table Details'}><Feedback {...resource} retry={() => { void resource.reload(); }} />
    {t && <><View style={styles.tableHero}><Text style={styles.heroNumber}>{t.number}</Text><Text style={ui.muted}>{t.capacity} seats · {t.area}</Text></View><Card><Text style={ui.label}>CURRENT STATUS</Text><Chip value={t.status} /></Card>
      <Button title="Mark as Occupied" secondary busy={mutation.busy} disabled={t.status !== 'available'} onPress={() => change('occupied')} />
      <Button title="Mark as Reserved" secondary onPress={() => go('assign-table', { tableId: t._id, mode: 'hold' })} disabled={t.status !== 'available'} />
      <Button title="Mark as Cleaning" secondary busy={mutation.busy} disabled={t.status === 'reserved' || t.status === 'cleaning'} onPress={() => change('cleaning')} />
      <Button title="Mark as Available" secondary busy={mutation.busy} disabled={t.status !== 'cleaning'} onPress={() => change('available')} />
      {t.partyId && <Button title="View Assigned Customer" secondary onPress={() => go('party', { id: t.partyId! })} />}
      <Button title="View Table History" secondary onPress={() => go('activity', { tableId: t._id })} />
    </>}<Feedback error={mutation.error} />
  </StaffShell>;
}
export function AssignScreen() {
  const { id, tableId, mode: initialMode } = useLocalSearchParams<{ id?: string; tableId?: string; mode?: string }>();
  const parties = useStaffResource<Party[]>('parties?kind=reservation'), queue = useStaffResource<Party[]>('parties?kind=queue'), tables = useStaffResource<StaffTable[]>('tables');
  const [selectedParty, setSelectedParty] = useState(id || ''), [selectedTable, setSelectedTable] = useState(tableId || ''), [mode, setMode] = useState(initialMode === 'hold' ? 'Hold Table' : 'Seat Now');
  const mutation = useMutation(); const p = [...(parties.data || []), ...(queue.data || [])].find(item => item._id === selectedParty);
  const available = tables.data?.filter(t => (t.status === 'available' || t.partyId === p?._id && t.status === 'reserved') && (!p || t.capacity >= p.partySize)) || [];
  const t = available.find(item => item._id === selectedTable);
  const assign = () => { void mutation.run(async () => {
    if (!p || !t) throw new Error('Select a customer and a suitable available table.');
    const result = await postStaffData<StaffTable>('assign', { partyId: p._id, tableId: t._id, mode: mode === 'Hold Table' ? 'hold' : 'seat' });
    go('table-updated', { table: result.number, status: result.status, id: result._id });
  }); };
  const choices = [...(parties.data || []), ...(queue.data || [])].filter(item => !closed(item) && (mode !== 'Hold Table' || item.kind === 'reservation'));
  return <StaffShell title="Assign Table" footer={<Button title={t ? `${mode === 'Hold Table' ? 'Hold' : 'Assign'} ${t.number}` : 'Select a Table'} busy={mutation.busy} disabled={!p || !t || closed(p)} onPress={assign} />}>
    <Feedback loading={parties.loading || queue.loading || tables.loading} error={parties.error || queue.error || tables.error} retry={() => { void parties.reload(); void queue.reload(); void tables.reload(); }} />
    {!id && <><Text style={ui.label}>SELECT CUSTOMER</Text>{choices.map(item => <Pressable key={item._id} accessibilityRole="button" onPress={() => setSelectedParty(item._id)}><Card><View style={ui.row}><View style={ui.grow}><Text style={ui.heading}>{item.customerName}</Text><Text style={ui.muted}>{item.number} · {item.partySize} guests</Text></View>{selectedParty === item._id && <Text style={ui.active}>✓</Text>}</View></Card></Pressable>)}{!parties.loading && !queue.loading && !choices.length && <Empty detail="Add a reservation or walk-in before assigning a table." />}</>}
    {p && <><Card><Text style={[ui.label, { color: burgundy }]}>{p.number}</Text><Text style={ui.heading}>{p.customerName}</Text><Text style={ui.muted}>{p.partySize} people · {p.kind === 'queue' ? `Waiting for ${elapsed(p.createdAt)}` : time(p.bookingAt)}</Text><Text style={ui.muted}>Special request: {p.specialRequests || 'None'}</Text></Card>
      {p.kind === 'reservation' && <><Filters items={['Seat Now', 'Hold Table']} selected={mode} onSelect={setMode} />{mode === 'Hold Table' && <Text style={ui.muted}>Hold expires 10 minutes after the booking time, or after now if the booking has already started.</Text>}</>}
      <Text style={ui.heading}>Available Tables</Text><View style={styles.tableGrid}>{available.map(item => <Pressable key={item._id} accessibilityRole="button" accessibilityState={{ selected: selectedTable === item._id }} onPress={() => setSelectedTable(item._id)} style={[styles.tableTile, { backgroundColor: '#E9F6EF', borderColor: selectedTable === item._id ? '#208064' : '#BCE0D0', borderWidth: selectedTable === item._id ? 2 : 1 }]}><Text style={ui.heading}>{item.number}</Text><Text style={ui.muted}>{item.capacity} seats</Text>{selectedTable === item._id && <Text style={{ color: '#208064' }}>✓</Text>}</Pressable>)}</View>
      {!tables.loading && !available.length && <Empty title="No suitable tables available" detail="Check again when a table becomes available." />}
    </>}<Feedback error={mutation.error} />
  </StaffShell>;
}
export function TableUpdatedScreen() {
  const { table, status, id } = useLocalSearchParams<{ table: string; status: string; id: string }>();
  return <StaffShell title="" footer={<Button title="Done" onPress={() => router.replace('/staff/tables')} />}><View style={styles.success}><View style={styles.successCircle}><Text style={styles.successCheck}>✓</Text></View><Text style={styles.largeTitle}>Table Updated!</Text><Text style={ui.muted}>Table {table} is now {status}.</Text><Button title="View Table" secondary onPress={() => router.replace({ pathname: '/staff/table', params: { id } })} /></View></StaffShell>;
}
export function AlertScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const resource = useStaffResource<Party>(`parties/${id}`), mutation = useMutation();
  const [stage, setStage] = useState('Table Ready'), [sent, setSent] = useState(false), key = useRef(requestKey()); const p = resource.data;
  const send = () => { void mutation.run(async () => { await postStaffData('alerts', { partyId: id, stage: stage === 'Almost Ready' ? 'almost-ready' : 'ready' }, key.current); setSent(true); }); };
  return <StaffShell title="Send Table Ready Alert" footer={sent ? <Button title="Done" onPress={() => back('queue')} /> : <><Button title="Send Alert" busy={mutation.busy} disabled={!p || closed(p)} onPress={send} /><Button title="Cancel" secondary onPress={() => back('queue')} /></>}>
    <Feedback {...resource} retry={() => { void resource.reload(); }} /><View style={styles.alertHero}><View style={styles.alertCircle}><Text style={{ color: burgundy, fontSize: 34 }}>{sent ? '✓' : '➤'}</Text></View><Text style={styles.largeTitle}>{sent ? 'Alert Recorded' : 'Notify Customer'}</Text><Text style={[ui.muted, { textAlign: 'center' }]}>{p?.customerName} ({p?.number})</Text></View>
    {!sent && <Filters items={['Table Ready', 'Almost Ready']} selected={stage} onSelect={value => { setStage(value); key.current = requestKey(); }} />}
    <Card><Text style={ui.muted}>Hi {p?.customerName || 'there'}, {stage === 'Table Ready' ? 'your table is ready. Please return to the host stand.' : 'your table will be ready shortly. Please stay nearby.'}</Text></Card>
    <Feedback error={mutation.error} />
  </StaffShell>;
}
export function NoShowScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const resource = useStaffResource<Party>(`parties/${id}`), mutation = useMutation(), [confirm, setConfirm] = useState(false), now = useClock(); const p = resource.data;
  const remaining = p?.holdExpiresAt ? Math.max(0, Math.ceil((new Date(p.holdExpiresAt).getTime() - now) / 1000)) : 0;
  const change = (action: string) => { void mutation.run(async () => { await patchStaffData(`parties/${id}`, { action }); await resource.reload(); setConfirm(false); }); };
  return <StaffShell title="No-Show Handling"><Feedback {...resource} retry={() => { void resource.reload(); }} />
    {p && <><Card><Text style={[ui.label, { color: burgundy }]}>{p.number}</Text><Text style={ui.heading}>{p.customerName}</Text><Text style={ui.muted}>{p.partySize} people · {time(p.bookingAt)}</Text><Chip value={p.status} /></Card>
      <View style={styles.holdCard}><Text style={ui.muted}>Hold expires in</Text><Text style={styles.countdown}>{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</Text><Text style={ui.muted}>{remaining ? 'The reserved table will be released automatically.' : 'No active table hold.'}</Text></View>
      {!closed(p) && <><Button title="Extend Hold (10 min)" secondary busy={mutation.busy} disabled={!remaining} onPress={() => change('extend')} />
        {!p.tableId && <Button title="Create Table Hold" secondary onPress={() => go('assign-table', { id, mode: 'hold' })} />}
        <Button title="Contact Customer" secondary onPress={() => { void mutation.run(async () => { const url = `tel:${p.mobileNumber.replace(/[^+\d]/g, '')}`; if (!await Linking.canOpenURL(url)) throw new Error('Calling is not available on this device. Use the displayed mobile number.'); await Linking.openURL(url); }); }} /><Text style={ui.muted}>{p.mobileNumber}</Text>
        {confirm ? <Card><Text style={ui.heading}>Mark this reservation as a no-show?</Text><Button title="Confirm No-Show" danger busy={mutation.busy} onPress={() => change('no-show')} /><Button title="Keep Reservation" secondary onPress={() => setConfirm(false)} /></Card> : <Button title="Mark as No-Show" danger onPress={() => setConfirm(true)} />}
      </>}
    </>}<Feedback error={mutation.error} />
  </StaffShell>;
}
export function ActivityScreen() {
  const { tableId, partyId } = useLocalSearchParams<{ tableId?: string; partyId?: string }>();
  const resource = useStaffResource<StaffEvent[]>(`activity${tableId ? `?tableId=${encodeURIComponent(tableId)}` : partyId ? `?partyId=${encodeURIComponent(partyId)}` : ''}`), [filter, setFilter] = useState('All');
  const shown = resource.data?.filter(e => filter === 'All' || e.category === filter) || [];
  return <StaffShell title={tableId ? 'Table History' : 'Recent Activity'} onRefresh={() => { void resource.reload(); }}><Filters items={['All', 'Queue', 'Reservations', 'System']} selected={filter} onSelect={setFilter} /><Feedback {...resource} retry={() => { void resource.reload(); }} />
    {shown.map(e => <Card key={e._id}><Text style={ui.heading}>{e.message}</Text><Text style={ui.muted}>{time(e.createdAt)} · {new Date(e.createdAt).toLocaleDateString()} · {e.actorName || 'System'}</Text></Card>)}{!resource.loading && !resource.error && !shown.length && <Empty detail="Actions taken by staff will appear here." />}
  </StaffShell>;
}
export function NotificationsScreen() {
  const resource = useStaffResource<StaffEvent[]>('notifications'), mutation = useMutation(), [filter, setFilter] = useState('All');
  const shown = resource.data?.filter(n => filter === 'All' || n.category === filter) || [];
  return <StaffShell title="Notifications" tab="profile" onRefresh={() => { void resource.reload(); }}><Filters items={['All', 'Queue', 'Reservations', 'System']} selected={filter} onSelect={setFilter} /><Feedback {...resource} retry={() => { void resource.reload(); }} />
    {shown.map(n => <Pressable key={n._id} accessibilityRole="button" onPress={() => { void mutation.run(async () => { await patchStaffData(`notifications/${n._id}/read`, {}); await resource.reload(); if (n.partyId) go('party', { id: n.partyId }); else if (n.tableId) go('table', { id: n.tableId }); }); }}><Card><View style={ui.row}><View style={ui.grow}><Text style={[ui.heading, n.read && { fontWeight: '400' }]}>{n.message}</Text><Text style={ui.muted}>{elapsed(n.createdAt)} ago · {n.category}</Text></View>{!n.read && <View style={[styles.dot, { backgroundColor: burgundy }]} />}<Text style={ui.muted}>›</Text></View></Card></Pressable>)}
    {!resource.loading && !resource.error && !shown.length && <Empty detail="Queue, reservation, and table updates will appear here." />}<Feedback error={mutation.error} />
  </StaffShell>;
}
export function ProfileScreen() {
  const user = useStaffSession(), mutation = useMutation(), dash = useStaffResource<Dashboard>('dashboard'), [confirm, setConfirm] = useState(false);
  const restaurantResource = useStaffResource<EditableStaffRestaurant>('restaurant', false);
  const restaurantMutation = useMutation();
  const [restaurantForm, setRestaurantForm] = useState({
    name: '',
    description: '',
    location: '',
    cuisine: '',
    open: '',
    close: '',
  });
  const [restaurantSaved, setRestaurantSaved] = useState(false);
  const photoMutation = useMutation();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadPhoto = useCallback(async () => {
    try {
      const res = await getStaffRestaurantPhoto();
      setPhotoUrl(res.photoUrl || null);
    } catch {
      setPhotoUrl(null);
    } finally {
      setPhotoLoaded(true);
    }
  }, []);

  useEffect(() => { void loadPhoto(); }, [loadPhoto]);

  useEffect(() => {
    if (!restaurantResource.data) return;
    setRestaurantForm({
      name: restaurantResource.data.name,
      description: restaurantResource.data.description,
      location: restaurantResource.data.location,
      cuisine: restaurantResource.data.cuisine || '',
      open: restaurantResource.data.openingHours.open,
      close: restaurantResource.data.openingHours.close,
    });
  }, [restaurantResource.data]);

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 3000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const effectivePhotoUrl = photoUrl ?? dash.data?.restaurant?.photoUrl ?? null;

  const saveRestaurant = () => {
    void restaurantMutation.run(async () => {
      const saved = await putStaffData<EditableStaffRestaurant>('restaurant', {
        name: restaurantForm.name,
        description: restaurantForm.description,
        location: restaurantForm.location,
        cuisine: restaurantForm.cuisine,
        openingHours: { open: restaurantForm.open, close: restaurantForm.close },
      });
      setRestaurantForm({
        name: saved.name,
        description: saved.description,
        location: saved.location,
        cuisine: saved.cuisine || '',
        open: saved.openingHours.open,
        close: saved.openingHours.close,
      });
      setRestaurantSaved(true);
      void dash.reload();
      void restaurantResource.reload();
    });
  };

  const pickAndUpload = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted && permission.status !== 'granted') {
        throw new Error('Photo library permission is required to upload a photo.');
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.9,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      const suppliedMimeType = asset.mimeType?.toLowerCase();
      const extensionFromMime = suppliedMimeType ? photoMimeTypes[suppliedMimeType] : undefined;
      if (suppliedMimeType && !extensionFromMime) {
        throw new Error('Only JPG, JPEG, PNG, and WEBP images are allowed.');
      }
      const fileNameExtension = asset.fileName?.match(/\.([^.]+)$/)?.[1].toLowerCase();
      const uriExtension = asset.uri.match(/\.([^.\/?#]+)(?:[?#]|$)/)?.[1].toLowerCase();
      const imageType = extensionFromMime ||
        (fileNameExtension ? photoExtensions[fileNameExtension] : undefined) ||
        (uriExtension ? photoExtensions[uriExtension] : undefined);
      if (!imageType) {
        throw new Error('Only JPG, JPEG, PNG, and WEBP images are allowed.');
      }
      if (typeof asset.fileSize === 'number' && asset.fileSize > 5 * 1024 * 1024) {
        throw new Error('Photo exceeds the 5 MB limit.');
      }
      const form = new FormData();
      const fileName = fileNameExtension && photoExtensions[fileNameExtension]
        ? asset.fileName!
        : `photo-${Date.now()}.${imageType.extension}`;
      if (Platform.OS === 'web') {
        if (!asset.file) throw new Error('Unable to read the selected photo. Please choose it again.');
        form.append('photo', asset.file, fileName);
      } else {
        (form as NativeFormData).append('photo', {
          uri: asset.uri,
          name: fileName,
          type: imageType.mimeType,
        });
      }
      await photoMutation.run(async () => {
        const res = await putStaffRestaurantPhoto(form);
        setPhotoUrl(res.photoUrl || null);
        setSuccessMsg('Photo saved successfully.');
        setRemoveConfirm(false);
        void dash.reload();
      });
    } catch (cause: unknown) {
      photoMutation.run(async () => { throw cause; }).catch(() => undefined);
    }
  };

  const removePhoto = async () => {
    await photoMutation.run(async () => {
      await deleteStaffRestaurantPhoto();
      setPhotoUrl(null);
      setRemoveConfirm(false);
      setSuccessMsg('Photo removed.');
      void dash.reload();
    });
  };

  return <StaffShell title="" tab="profile" headerAction={<Pressable onPress={() => go('settings')} style={ui.headerButton} accessibilityRole="button" accessibilityLabel="Settings"><Text style={{ fontSize: 23, color: '#697386' }}>⚙</Text></Pressable>}>
    <View style={styles.profileHero}><View style={styles.profileAvatar}><Text style={styles.profileInitial}>{user?.fullName.split(' ').map(n => n[0]).slice(0, 2).join('')}</Text></View><Text style={styles.largeTitle}>{user?.fullName}</Text><Text style={ui.muted}>{user?.role === 'host' ? 'Host' : user?.role}</Text><Text style={ui.muted}>{dash.data?.restaurant?.name} · {dash.data?.restaurant?.location}</Text><Text style={styles.legendText}>Powered by QueueDine</Text></View>

    <Card>
      <Text style={ui.label}>RESTAURANT INFORMATION</Text>
      {restaurantResource.loading ? <ActivityIndicator color={burgundy} /> : null}
      <Feedback error={restaurantResource.error} retry={() => { void restaurantResource.reload(); }} />
      {restaurantResource.data ? <>
        <Field label="RESTAURANT NAME" value={restaurantForm.name} onChangeText={name => { setRestaurantSaved(false); setRestaurantForm(value => ({ ...value, name })); }} />
        <Field label="LOCATION" value={restaurantForm.location} onChangeText={location => { setRestaurantSaved(false); setRestaurantForm(value => ({ ...value, location })); }} />
        <Field label="DESCRIPTION" value={restaurantForm.description} multiline onChangeText={description => { setRestaurantSaved(false); setRestaurantForm(value => ({ ...value, description })); }} />
        <Field label="CUISINE" value={restaurantForm.cuisine} onChangeText={cuisine => { setRestaurantSaved(false); setRestaurantForm(value => ({ ...value, cuisine })); }} />
        <Field label="OPENING TIME (HH:MM)" value={restaurantForm.open} placeholder="11:00" onChangeText={open => { setRestaurantSaved(false); setRestaurantForm(value => ({ ...value, open })); }} />
        <Field label="CLOSING TIME (HH:MM)" value={restaurantForm.close} placeholder="23:00" onChangeText={close => { setRestaurantSaved(false); setRestaurantForm(value => ({ ...value, close })); }} />
        <Button title="Save Restaurant Information" busy={restaurantMutation.busy} disabled={restaurantMutation.busy} onPress={saveRestaurant} />
        {restaurantSaved && <Text style={{ color: '#208064' }}>Restaurant information saved.</Text>}
      </> : null}
      <Feedback error={restaurantMutation.error} />
    </Card>

    <Card>
      <Text style={ui.label}>RESTAURANT PHOTO</Text>
      <View style={{ borderRadius: 14, backgroundColor: '#F4F5F7', borderWidth: 1, borderColor: '#E4E7EC', overflow: 'hidden', marginBottom: 12 }}>
        {!photoLoaded ? (
          <ActivityIndicator color={burgundy} style={{ height: 160 }} />
        ) : effectivePhotoUrl ? (
          <View style={{ position: 'relative' }}>
            <Image
              source={{ uri: photoUri(effectivePhotoUrl) || undefined }}
              style={{ width: '100%', height: 160 }}
              resizeMode="cover"
              onError={() => setPhotoUrl(null)}
            />
            {photoMutation.busy && (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' }]}>
                <ActivityIndicator color={burgundy} />
              </View>
            )}
          </View>
        ) : (
          <View style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={ui.muted}>No photo uploaded</Text>
          </View>
        )}
      </View>
      {successMsg ? <Text style={{ color: '#208064', marginBottom: 12, fontSize: 13 }}>{successMsg}</Text> : null}
      {effectivePhotoUrl ? (
        <View style={{ gap: 10 }}>
          <Button title="Change Photo" secondary busy={photoMutation.busy} disabled={photoMutation.busy} onPress={() => { void pickAndUpload(); }} />
          {!removeConfirm ? (
            <Button title="Remove Photo" secondary danger busy={photoMutation.busy} disabled={photoMutation.busy} onPress={() => setRemoveConfirm(true)} />
          ) : (
            <Card>
              <View style={{ backgroundColor: '#FFF1F2', borderColor: '#F0CED5', borderWidth: 1, borderRadius: 12, padding: 12 }}>
                <Text style={ui.heading}>Remove the restaurant photo?</Text>
                <Text style={ui.muted}>Customers will see a placeholder instead.</Text>
                <View style={{ height: 12 }} />
                <Button title="Confirm Removal" danger busy={photoMutation.busy} onPress={() => { void removePhoto(); }} />
                <View style={{ height: 10 }} />
                <Button title="Keep Photo" secondary onPress={() => setRemoveConfirm(false)} />
              </View>
            </Card>
          )}
        </View>
      ) : (
        <Button title="Upload Photo" busy={photoMutation.busy} disabled={photoMutation.busy} onPress={() => { void pickAndUpload(); }} />
      )}
      <Feedback error={photoMutation.error} />
    </Card>

    {[['shift', '▦', 'Shift Details'], ['settings', '⚙', 'Settings'], ['activity', '◷', 'Recent Activity'], ['notifications', '♧', 'Notifications'], ['help', '?', 'Help & Support']].map(([screen, icon, label]) => <Pressable key={screen} onPress={() => go(screen)} accessibilityRole="button"><Card><View style={ui.row}><Text style={{ fontSize: 21, color: '#697386' }}>{icon}</Text><Text style={[ui.heading, ui.grow, { fontWeight: '400' }]}>{label}</Text><Text style={ui.muted}>›</Text></View></Card></Pressable>)}
    {confirm ? <Card><Text style={ui.heading}>Sign out of the staff portal?</Text><Button title="Confirm Logout" busy={mutation.busy} onPress={() => { void mutation.run(async () => { await signOutStaff(); }); }} /><Button title="Stay Signed In" secondary onPress={() => setConfirm(false)} /></Card> : <Button title="Logout" secondary onPress={() => setConfirm(true)} />}<Feedback error={mutation.error} />
  </StaffShell>;
}
export function SettingsScreen() {
  const user = useStaffSession(), mutation = useMutation(), [name, setName] = useState(user?.fullName || ''), [saved, setSaved] = useState(false);
  const change = (body: Record<string, unknown>) => { void mutation.run(async () => { updateStaff(await patchStaffData<StaffProfile>('me', body)); setSaved(true); }); };
  return <StaffShell title="Settings"><Field label="FULL NAME" value={name} onChangeText={value => { setName(value); setSaved(false); }} /><Button title="Save Name" busy={mutation.busy} onPress={() => change({ fullName: name })} />
    <Card><View style={ui.row}><Text style={[ui.heading, ui.grow]}>Queue alerts</Text><Switch accessibilityLabel="Queue alerts" value={user?.settings?.queueAlerts ?? true} disabled={mutation.busy} trackColor={{ true: '#B56573' }} onValueChange={value => change({ queueAlerts: value })} /></View></Card>
    <Card><View style={ui.row}><Text style={[ui.heading, ui.grow]}>Reservation alerts</Text><Switch accessibilityLabel="Reservation alerts" value={user?.settings?.reservationAlerts ?? true} disabled={mutation.busy} trackColor={{ true: '#B56573' }} onValueChange={value => change({ reservationAlerts: value })} /></View></Card>
    <Text style={ui.muted}>Alert preferences control the categories shown in your notification inbox. System updates always remain visible.</Text>{saved && <Text style={{ color: '#208064' }}>Changes saved.</Text>}<Feedback error={mutation.error} />
  </StaffShell>;
}
export function ShiftScreen() {
  const user = useStaffSession(), mutation = useMutation();
  return <StaffShell title="Shift Details"><Card><Text style={ui.label}>STAFF MEMBER</Text><Text style={ui.heading}>{user?.fullName}</Text><Text style={ui.muted}>{user?.staffId}</Text><Text style={ui.muted}>Shift: {user?.shiftStart || 'Not scheduled'} — {user?.shiftEnd || 'Not scheduled'}</Text></Card><Card><View style={ui.row}><Text style={[ui.heading, ui.grow]}>On duty</Text><Switch accessibilityLabel="On duty" value={user?.onDuty || false} disabled={mutation.busy} onValueChange={value => { void mutation.run(async () => { updateStaff(await patchStaffData<StaffProfile>('me', { onDuty: value })); }); }} /></View></Card><Feedback error={mutation.error} /></StaffShell>;
}
export function HelpScreen() { return <StaffShell title="Help & Support"><Card><Text style={ui.heading}>Managing walk-ins</Text><Text style={ui.muted}>Use Add Walk-in to enter a customer’s details. Open the saved entry in Queue to send an alert, edit details, or assign an available table.</Text></Card><Card><Text style={ui.heading}>Reservation holds</Text><Text style={ui.muted}>Open a reservation and select Assign Table → Hold Table. No-Show Handling shows the remaining hold time and lets you extend it. Expired holds release automatically.</Text></Card><Card><Text style={ui.heading}>Account and password help</Text><Text style={ui.muted}>Contact your restaurant manager for staff access or a password reset.</Text></Card><Button title="View Recent Activity" secondary onPress={() => go('activity')} /></StaffShell>; }
const styles = StyleSheet.create({
  person: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F4F5F7', alignItems: 'center', justifyContent: 'center' }, personText: { color: '#98A2B3', fontWeight: '600' },
  largeTitle: { fontSize: 23, fontWeight: '700', color: '#151D2E' }, legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, legendText: { fontSize: 10, color: '#98A2B3' }, dot: { width: 6, height: 6, borderRadius: 3 },
  tableGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, tableTile: { width: '30.8%', minHeight: 100, borderWidth: 1, borderRadius: 12, padding: 12, alignItems: 'center', justifyContent: 'center', gap: 5 },
  tableHero: { backgroundColor: '#F5EBE4', borderRadius: 18, padding: 36, gap: 12, alignItems: 'center' }, heroNumber: { fontSize: 48, fontWeight: '700', color: burgundy },
  success: { flex: 1, minHeight: 450, justifyContent: 'center', alignItems: 'center', gap: 20 }, successCircle: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#0AA77B', alignItems: 'center', justifyContent: 'center' }, successCheck: { fontSize: 64, color: '#FFFFFF' },
  alertHero: { paddingVertical: 28, alignItems: 'center', gap: 16 }, alertCircle: { width: 78, height: 78, borderRadius: 39, backgroundColor: '#F9E7EC', alignItems: 'center', justifyContent: 'center' },
  holdCard: { backgroundColor: '#FFF9E8', padding: 28, alignItems: 'center', borderRadius: 14, gap: 8 }, countdown: { color: '#D34949', fontSize: 38, fontWeight: '700' },
  profileHero: { alignItems: 'center', gap: 10, paddingTop: 24, paddingBottom: 24 }, profileAvatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: '#F1DDE2', backgroundColor: '#F8ECEF', alignItems: 'center', justifyContent: 'center' }, profileInitial: { fontSize: 28, fontWeight: '700', color: burgundy },
});
