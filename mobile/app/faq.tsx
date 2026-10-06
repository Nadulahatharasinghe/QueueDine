import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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
import ScreenContainer from '../src/components/ScreenContainer';

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: 'How do I make a reservation?',
    answer: 'To make a reservation, browse restaurants on the home screen, select a restaurant, choose your preferred date, time, and number of guests, then confirm your booking.',
  },
  {
    question: 'How does the queue system work?',
    answer: 'When a restaurant is fully booked, you can join a virtual queue. You\'ll receive a queue number and estimated wait time. When your table is ready, you\'ll be notified to come to the restaurant.',
  },
  {
    question: 'Can I cancel my reservation?',
    answer: 'Yes, you can cancel your reservation from the Reservation History section in your profile. Please cancel at least 30 minutes before your reservation time to avoid any inconvenience.',
  },
  {
    question: 'How do I add restaurants to favorites?',
    answer: 'While browsing restaurants, tap the heart icon on any restaurant card to add it to your favorites. You can view all your favorite restaurants from your profile.',
  },
  {
    question: 'What are dining preferences?',
    answer: 'Dining preferences allow you to specify your seating preferences such as Indoor/AC, Outdoor Garden, Window View, or Any. This helps restaurants accommodate your needs better.',
  },
  {
    question: 'How do I edit my profile?',
    answer: 'Go to your profile page and tap "Edit Profile". You can update your name, phone number, and seating preferences. Your email cannot be changed.',
  },
  {
    question: 'How do queue alerts work?',
    answer: 'Queue alerts notify you when your table is ready. You can enable or disable SMS & Queue Alerts from your profile settings.',
  },
  {
    question: 'Is there a fee for using QueueDine?',
    answer: 'QueueDine is free to use for customers. There are no booking fees or subscription charges.',
  },
];

export default function FAQScreen() {
  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: SPACING.xxl }}
      >
        <View style={styles.content}>
          <Text style={styles.introText}>
            Find answers to frequently asked questions about QueueDine.
          </Text>

          {faqs.map((faq, index) => (
            <View key={index} style={styles.faqItem}>
              <Text style={styles.question}>{faq.question}</Text>
              <Text style={styles.answer}>{faq.answer}</Text>
            </View>
          ))}

          <View style={styles.contactSection}>
            <Text style={styles.contactTitle}>Still need help?</Text>
            <Text style={styles.contactText}>
              Contact our support team at support@queuedine.com
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 22,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHTS.bold,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
  },
  content: {
    paddingHorizontal: SPACING.lg,
  },
  introText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  faqItem: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  question: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  answer: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  contactSection: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginTop: SPACING.lg,
    alignItems: 'center',
  },
  contactTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.white,
    marginBottom: SPACING.sm,
  },
  contactText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.white,
    textAlign: 'center',
  },
});
