import React from 'react';
import { router } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ScreenContainer from '../ScreenContainer';
import {
  BORDER_RADIUS,
  COLORS,
  FONT_SIZES,
  FONT_WEIGHTS,
  SPACING,
} from '../../constants/theme';

const tableMetrics = [
  { label: 'Available', value: '8', tone: COLORS.success, symbol: 'A' },
  { label: 'Occupied', value: '14', tone: COLORS.primary, symbol: 'O' },
  { label: 'Reserved', value: '6', tone: COLORS.warning, symbol: 'R' },
  { label: 'Cleaning', value: '2', tone: COLORS.info, symbol: 'C' },
];

export default function HostDashboard() {
  return (
    <ScreenContainer scrollable={false} style={styles.screen}>
      <View style={styles.page}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <View style={styles.brandLockup}>
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkText}>Q</Text>
              </View>
              <View>
                <Text style={styles.brandName}>QueueDine</Text>
                <Text style={styles.brandCaption}>STAFF PORTAL</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.avatar} accessibilityLabel="Staff profile">
              <Text style={styles.avatarText}>TS</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.greetingRow}>
            <View style={styles.greetingCopy}>
              <Text style={styles.eyebrow}>HOST DASHBOARD</Text>
              <Text style={styles.greeting}>Good evening,</Text>
              <Text style={styles.staffName}>Tharindu Silva</Text>
            </View>
            <View style={styles.dutyBadge}>
              <View style={styles.dutyDot} />
              <Text style={styles.dutyText}>On Duty</Text>
            </View>
          </View>

          <View style={styles.dateRow}>
            <Text style={styles.dateIcon}>CAL</Text>
            <Text style={styles.dateText}>Thu, 24 Apr 2025</Text>
            <Text style={styles.restaurantLabel}>Ember &amp; Oak</Text>
          </View>

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Floor status</Text>
            <Text style={styles.sectionMeta}>LIVE OVERVIEW</Text>
          </View>

          <View style={styles.metricsGrid}>
            {tableMetrics.map((metric) => (
              <View key={metric.label} style={styles.metric}>
                <View style={styles.metricTop}>
                  <View style={[styles.metricMark, { backgroundColor: `${metric.tone}18` }]}>
                    <Text style={[styles.metricMarkText, { color: metric.tone }]}>
                      {metric.symbol}
                    </Text>
                  </View>
                  <Text style={styles.metricLabel}>{metric.label}</Text>
                </View>
                <Text style={styles.metricValue}>{metric.value}</Text>
                <Text style={styles.metricFootnote}>tables</Text>
              </View>
            ))}
          </View>

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Live operations</Text>
            <View style={styles.liveLabel}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>

          <View style={styles.operationsList}>
            <View style={styles.operationRow}>
              <View style={[styles.operationIcon, styles.queueIcon]}>
                <Text style={[styles.operationIconText, { color: COLORS.primary }]}>Q</Text>
              </View>
              <View style={styles.operationCopy}>
                <Text style={styles.operationTitle}>Virtual queue</Text>
                <Text style={styles.operationSubtitle}>12 parties waiting · 4 people ahead</Text>
              </View>
              <View style={styles.operationValue}>
                <Text style={styles.operationNumber}>24 min</Text>
                <Text style={styles.operationStatus}>Active</Text>
              </View>
            </View>

            <View style={styles.operationDivider} />

            <View style={styles.operationRow}>
              <View style={[styles.operationIcon, styles.seatingIcon]}>
                <Text style={[styles.operationIconText, { color: COLORS.info }]}>T</Text>
              </View>
              <View style={styles.operationCopy}>
                <Text style={styles.operationTitle}>Next seating</Text>
                <Text style={styles.operationSubtitle}>Nadeesha Fernando · 4 guests</Text>
              </View>
              <View style={styles.operationValue}>
                <Text style={styles.operationNumber}>T04</Text>
                <Text style={styles.operationStatus}>7:30 PM</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Quick actions</Text>
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryAction]}
              accessibilityRole="button"
              onPress={() => router.push('/staff/add-walk-in')}
            >
              <Text style={styles.actionSymbol}>+</Text>
              <Text style={styles.primaryActionText}>Add Walk-in</Text>
            </TouchableOpacity>
            <View style={[styles.actionButton, styles.secondaryAction]}>
              <Text style={styles.secondaryActionSymbol}>T</Text>
              <Text style={styles.secondaryActionText}>Assign Table</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottomNav}>
          {[
            ['HOME', 'Home'],
            ['QUEUE', 'Queue'],
            ['BOOK', 'Reservations'],
            ['TABLE', 'Tables'],
            ['MORE', 'More'],
          ].map(([symbol, label], index) => (
            <View key={label} style={styles.navItem}>
              <Text style={[styles.navSymbol, index === 0 && styles.activeNavText]}>
                {symbol}
              </Text>
              <Text style={[styles.navLabel, index === 0 && styles.activeNavText]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 0,
    backgroundColor: '#F7F8FA',
  },
  page: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  topBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
  },
  brandName: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
  },
  brandCaption: {
    marginTop: 2,
    color: COLORS.textSecondary,
    fontSize: 9,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0E3E5',
    borderWidth: 1,
    borderColor: '#E5CDD1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  greetingCopy: {
    flex: 1,
  },
  eyebrow: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semibold,
    marginBottom: SPACING.xs,
  },
  greeting: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.medium,
  },
  staffName: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    marginTop: 2,
  },
  dutyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E9F6EF',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  dutyDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  dutyText: {
    color: '#18794E',
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  dateRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#ECEEF1',
  },
  dateIcon: {
    color: COLORS.textSecondary,
    fontSize: 9,
    fontWeight: FONT_WEIGHTS.bold,
    marginRight: SPACING.sm,
  },
  dateText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
  },
  restaurantLabel: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    textAlign: 'right',
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
  },
  sectionMeta: {
    color: COLORS.textSecondary,
    fontSize: 9,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  metric: {
    width: '48.5%',
    minHeight: 112,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#ECEEF1',
  },
  metricTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  metricMark: {
    width: 28,
    height: 28,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricMarkText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
  },
  metricLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
  },
  metricValue: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    marginTop: SPACING.sm,
  },
  metricFootnote: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    marginTop: 1,
  },
  liveLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  liveText: {
    color: COLORS.textSecondary,
    fontSize: 9,
    fontWeight: FONT_WEIGHTS.bold,
  },
  operationsList: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#ECEEF1',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
  },
  operationRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  operationIcon: {
    width: 34,
    height: 34,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueIcon: {
    backgroundColor: '#F7EAEC',
  },
  seatingIcon: {
    backgroundColor: '#EAF3FB',
  },
  operationIconText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
  },
  operationCopy: {
    flex: 1,
    minWidth: 0,
  },
  operationTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  operationSubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    marginTop: 4,
  },
  operationValue: {
    alignItems: 'flex-end',
    minWidth: 52,
  },
  operationNumber: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
  },
  operationStatus: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 4,
  },
  operationDivider: {
    height: 1,
    backgroundColor: '#ECEEF1',
    marginLeft: 42,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  primaryAction: {
    backgroundColor: COLORS.primary,
  },
  secondaryAction: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#E4D4D7',
  },
  actionSymbol: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.regular,
  },
  primaryActionText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  secondaryActionSymbol: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
  },
  secondaryActionText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  bottomNav: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#ECEEF1',
    paddingHorizontal: SPACING.xs,
  },
  navItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  navSymbol: {
    color: COLORS.textLight,
    fontSize: 8,
    fontWeight: FONT_WEIGHTS.bold,
  },
  navLabel: {
    color: COLORS.textSecondary,
    fontSize: 9,
    textAlign: 'center',
  },
  activeNavText: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.bold,
  },
});
