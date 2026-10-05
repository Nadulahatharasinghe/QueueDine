import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, SPACING, BORDER_RADIUS } from '../src/constants/theme';
import Logo from '../src/components/Logo';
import CustomButton from '../src/components/CustomButton';
import CustomInput from '../src/components/CustomInput';
import ScreenContainer from '../src/components/ScreenContainer';
import apiClient from '../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userType, setUserType] = useState<'customer' | 'staff'>('customer');
  const [seatingPreference, setSeatingPreference] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    setError('');

    if (!fullName || !email || !password) {
      setError('Please fill in all required fields');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/api/auth/register', {
        fullName,
        email,
        password,
        phone: phone || undefined,
        seatingPreference: seatingPreference || undefined,
      });

      const { user, token } = response.data;
      
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      
      router.replace('/home');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Logo size="medium" />
          </View>

          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join QueueDine to easily book tables, join virtual queues, and get live alerts.
          </Text>

          <View style={styles.userTypeContainer}>
            <TouchableOpacity
              style={[styles.userTypeButton, userType === 'customer' && styles.activeUserType]}
              onPress={() => setUserType('customer')}
            >
              <Text style={[styles.userTypeText, userType === 'customer' && styles.activeUserTypeText]}>
                Customer
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.userTypeButton, userType === 'staff' && styles.activeUserType]}
              onPress={() => router.push('/staff/login')}
            >
              <Text style={[styles.userTypeText, userType === 'staff' && styles.activeUserTypeText]}>
                Restaurant Staff
              </Text>
            </TouchableOpacity>
          </View>

          <CustomInput
            label="Full name"
            placeholder="e.g., Nadeesha Fernando"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />

          <CustomInput
            label="Email address"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={styles.phoneContainer}>
            <View style={styles.countryCode}>
              <Text style={styles.countryCodeText}>LK +94</Text>
            </View>
            <CustomInput
              placeholder="7X XXX XXXX"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              containerStyle={styles.phoneInput}
              style={styles.phoneInputField}
            />
          </View>

          <CustomInput
            label="Password"
            placeholder="Min. 8 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <CustomInput
            label="Confirm password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <Text style={styles.optionalLabel}>Seating Preference (Optional)</Text>
          <View style={styles.seatingContainer}>
            {['Indoor / AC', 'Outdoor Garden', 'Window View', 'Any'].map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.seatingButton,
                  seatingPreference === option && styles.activeSeating,
                ]}
                onPress={() => setSeatingPreference(option)}
              >
                <Text
                  style={[
                    styles.seatingText,
                    seatingPreference === option && styles.activeSeatingText,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.termsContainer}
            onPress={() => setAgreedToTerms(!agreedToTerms)}
          >
            <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
              {agreedToTerms && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termsText}>
              I agree to the{' '}
              <Text style={styles.termsLink}>Terms of Service</Text>
              {' and '}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <CustomButton
            title="Create Account"
            onPress={handleRegister}
            loading={loading}
            style={styles.button}
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <CustomButton
            title="Continue with Google"
            onPress={() => {}}
            variant="outline"
            style={styles.socialButton}
          />

          <CustomButton
            title="Continue with Apple"
            onPress={() => {}}
            variant="outline"
            style={styles.socialButton}
          />

          <TouchableOpacity
            style={styles.signInContainer}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.signInText}>
              Already have an account? <Text style={styles.signInLink}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: SPACING.lg,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  userTypeContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },
  userTypeButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    marginHorizontal: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  activeUserType: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  userTypeText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  activeUserTypeText: {
    color: COLORS.white,
  },
  phoneContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  countryCode: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 16,
    marginRight: SPACING.sm,
    justifyContent: 'center',
  },
  countryCodeText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  phoneInput: {
    flex: 1,
    marginBottom: 0,
  },
  phoneInputField: {
    marginBottom: 0,
  },
  optionalLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  seatingContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SPACING.lg,
  },
  seatingButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  activeSeating: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  seatingText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  activeSeatingText: {
    color: COLORS.white,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkmark: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
  },
  termsText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  termsLink: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  button: {
    marginBottom: SPACING.lg,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    paddingHorizontal: SPACING.md,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
  },
  socialButton: {
    marginBottom: SPACING.md,
  },
  signInContainer: {
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  signInText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  signInLink: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semibold,
  },
});
