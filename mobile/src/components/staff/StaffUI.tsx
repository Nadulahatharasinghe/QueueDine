import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage, getStaffData } from '../../services/staffData';

export const burgundy = '#921C30';
export const tones: Record<string, { background: string; color: string; border: string }> = {
  available: { background: '#E9F6EF', color: '#208064', border: '#BCE0D0' },
  waiting: { background: '#E9F6EF', color: '#208064', border: '#BCE0D0' },
  arrived: { background: '#E9F6EF', color: '#208064', border: '#BCE0D0' },
  occupied: { background: '#FBECEE', color: '#A52940', border: '#F0CED5' },
  reserved: { background: '#FFF8DD', color: '#A77B15', border: '#F1E6BA' },
  'almost-ready': { background: '#FFF8DD', color: '#A77B15', border: '#F1E6BA' },
  upcoming: { background: '#EAF0FF', color: '#5275AF', border: '#CFDCF9' },
  cleaning: { background: '#EAF0FF', color: '#5275AF', border: '#CFDCF9' },
  ready: { background: '#DFF8EF', color: '#008565', border: '#ACE5D5' },
};
export function go(screen: string, params?: Record<string, string>) {
  router.push({ pathname: `/staff/${screen}` as '/staff/dashboard', params });
}
export function back(fallback = 'dashboard') { if (router.canGoBack()) router.back(); else router.replace(`/staff/${fallback}` as '/staff/dashboard'); }
export function time(value?: string) { return value ? new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''; }
export function elapsed(value: string) { return `${Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))} min`; }
export function useStaffResource<T>(path: string, poll = true, onLoad?: (data: T) => void) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const active = useRef(false);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const loaded = useRef(onLoad);
  useEffect(() => { loaded.current = onLoad; }, [onLoad]);
  const reload = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const current = generation.current;
    try {
      const response = await getStaffData<T>(path);
      if (active.current && current === generation.current) { setData(response); setError(''); loaded.current?.(response); }
    } catch (cause) { if (active.current && current === generation.current) setError(errorMessage(cause)); }
    finally { if (current === generation.current) { inFlight.current = false; if (active.current) setLoading(false); } }
  }, [path]);
  useFocusEffect(useCallback(() => {
    active.current = true;
    generation.current += 1;
    inFlight.current = false;
    void reload();
    const timer = poll ? setInterval(() => { void reload(); }, 15000) : undefined;
    return () => { active.current = false; generation.current += 1; if (timer) clearInterval(timer); };
  }, [poll, reload]));
  return { data, error, loading, reload };
}
export function useMutation() {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const locked = useRef(false);
  const run = async (work: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { await work(); } catch (cause) { setError(errorMessage(cause)); }
    finally { locked.current = false; setBusy(false); }
  };
  return { busy, error, run };
}
export function StaffShell({ title, tab, children, footer, onRefresh, refreshing = false, headerAction }: {
  title: string; tab?: string; children: ReactNode; footer?: ReactNode; onRefresh?: () => void; refreshing?: boolean; headerAction?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return <View style={ui.outer}><StatusBar style="dark" /><KeyboardAvoidingView style={[ui.page, { paddingTop: insets.top, paddingBottom: insets.bottom }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={ui.header}>
      {!tab && <Pressable onPress={() => back()} style={ui.headerButton} accessibilityRole="button" accessibilityLabel="Back"><Text style={ui.back}>‹</Text></Pressable>}
      <Text style={ui.title}>{title}</Text>
      {headerAction || (!tab && <Pressable onPress={() => back()} style={ui.headerButton} accessibilityRole="button" accessibilityLabel="Close"><Text style={ui.close}>×</Text></Pressable>)}
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={ui.content} refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={burgundy} /> : undefined}>{children}</ScrollView>
    {footer && <View style={ui.footer}>{footer}</View>}
    {tab && <View style={ui.nav}>{[['dashboard', '⌂', 'Home'], ['queue', '☷', 'Queue'], ['reservations', '▦', 'Reservations'], ['tables', '▤', 'Tables'], ['profile', '···', 'More']].map(([route, icon, label]) => <Pressable key={route} style={ui.navItem} onPress={() => route !== tab && router.replace(`/staff/${route}` as '/staff/dashboard')} accessibilityRole="tab" accessibilityState={{ selected: tab === route }} accessibilityLabel={label}><Text style={[ui.navIcon, tab === route && ui.active]}>{icon}</Text><Text style={[ui.navLabel, tab === route && ui.active]}>{label}</Text></Pressable>)}</View>}
  </KeyboardAvoidingView></View>;
}
export function Button({ title, onPress, busy = false, secondary = false, danger = false, disabled = false }: { title: string; onPress: () => void; busy?: boolean; secondary?: boolean; danger?: boolean; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled || busy} accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} style={({ pressed }) => [ui.button, secondary && ui.secondary, danger && ui.danger, (pressed || disabled || busy) && { opacity: 0.65 }]}>{busy ? <ActivityIndicator color={secondary ? burgundy : '#FFFFFF'} /> : <Text style={[ui.buttonText, secondary && { color: burgundy }, danger && { color: '#AF3144' }]}>{title}</Text>}</Pressable>;
}
export function Chip({ value }: { value: string }) {
  const tone = tones[value] || { background: '#F2F3F6', color: '#697386' };
  const labels: Record<string, string> = { 'almost-ready': 'Almost Ready', ready: 'Table Ready', 'no-show': 'No-show' };
  return <View style={[ui.chip, { backgroundColor: tone.background }]}><Text style={[ui.chipText, { color: tone.color }]}>{labels[value] || value.charAt(0).toUpperCase() + value.slice(1)}</Text></View>;
}
export function Card({ children }: { children: ReactNode }) { return <View style={ui.card}>{children}</View>; }
export function Field({ label, value, onChangeText, placeholder, phone = false, multiline = false }: { label: string; value: string; onChangeText: (text: string) => void; placeholder?: string; phone?: boolean; multiline?: boolean }) {
  return <View style={ui.card}><Text style={ui.label}>{label}</Text><TextInput style={[ui.input, multiline && { minHeight: 50, textAlignVertical: 'top' }]} accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#98A2B3" keyboardType={phone ? 'phone-pad' : 'default'} multiline={multiline} /></View>;
}
export function Filters({ items, selected, onSelect }: { items: string[]; selected: string; onSelect: (value: string) => void }) {
  return <ScrollView horizontal style={{ flexGrow: 0, flexShrink: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={ui.filters}>{items.map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: selected === item }} onPress={() => onSelect(item)} style={[ui.filter, selected === item && ui.selectedFilter]}><Text style={[ui.filterText, selected === item && { color: '#FFFFFF' }]}>{item}</Text></Pressable>)}</ScrollView>;
}
export function Search({ value, onChangeText }: { value: string; onChangeText: (value: string) => void }) { return <TextInput style={ui.search} placeholder="Search name or reference" placeholderTextColor="#98A2B3" accessibilityLabel="Search name or reference" value={value} onChangeText={onChangeText} />; }
export function Feedback({ loading, error, retry }: { loading?: boolean; error?: string; retry?: () => void }) {
  return <>{loading && <ActivityIndicator color={burgundy} style={{ marginVertical: 24 }} />}{!!error && <View style={ui.errorBox}><Text style={ui.error} accessibilityRole="alert">{error}</Text>{retry && <Button title="Try again" onPress={retry} secondary />}</View>}</>;
}
export function Empty({ title = 'Nothing here yet', detail }: { title?: string; detail: string }) { return <View style={ui.empty}><Text style={ui.emptySymbol}>○</Text><Text style={ui.heading}>{title}</Text><Text style={ui.muted}>{detail}</Text></View>; }
export function PartySize({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <Card><View style={ui.row}><View style={ui.grow}><Text style={ui.label}>PARTY SIZE</Text><Text style={ui.heading}>{value} {value === 1 ? 'person' : 'people'}</Text></View><Pressable style={ui.step} accessibilityLabel="Decrease party size" accessibilityRole="button" disabled={value <= 1} onPress={() => onChange(Math.max(1, value - 1))}><Text>−</Text></Pressable><Pressable style={ui.step} accessibilityLabel="Increase party size" accessibilityRole="button" disabled={value >= 30} onPress={() => onChange(Math.min(30, value + 1))}><Text>+</Text></Pressable></View></Card>;
}
export function useClock() { const [now, setNow] = useState(() => Date.now()); useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []); return now; }

