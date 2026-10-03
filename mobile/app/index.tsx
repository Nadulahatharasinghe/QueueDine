import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, SPACING, BORDER_RADIUS } from '../src/constants/theme';
import Logo from '../src/components/Logo';
import CustomButton from '../src/components/CustomButton';
import ScreenContainer from '../src/components/ScreenContainer';

export default function LandingPage() {
  return (
    <ScreenContainer scrollable={false}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Logo size="large" />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>Wait Less. Dine Better.</Text>
          <Text style={styles.description}>
            Reserve a table, join the virtual queue, and enjoy seamless dining at Ember & Oak and your favorite spots.
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <CustomButton
            title="Get Started"
            onPress={() => router.push('/register')}
            variant="primary"
          />
        </View>

        <View style={styles.dotsContainer}>
          <View style={[styles.dot, styles.activeDot]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        <TouchableOpacity
          style={styles.signInContainer}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.signInText}>Already have an account? Sign In</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: SPACING.xxl,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  description: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    marginBottom: SPACING.xxl,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: COLORS.primary,
  },
  signInContainer: {
    padding: SPACING.md,
  },
  signInText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
});
