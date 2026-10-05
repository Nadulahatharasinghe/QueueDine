import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, SPACING, BORDER_RADIUS, SHADOWS } from '../src/constants/theme';
import Logo from '../src/components/Logo';
import CustomButton from '../src/components/CustomButton';
import ScreenContainer from '../src/components/ScreenContainer';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    loadUserData();
    setGreetingBasedOnTime();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const setGreetingBasedOnTime = () => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting('Good morning');
    } else if (hour < 18) {
      setGreeting('Good afternoon');
    } else {
      setGreeting('Good evening');
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      router.replace('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Logo size="small" />
            <TouchableOpacity onPress={handleLogout}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.greeting}>
            {greeting}, {user?.fullName?.split(' ')[0] || 'Guest'}
          </Text>

          <View style={styles.restaurantCard}>
            <View style={styles.restaurantImage}>
              <Text style={styles.restaurantImagePlaceholder}>Restaurant Image</Text>
            </View>
            <View style={styles.restaurantInfo}>
              <Text style={styles.restaurantName}>Ember & Oak</Text>
              <View style={styles.ratingContainer}>
                <Text style={styles.rating}>4.6</Text>
                <Text style={styles.reviewCount}>(1.2k reviews)</Text>
              </View>
              <Text style={styles.location}>Colombo, Sri Lanka</Text>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>~25 mins</Text>
                <Text style={styles.statLabel}>Current wait</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>12</Text>
                <Text style={styles.statLabel}>In queue</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>8</Text>
                <Text style={styles.statLabel}>Tables available</Text>
              </View>
            </View>

            <View style={styles.actionButtons}>
              <CustomButton
                title="Reserve a Table"
                onPress={() => {}}
                variant="primary"
                style={styles.actionButton}
              />
              <CustomButton
                title="Join Virtual Queue"
                onPress={() => {}}
                variant="outline"
                style={styles.actionButton}
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Why diners love us</Text>

          <View style={styles.featuresContainer}>
            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>🍽️</Text>
              </View>
              <Text style={styles.featureTitle}>Great Food</Text>
              <Text style={styles.featureDescription}>
                Delicious dishes crafted with passion
              </Text>
            </View>

            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>🌟</Text>
              </View>
              <Text style={styles.featureTitle}>Cozy Ambience</Text>
              <Text style={styles.featureDescription}>
                Warm and inviting atmosphere
              </Text>
            </View>

            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>👥</Text>
              </View>
              <Text style={styles.featureTitle}>Friendly Staff</Text>
              <Text style={styles.featureDescription}>
                Excellent service and hospitality
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={[styles.navIcon, styles.activeNavIcon]}>🏠</Text>
          <Text style={[styles.navLabel, styles.activeNavLabel]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>📅</Text>
          <Text style={styles.navLabel}>Bookings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>🔔</Text>
          <Text style={styles.navLabel}>Notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/profile')}>
          <Text style={styles.navIcon}>👤</Text>
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 80,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  logoutText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  greeting: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },
  restaurantCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  restaurantImage: {
    height: 200,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restaurantImagePlaceholder: {
    color: COLORS.textLight,
    fontSize: FONT_SIZES.sm,
  },
  restaurantInfo: {
    padding: SPACING.lg,
  },
  restaurantName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  rating: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
    marginRight: SPACING.xs,
  },
  reviewCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  location: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  actionButtons: {
    padding: SPACING.lg,
  },
  actionButton: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  feature: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginHorizontal: SPACING.xs,
    ...SHADOWS.sm,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  featureIconText: {
    fontSize: 24,
  },
  featureTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  featureDescription: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: 20,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  navIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  navLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  activeNavIcon: {
    color: COLORS.primary,
  },
  activeNavLabel: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semibold,
  },
});
