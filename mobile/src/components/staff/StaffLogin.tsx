import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAxiosError } from 'axios';
import { signInStaff } from '../../services/staffAuth';

const rememberedIdKey = 'queuedine.staff.rememberedIdentifier';
const gradient = 'radial-gradient(ellipse at 45% 8%, rgba(154, 84, 14, 0.8) 0%, rgba(89, 49, 17, 0.38) 38%, transparent 70%), radial-gradient(ellipse at 95% 36%, rgba(111, 32, 24, 0.55) 0%, transparent 50%), linear-gradient(180deg, #301F12 0%, #170F0B 62%, #090807 100%)';
const background: ViewStyle = Platform.OS === 'web'
  ? ({ backgroundImage: gradient } as ViewStyle)
  : { experimental_backgroundImage: gradient };

function OutlineIcon({ kind }: { kind: 'mail' | 'lock' | 'eye' }) {
  return (
    <View style={styles.icon} accessible={false}>
      {kind === 'mail' && <View style={styles.envelope}><View style={styles.envelopeFlap} /></View>}
      {kind === 'lock' && <><View style={styles.lockLoop} /><View style={styles.lockBody} /></>}
      {kind === 'eye' && <View style={styles.eye}><View style={styles.pupil} /></View>}
    </View>
  );
}

