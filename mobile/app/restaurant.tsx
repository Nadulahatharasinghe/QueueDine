import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { router, Stack } from 'expo-router';
import {
  COLORS,
  FONT_SIZES,
  FONT_WEIGHTS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../src/constants/theme';
import CustomButton from '../src/components/CustomButton';
import ScreenContainer from '../src/components/ScreenContainer';
import { getFirstRestaurant, photoUri } from '../src/services/restaurantService';
import { Restaurant as RestaurantType } from '../src/types';

export default function RestaurantScreen() {
  const [restaurant, setRestaurant] = useState<RestaurantType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'Overview' | 'Menu' | 'Info'>('Overview');
  const [imageFailed, setImageFailed] = useState(false);

  const loadRestaurant = async () => {
    try {
      setLoading(true);
      const data = await getFirstRestaurant();
      setRestaurant(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load restaurant');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRestaurant();
  }, []);

  const formatHours = (open: string, close: string) => {
    const fmt = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour = h % 12 === 0 ? 12 : h % 12;
      return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
    };
    return `${fmt(open)} \u2013 ${fmt(close)}`;
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!restaurant) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={styles.error}>{error || 'Restaurant not found'}</Text>
        </View>
      </ScreenContainer>
    );
  }

  const reviewCountDisplay =
    restaurant.reviewCount >= 1000
      ? `${(restaurant.reviewCount / 1000).toFixed(1)}k`
      : String(restaurant.reviewCount);

  return (
    <ScreenContainer scrollable={false} style={{ padding: 0 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        <View style={styles.heroContainer}>
          <View style={styles.hero}>
            {!imageFailed && restaurant.imageUrl && photoUri(restaurant.imageUrl) ? (
              <Image
                source={{ uri: photoUri(restaurant.imageUrl)! }}
                style={styles.heroImage}
                resizeMode="cover"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <Image
                source={require('../assets/welcome_page_background_image.png')}
                style={styles.heroImage}
                resizeMode="cover"
              />
            )}
            <View style={styles.heroOverlay} />
          </View>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.backText}>{'<'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.heartButton} activeOpacity={0.7}>
            <Text style={styles.heartText}>{'\u2764'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.restaurantName}>{restaurant.name}</Text>
          <View style={styles.locationRow}>
            <Text style={styles.locationIcon}>{'\u{1F4CD}'}</Text>
            <Text style={styles.locationText}>{restaurant.location}</Text>
          </View>
          <View style={styles.ratingRow}>
            <Text style={styles.starIcon}>{'\u2B50'}</Text>
            <Text style={styles.ratingValue}>{restaurant.rating.toFixed(1)}</Text>
            <Text style={styles.ratingCount}> ({reviewCountDisplay} reviews)</Text>
          </View>

          <View style={styles.tabsRow}>
            {(['Overview', 'Menu', 'Info'] as const).map((t) => (
              <TouchableOpacity key={t} onPress={() => setActiveTab(t)}>
                <Text
                  style={[
                    styles.tabText,
                    activeTab === t ? styles.tabActive : styles.tabInactive,
                  ]}
                >
                  {t}
                </Text>
                {activeTab === t && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.separatorThin} />

          <View style={styles.statsList}>
            <View style={styles.statRow}>
              <Text style={styles.statIcon}>{'\u{1F552}'}</Text>
              <Text style={styles.statLabel}>Open Today</Text>
              <Text style={styles.statValueRight}>
                {formatHours(restaurant.openingHours.open, restaurant.openingHours.close)}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statIcon}>{'\u{23F1}'}</Text>
              <Text style={styles.statLabel}>Current Wait Time</Text>
              <Text style={styles.statWaitGreen}>
                ~ {restaurant.currentWaitTime || 25} minutes
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statIcon}>{'\u{1F465}'}</Text>
              <Text style={styles.statLabel}>Queue Length</Text>
              <Text style={styles.statValueRight}>
                {restaurant.queueLength ?? 12} parties ahead
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statIcon}>{'\u{1FA91}'}</Text>
              <Text style={styles.statLabel}>Available Tables</Text>
              <Text style={styles.statValueRight}>
                {restaurant.availableTables ?? 8} tables
              </Text>
            </View>
          </View>

          <Text style={styles.description}>{restaurant.description}</Text>

          <View style={styles.ctaSpacing} />
          <CustomButton
            title="Reserve a Table"
            variant="primary"
            onPress={() =>
              router.push({
                pathname: '/reservation/create',
                params: { restaurantId: restaurant._id },
              })
            }
            style={styles.ctaButtonPrimary}
          />
          <CustomButton
            title="Join Virtual Queue"
            variant="outline"
            onPress={() =>
              router.push({
                pathname: '/queue/join',
                params: { restaurantId: restaurant._id },
              })
            }
            style={styles.ctaButtonOutline}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    color: COLORS.error,
    fontSize: FONT_SIZES.md,
  },
  heroContainer: {
    position: 'relative',
  },
  hero: {
    width: '100%',
    height: 280,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  backButton: {
    position: 'absolute',
    top: 24,
    left: SPACING.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
  },
  backText: {
    fontSize: 22,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHTS.bold,
  },
  heartButton: {
    position: 'absolute',
    top: 24,
    right: SPACING.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
  },
  heartText: {
    fontSize: 20,
    color: COLORS.primary,
  },
  content: {
    padding: SPACING.lg,
  },
  restaurantName: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  locationIcon: {
    fontSize: FONT_SIZES.lg,
    marginRight: 6,
    color: COLORS.textSecondary,
  },
  locationText: {
    fontSize: 20,
    color: COLORS.textSecondary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  starIcon: {
    fontSize: FONT_SIZES.lg,
    marginRight: 6,
  },
  ratingValue: {
    fontSize: 20,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
  },
  ratingCount: {
    fontSize: 18,
    color: COLORS.textSecondary,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  tabText: {
    fontSize: 22,
    fontWeight: FONT_WEIGHTS.semibold,
    paddingVertical: SPACING.sm,
  },
  tabActive: {
    color: COLORS.primary,
  },
  tabInactive: {
    color: COLORS.textSecondary,
  },
  tabUnderline: {
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  separatorThin: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  statsList: {
    marginBottom: SPACING.lg,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 0,
  },
  statIcon: {
    fontSize: 22,
    width: 36,
    marginRight: SPACING.sm,
    color: COLORS.textSecondary,
  },
  statLabel: {
    flex: 1,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  statValueRight: {
    fontSize: 18,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  statWaitGreen: {
    fontSize: 20,
    color: COLORS.success,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  description: {
    marginTop: SPACING.md,
    fontSize: 20,
    lineHeight: 28,
    color: COLORS.textSecondary,
  },
  ctaSpacing: {
    height: SPACING.xxl,
  },
  ctaButtonPrimary: {
    height: 58,
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.md,
  },
  ctaButtonOutline: {
    height: 58,
    borderRadius: BORDER_RADIUS.xl,
  },
});