export const ui = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#F5F3F1', alignItems: 'center' },
  page: { flex: 1, width: '100%', maxWidth: 448, backgroundColor: '#FFFFFF' },
  header: { minHeight: 70, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 19, fontWeight: '700', color: '#151D2E' },
  headerButton: { height: 44, width: 32, alignItems: 'center', justifyContent: 'center' },
  back: { fontSize: 32, color: '#151D2E' }, close: { fontSize: 25, color: '#697386' },
  content: { padding: 24, paddingTop: 8, gap: 16, flexGrow: 1 },
  footer: { padding: 24, gap: 10, borderTopWidth: 1, borderTopColor: '#F0F1F4', backgroundColor: '#FFFFFF' },
  nav: { minHeight: 68, flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F0F1F4', backgroundColor: '#FFFFFF' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  navIcon: { fontSize: 23, color: '#98A2B3' }, navLabel: { fontSize: 10, color: '#98A2B3' }, active: { color: burgundy, fontWeight: '700' },
  button: { minHeight: 48, backgroundColor: burgundy, borderRadius: 10, padding: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 }, secondary: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4CDD2' }, danger: { backgroundColor: '#FFF1F2' },
  card: { borderWidth: 1, borderColor: '#E4E7EC', borderRadius: 14, backgroundColor: '#FFFFFF', padding: 18, gap: 6, boxShadow: '0 1px 2px rgba(16,24,40,0.04)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, grow: { flex: 1, minWidth: 0 },
  heading: { fontSize: 16, color: '#151D2E', fontWeight: '600' }, muted: { fontSize: 13, lineHeight: 20, color: '#697386' },
  label: { fontSize: 11, color: '#697386', letterSpacing: 0.5, marginBottom: 4 }, input: { padding: 0, color: '#151D2E', fontSize: 16, lineHeight: 23 },
  chip: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, alignSelf: 'flex-start' }, chipText: { fontSize: 10, fontWeight: '600' },
  filters: { flexDirection: 'row', alignItems: 'center', gap: 8 }, filter: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 24, backgroundColor: '#F4F5F7' }, selectedFilter: { backgroundColor: burgundy }, filterText: { color: '#697386', fontSize: 12 },
  search: { borderWidth: 1, borderColor: '#E4E7EC', borderRadius: 10, padding: 12, fontSize: 14, color: '#151D2E' },
  errorBox: { gap: 12, padding: 16, backgroundColor: '#FFF1F2', borderRadius: 10 }, error: { color: '#A1263A', fontSize: 13, lineHeight: 20 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 }, emptySymbol: { fontSize: 44, color: '#D4C2C6' },
  step: { width: 36, height: 36, borderWidth: 1, borderColor: '#E4E7EC', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
});
