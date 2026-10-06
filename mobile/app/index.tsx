import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, SPACING, BORDER_RADIUS } from '../src/constants/theme';
import Logo from '../src/components/Logo';
import CustomButton from '../src/components/CustomButton';

export default function LandingPage() {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={['#2D1B15', '#1A0F0C', '#0D0705', '#000000']}
      locations={[0, 0.4, 0.7, 1]}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  logoContainer: {
    marginBottom: SPACING.xxl,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  title: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  description: {
    fontSize: FONT_SIZES.md,
    color: '#E8E8E8',
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
    backgroundColor: '#FFFFFF',
    marginHorizontal: 4,
    opacity: 0.4,
  },
  activeDot: {
    backgroundColor: '#D4A574',
    opacity: 1,
  },
  signInContainer: {
    padding: SPACING.md,
  },
  signInText: {
    fontSize: FONT_SIZES.sm,
    color: '#E8E8E8',
    fontWeight: FONT_WEIGHTS.medium,
  },
});
