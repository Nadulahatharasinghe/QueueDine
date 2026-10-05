import React, { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import ScreenContainer from '../ScreenContainer';
import { Dashboard, Party, postStaffData, patchStaffData, requestKey } from '../../services/staffData';
import { Feedback, useMutation, useStaffResource } from './StaffUI';

// Draw the small outline icons with native views so web and Expo Go need no extra dependencies.
function FieldIcon({ kind }: { kind: 'person' | 'party' | 'phone' | 'note' | 'clock' }) {
  return (
    <View style={styles.icon} accessible={false}>
      {(kind === 'person' || kind === 'party') && <>
        {kind === 'party' && <View style={styles.sidePerson}><View style={styles.head} /><View style={styles.shoulders} /></View>}
        <View style={styles.person}><View style={styles.head} /><View style={styles.shoulders} /></View>
        {kind === 'party' && <View style={[styles.sidePerson, styles.rightPerson]}><View style={styles.head} /><View style={styles.shoulders} /></View>}
      </>}
      {kind === 'phone' && <View style={styles.phone}><View style={styles.phoneHome} /></View>}
      {kind === 'note' && <><View style={styles.note} /><View style={styles.pencil} /></>}
      {kind === 'clock' && <View style={styles.clock}><View style={styles.hourHand} /><View style={styles.minuteHand} /></View>}
    </View>
  );
}

export default function AddWalkInCustomer() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [name, setName] = useState('');
  const [partySize, setPartySize] = useState(4);
  const [mobile, setMobile] = useState('');
  const [requests, setRequests] = useState('');
  const [message, setMessage] = useState('');
  const mutation = useMutation();
  const dashboard = useStaffResource<Dashboard>('dashboard');
  const [initialized, setInitialized] = useState(false);
  const entry = useStaffResource<Party>(id ? `parties/${id}` : 'me', false, p => {
    if (!id || initialized) return;
    setName(p.customerName); setPartySize(p.partySize); setMobile(p.mobileNumber); setRequests(p.specialRequests); setInitialized(true);
  });
  const key = useRef(requestKey());

  const addToQueue = () => {
    if (!name.trim()) {
      setMessage('Please enter the customer name.');
      return;
    }
    if (!/^\+?[\d\s()-]+$/.test(mobile.trim()) || mobile.replace(/\D/g, '').length < 9 || mobile.replace(/\D/g, '').length > 15) {
      setMessage('Please enter a valid mobile number.');
      return;
    }
    setMessage('');
    void mutation.run(async () => {
      const body = { customerName: name.trim(), partySize, mobileNumber: mobile.trim(), specialRequests: requests.trim(), kind: 'queue' };
      if (id) await patchStaffData(`parties/${id}`, { ...body, action: 'edit' });
      else await postStaffData('parties', body, key.current);
      router.replace('/staff/queue');
    });
  };

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/staff/dashboard');
  };

  return (
    <ScreenContainer scrollable={false} style={styles.screen}>
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.title}>{id ? 'Modify Walk-In Customer' : 'Add Walk-In Customer'}</Text>
          <TouchableOpacity onPress={close} style={styles.close} accessibilityRole="button" accessibilityLabel="Close and return to host dashboard">
            <View style={styles.crossLine} /><View style={[styles.crossLine, styles.crossOther]} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {id && <Feedback loading={entry.loading} error={entry.error} retry={() => { void entry.reload(); }} />}
          <View style={styles.card}>
            <FieldIcon kind="person" />
            <View style={styles.field}>
              <Text style={styles.label}>CUSTOMER NAME</Text>
              <TextInput style={styles.input} accessibilityLabel="Customer name" value={name} onChangeText={setName} placeholder="Enter customer name" placeholderTextColor="#98A2B3" autoCapitalize="words" autoComplete="name" />
            </View>
          </View>
          <View style={styles.card}>
            <FieldIcon kind="party" />
            <View style={styles.field}>
              <Text style={styles.label}>PARTY SIZE</Text>
              <Text style={styles.partyValue} accessibilityLiveRegion="polite">{partySize} {partySize === 1 ? 'person' : 'people'}</Text>
            </View>
            <View style={styles.stepper}>
              <TouchableOpacity style={[styles.stepButton, partySize === 1 && styles.disabled]} onPress={() => setPartySize(value => Math.max(1, value - 1))} disabled={partySize === 1} accessibilityRole="button" accessibilityLabel="Decrease party size" accessibilityState={{ disabled: partySize === 1 }}>
                <Text style={styles.stepText}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.stepButton} disabled={partySize >= 30} onPress={() => setPartySize(value => Math.min(30, value + 1))} accessibilityRole="button" accessibilityLabel="Increase party size">
                <Text style={styles.stepText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.card}>
            <FieldIcon kind="phone" />
            <View style={styles.field}>
              <Text style={styles.label}>MOBILE NUMBER</Text>
              <TextInput style={styles.input} accessibilityLabel="Mobile number" value={mobile} onChangeText={setMobile} placeholder="e.g. +94 77 123 4567" placeholderTextColor="#98A2B3" keyboardType="phone-pad" autoComplete="tel" />
            </View>
          </View>
          <View style={[styles.card, styles.requestsCard]}>
            <FieldIcon kind="note" />
            <View style={styles.field}>
              <Text style={styles.label}>SPECIAL REQUESTS (OPTIONAL)</Text>
              <TextInput style={[styles.input, styles.requestsInput]} accessibilityLabel="Special requests (optional)" value={requests} onChangeText={setRequests} placeholder="e.g. high chair, window seat" placeholderTextColor="#98A2B3" multiline />
            </View>
          </View>
          <View style={styles.waitCard}>
            <View style={styles.clockBadge}><FieldIcon kind="clock" /></View>
            <View style={styles.field}>
              <Text style={styles.waitLabel}>Estimated Wait Time</Text>
              <Text style={styles.waitValue}>{dashboard.data ? `~ ${dashboard.data.estimate} minutes` : 'Checking availability…'}</Text>
            </View>
          </View>
          <Feedback error={dashboard.error || mutation.error} retry={dashboard.error ? () => { void dashboard.reload(); } : undefined} />
        </ScrollView>
        <View style={styles.footer}>
          {message ? <Text style={styles.message} accessibilityRole="alert" accessibilityLiveRegion="polite">{message}</Text> : null}
          <TouchableOpacity style={[styles.addButton, mutation.busy && { opacity: 0.65 }]} onPress={addToQueue} disabled={mutation.busy || !!id && !initialized} accessibilityState={{ disabled: mutation.busy || !!id && !initialized, busy: mutation.busy }} accessibilityRole="button" activeOpacity={0.85}>
            {mutation.busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.addButtonText}>{id ? 'Save Changes' : 'Add to Queue'}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 0, backgroundColor: '#FFFFFF' },
  page: { flex: 1, width: '100%', maxWidth: 448, alignSelf: 'center' },
  header: { paddingLeft: 32, paddingRight: 24, paddingTop: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, color: '#151D2E', fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  close: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  crossLine: { position: 'absolute', width: 18, height: 2, backgroundColor: '#6B7588', transform: [{ rotate: '45deg' }] },
  crossOther: { transform: [{ rotate: '-45deg' }] },
  scroll: { flex: 1 },
  footer: { borderTopWidth: 1, borderTopColor: '#F0F1F4', backgroundColor: '#FFFFFF', paddingHorizontal: 32, paddingTop: 26, paddingBottom: 20 },
  addButton: { minHeight: 54, borderRadius: 14, backgroundColor: '#921C30', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 14, boxShadow: '0px 2px 4px rgba(16, 24, 40, 0.12)' },
  addButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '400' },
  message: { color: '#921C30', fontSize: 13, lineHeight: 19, marginBottom: 12 },
  form: { paddingHorizontal: 32, paddingTop: 42, paddingBottom: 40, gap: 18 },
  card: { minHeight: 70, borderWidth: 1, borderColor: '#E0E4EB', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFFFFF', boxShadow: '0px 1px 2px rgba(16, 24, 40, 0.06)' },
  field: { flex: 1, minWidth: 0 },
  label: { fontSize: 12, lineHeight: 17, letterSpacing: 0.5, color: '#697386', marginBottom: 3 },
  input: { width: '100%', padding: 0, color: '#151D2E', fontSize: 16, lineHeight: 22 },
  partyValue: { color: '#151D2E', fontSize: 16, lineHeight: 22, fontWeight: '700' },
  stepper: { flexDirection: 'row', padding: 4, gap: 8, borderWidth: 1, borderColor: '#E0E4EB', backgroundColor: '#F8F9FB', borderRadius: 9 },
  stepButton: { width: 32, height: 32, borderWidth: 1, borderColor: '#E0E4EB', backgroundColor: '#FFFFFF', borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 18, color: '#475467' },
  disabled: { opacity: 0.4 },
  requestsCard: { alignItems: 'flex-start', paddingTop: 13 },
  requestsInput: { minHeight: 24, textAlignVertical: 'top' },
  waitCard: { minHeight: 103, borderRadius: 18, borderWidth: 1, borderColor: '#B6F8DC', backgroundColor: '#F9FAFB', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 24, gap: 16 },
  waitLabel: { color: '#697386', fontSize: 13, letterSpacing: 0.3, marginBottom: 8 },
  waitValue: { color: '#A31830', fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  clockBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E2F5F0', borderWidth: 1, borderColor: '#A8E9D9', alignItems: 'center', justifyContent: 'center' },
  icon: { width: 22, height: 24, justifyContent: 'center', alignItems: 'center' },
  person: { alignItems: 'center', gap: 2 },
  head: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.7, borderColor: '#98A2B3' },
  shoulders: { width: 15, height: 8, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 1.7, borderColor: '#98A2B3' },
  sidePerson: { position: 'absolute', left: -1, top: 6, alignItems: 'center', gap: 2, transform: [{ scale: 0.65 }] },
  rightPerson: { left: 10, top: 10 },
  phone: { width: 13, height: 19, borderWidth: 1.7, borderColor: '#98A2B3', borderRadius: 3, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 },
  phoneHome: { width: 4, height: 2, backgroundColor: '#98A2B3', borderRadius: 1 },
  note: { width: 16, height: 16, borderWidth: 1.7, borderColor: '#98A2B3', borderRadius: 3 },
  pencil: { position: 'absolute', width: 15, height: 5, borderWidth: 1.5, borderColor: '#98A2B3', backgroundColor: '#FFFFFF', borderRadius: 2, top: 5, left: 7, transform: [{ rotate: '-45deg' }] },
  clock: { width: 19, height: 19, borderWidth: 2, borderColor: '#00A780', borderRadius: 10 },
  hourHand: { position: 'absolute', top: 3, left: 7, width: 2, height: 6, backgroundColor: '#00A780', borderRadius: 1 },
  minuteHand: { position: 'absolute', top: 7, left: 7, width: 5, height: 2, backgroundColor: '#00A780', transform: [{ rotate: '30deg' }] },
});
