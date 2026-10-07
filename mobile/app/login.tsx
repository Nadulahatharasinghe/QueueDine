import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, SPACING, BORDER_RADIUS } from '../src/constants/theme';
import Logo from '../src/components/Logo';
import CustomButton from '../src/components/CustomButton';
import CustomInput from '../src/components/CustomInput';
import ScreenContainer from '../src/components/ScreenContainer';
import apiClient from '../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = async () => {
    setError('');
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/api/auth/login', {
        email,
        password,
      });

      const { user, token } = response.data;
      
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      
      router.replace('/home');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
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

          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

          <View style={styles.userTypeContainer}>
            <TouchableOpacity style={[styles.userTypeButton, styles.activeUserType]}>
              <Text style={[styles.userTypeText, styles.activeUserTypeText]}>Customer</Text>
            </TouchableOpacity>
            <Link href="/staff/login" asChild>
              <TouchableOpacity
                style={styles.userTypeButton}
                accessibilityRole="link"
                accessibilityLabel="Restaurant Staff login"
              >
                <Text style={styles.userTypeText}>Restaurant Staff</Text>
              </TouchableOpacity>
            </Link>
          </View>

          <Text style={styles.description}>
            Sign in to book tables, track queue position, and browse menus.
          </Text>

          <CustomInput
            label="Email or phone number"
            placeholder="Enter your email or phone"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <CustomInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />

          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Remember me</Text>
            </TouchableOpacity>

            <TouchableOpacity>
              <Text style={styles.forgotPassword}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <CustomButton
            title="Sign In"
            onPress={handleLogin}
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
            style={styles.registerContainer}
            onPress={() => router.push('/register')}
          >
            <Text style={styles.registerText}>
              Don't have an account? <Text style={styles.registerLink}>Create Account</Text>
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
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  userTypeContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
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
  description: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  checkboxLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  forgotPassword: {
    fontSize: FONT_SIZES.sm,
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
  registerContainer: {
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  registerText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  registerLink: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semibold,
  },
});