export default function StaffLogin() {
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [visiblePassword, setVisiblePassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [helpVisible, setHelpVisible] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(rememberedIdKey).then(value => {
      if (active && value) setIdentifier(value);
    }).catch(() => { /* A storage failure must not prevent sign-in. */ });
    return () => { active = false; };
  }, []);

  const submit = async () => {
    if (loading) return;
    setError('');
    if (!identifier.trim() || !password) {
      setError('Enter your staff ID or email and password.');
      return;
    }
    setLoading(true);
    try {
      const user = await signInStaff(identifier.trim(), password);
      // Remember the identifier only, never the password.
      try {
        if (remember) await AsyncStorage.setItem(rememberedIdKey, identifier.trim());
        else await AsyncStorage.removeItem(rememberedIdKey);
      } catch { /* Login can continue when preferences cannot be saved. */ }
      setPassword('');
      if (user.role === 'manager') {
        router.replace('/manager/dashboard');
      } else {
        router.replace('/staff/dashboard');
      }
    } catch (cause) {
      if (isAxiosError(cause)) {
        if (cause.response?.status === 404) setError('Staff sign-in is not available yet. Please contact your manager.');
        else if (cause.response?.status === 401 || cause.response?.status === 403) setError('Check your credentials and that your staff account is active.');
        else if (!cause.response) setError('Unable to reach the server. Check your connection and try again.');
        else setError('Unable to sign in right now. Please try again.');
      } else setError(cause instanceof Error ? cause.message : 'Unable to sign in. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={[styles.panel, background]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 24) + 44, paddingBottom: Math.max(insets.bottom, 28) }]}>
            <View style={styles.brand}>
              <View style={styles.brandSymbol} accessible={false}>
                <View style={styles.brandStem} />
                {[0, 1, 2].map(index => <View key={index} style={[styles.brandRing, { top: 7 + index * 12 }]} />)}
              </View>
              <Text style={styles.brandName}>QueueDine</Text>
              <Text style={styles.tagline}>WAIT LESS. DINE BETTER</Text>
              <View style={styles.restaurantBadge}>
                <Text style={styles.restaurantName}>Ember &amp; Oak</Text>
                <Text style={styles.restaurantCaption}>· Kitchen &amp; Bar</Text>
              </View>
            </View>

            <View style={styles.form}>
              <Text style={styles.title}>Staff Login</Text>
              <Text style={styles.subtitle}>Sign in to access staff service tools at Ember &amp; Oak.</Text>
              <View style={styles.inputRow}>
                <OutlineIcon kind="mail" />
                <TextInput style={styles.input} value={identifier} onChangeText={setIdentifier}
                  placeholder="Staff ID or Email" placeholderTextColor="#A39D98" accessibilityLabel="Staff ID or email"
                  autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username"
                  editable={!loading} returnKeyType="next" />
              </View>
              <View style={styles.inputRow}>
                <OutlineIcon kind="lock" />
                <TextInput style={styles.input} value={password} onChangeText={setPassword}
                  placeholder="Password" placeholderTextColor="#A39D98" accessibilityLabel="Password"
                  secureTextEntry={!visiblePassword} autoCapitalize="none" autoCorrect={false}
                  autoComplete="current-password" textContentType="password" editable={!loading}
                  returnKeyType="go" onSubmitEditing={submit} />
                <Pressable style={styles.eyeButton} onPress={() => setVisiblePassword(value => !value)}
                  accessibilityRole="button" accessibilityLabel={visiblePassword ? 'Hide password' : 'Show password'}
                  accessibilityState={{ selected: visiblePassword }}>
                  <OutlineIcon kind="eye" />
                  {visiblePassword && <View style={styles.eyeSlash} />}
                </Pressable>
              </View>
              <Pressable style={styles.rememberRow} accessibilityRole="checkbox"
                accessibilityLabel="Remember me" accessibilityHint="Remembers your staff ID or email on this device"
                accessibilityState={{ checked: remember, disabled: loading }} disabled={loading}
                onPress={() => {
                  setRemember(value => !value);
                  if (remember) void AsyncStorage.removeItem(rememberedIdKey).catch(() => {});
                }}>
                <View style={[styles.checkbox, remember && styles.checked]}>{remember && <Text style={styles.checkmark}>✓</Text>}</View>
                <Text style={styles.rememberText}>Remember me</Text>
              </Pressable>
              {error ? <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text> : null}
              <Pressable style={({ pressed }) => [styles.signInButton, pressed && styles.pressed, loading && styles.busy]}
                onPress={submit} disabled={loading} accessibilityRole="button" accessibilityState={{ disabled: loading, busy: loading }}>
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.signInText}>Sign In</Text>}
              </Pressable>
              <Pressable style={styles.forgotButton} onPress={() => setHelpVisible(true)} accessibilityRole="button">
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
      <Modal visible={helpVisible} transparent animationType="fade" onRequestClose={() => setHelpVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.helpCard} accessibilityViewIsModal>
            <Text style={styles.helpTitle}>Need help signing in?</Text>
            <Text style={styles.helpText}>Contact your restaurant manager to reset your staff password or check your account access.</Text>
            <Pressable style={styles.signInButton} onPress={() => setHelpVisible(false)} accessibilityRole="button"><Text style={styles.signInText}>Got it</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#090807', alignItems: 'center' },
  panel: { flex: 1, width: '100%', maxWidth: 488, backgroundColor: '#170F0B', overflow: 'hidden' },
  content: { flexGrow: 1, paddingHorizontal: 36, minHeight: 800 },
  brand: { alignItems: 'center' },
  brandSymbol: { width: 40, height: 56, marginBottom: 20 },
  brandStem: { position: 'absolute', left: 19, top: 0, width: 3, height: 56, borderRadius: 2, backgroundColor: '#CF944D' },
  brandRing: { position: 'absolute', left: 6, width: 28, height: 23, borderWidth: 2.5, borderColor: '#CF944D', borderRadius: 15 },
  brandName: { color: '#FFF9F0', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 36, letterSpacing: 0.8 },
  tagline: { color: '#CBB99E', fontSize: 10, letterSpacing: 2.7, marginTop: 9 },
  restaurantBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 18, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22, backgroundColor: '#201D18', borderWidth: 1, borderColor: '#3C3326' },
  restaurantName: { color: '#F6EFE5', fontSize: 12 },
  restaurantCaption: { color: '#ABA39A', fontSize: 10 },
  form: { marginTop: 150 },
  title: { color: '#FFFFFF', fontSize: 23, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: '#D6CEC6', fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 12, marginBottom: 34 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46, backgroundColor: '#FFFFFF', borderRadius: 8, paddingLeft: 16, paddingRight: 8, marginBottom: 16 },
  input: { flex: 1, minWidth: 0, paddingVertical: 12, fontSize: 14, color: '#302B27' },
  icon: { width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  envelope: { width: 15, height: 12, borderWidth: 1.5, borderColor: '#A39D98', borderRadius: 2, overflow: 'hidden' },
  envelopeFlap: { width: 10, height: 10, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderColor: '#A39D98', transform: [{ rotate: '45deg' }], position: 'absolute', top: -6, left: 1 },
  lockLoop: { position: 'absolute', top: 2, left: 9, width: 8, height: 9, borderWidth: 1.5, borderColor: '#A39D98', borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  lockBody: { width: 13, height: 9, borderWidth: 1.5, borderColor: '#A39D98', borderRadius: 2, marginTop: 7, backgroundColor: '#FFFFFF' },
  eyeButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  eye: { width: 16, height: 11, borderWidth: 1.5, borderColor: '#A39D98', borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  pupil: { width: 5, height: 5, borderWidth: 1, borderColor: '#A39D98', borderRadius: 3 },
  eyeSlash: { width: 19, height: 1.5, backgroundColor: '#A39D98', position: 'absolute', transform: [{ rotate: '-45deg' }] },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 44, alignSelf: 'flex-start', marginTop: -6, marginBottom: 16 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#A3978D', alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: '#861D28', borderColor: '#861D28' },
  checkmark: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  rememberText: { color: '#D0C8C1', fontSize: 13 },
  signInButton: { minHeight: 44, backgroundColor: '#801D26', borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  signInText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  pressed: { backgroundColor: '#A12A37' },
  busy: { opacity: 0.7 },
  error: { color: '#FFD6D6', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  forgotButton: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginTop: 18, marginBottom: 100 },
  forgotText: { color: '#B2A9A1', fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  helpCard: { width: '100%', maxWidth: 360, padding: 24, borderRadius: 16, backgroundColor: '#241C16', borderWidth: 1, borderColor: '#554332' },
  helpTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  helpText: { color: '#D6CEC6', fontSize: 14, lineHeight: 22, marginVertical: 20 },
});
