import React, { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarIcon, ChevronDownIcon, ChevronLeftIcon } from './ManagerIcons';

export const burgundy = '#801D26';
export const darkText = '#151D2E';
export const mutedText = '#697386';
export const green = '#0E9384';
export const blue = '#2E90FA';
export const orange = '#F79009';

export type ManagerTab = 'dashboard' | 'operations' | 'analytics' | 'reports';

export function ManagerShell({
  title,
  tab,
  children,
  onRefresh,
  refreshing = false,
  headerAction,
  customHeader,
  footer,
}: {
  title?: string;
  tab?: ManagerTab;
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  headerAction?: ReactNode;
  customHeader?: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.outer}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={[styles.page, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Header */}
        {customHeader ? (
          customHeader
        ) : (
          <View style={styles.header}>
            {!tab ? (
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/manager/dashboard'))}
                style={styles.headerButton}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <ChevronLeftIcon size={20} color={darkText} />
              </Pressable>
            ) : (
              <View style={{ width: 12 }} />
            )}
            <Text style={styles.headerTitle}>{title || ''}</Text>
            {headerAction ? (
              headerAction
            ) : (
              <View style={styles.headerButton} />
            )}
          </View>
        )}

        {/* Scrollable Content */}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: tab ? 36 : 24 },
          ]}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={burgundy} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>

        {/* Optional Fixed Footer Button */}
        {footer && <View style={styles.footer}>{footer}</View>}

        {/* Bottom 4-Tab Bar */}
        {tab && (
          <View style={styles.bottomNav}>
            {[
              { id: 'dashboard', label: 'Home', icon: '⌂', route: '/manager/dashboard' },
              { id: 'operations', label: 'Operations', icon: '▦', route: '/manager/operations' },
              { id: 'analytics', label: 'Analytics', icon: '☷', route: '/manager/analytics' },
              { id: 'reports', label: 'Reports', icon: '▤', route: '/manager/reports' },
            ].map((item) => {
              const active = tab === item.id;
              return (
                <Pressable
                  key={item.id}
                  style={styles.tabItem}
                  onPress={() => {
                    if (!active) router.replace(item.route as '/manager/dashboard');
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={item.label}
                >
                  <Text style={[styles.tabIcon, active && styles.activeTabColor]}>
                    {item.icon}
                  </Text>
                  <Text style={[styles.tabLabel, active && styles.activeTabColor]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

// Reusable Metric Card matching Figma
export function MetricCard({
  value,
  label,
  delta,
  isPositive = true,
  toneColor,
  flex = 1,
  onPress,
}: {
  value: string | number;
  label: string;
  delta?: string;
  isPositive?: boolean;
  toneColor?: string;
  flex?: number;
  onPress?: () => void;
}) {
  const content = (
    <View style={[styles.metricCard, { flex }]}>
      <Text style={[styles.metricValue, toneColor ? { color: toneColor } : null]}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {delta ? (
        <View style={styles.deltaRow}>
          <Text
            style={[
              styles.deltaText,
              { color: isPositive ? '#0E9384' : '#D92D4B' },
            ]}
          >
            {delta.startsWith('+') || delta.startsWith('-')
              ? (isPositive ? '▲ ' : '▼ ') + delta.replace(/[+-]/, '')
              : delta}
          </Text>
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={{ flex }}>
        {content}
      </Pressable>
    );
  }
  return content;
}

// Date Selector Bar with clean Calendar Icon and aligned Chevron
export function DateSelectorBar({
  dateText = 'Thu, 24 Apr 2025',
  rangeText = 'Today',
  onPress,
}: {
  dateText?: string;
  rangeText?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={styles.dateBar}
      onPress={onPress || (() => router.push('/manager/date-range'))}
      accessibilityRole="button"
      accessibilityLabel="Select Date Range"
    >
      <View style={styles.dateLeft}>
        <CalendarIcon size={16} color="#697386" />
        <Text style={styles.dateText}>{dateText}</Text>
      </View>
      <View style={styles.dropdownBtn}>
        <Text style={styles.dropdownText}>{rangeText}</Text>
        <ChevronDownIcon size={11} color="#475467" />
      </View>
    </Pressable>
  );
}

export function FeedbackBox({
  loading,
  error,
  retry,
}: {
  loading?: boolean;
  error?: string;
  retry?: () => void;
}) {
  return (
    <>
      {loading && <ActivityIndicator color={burgundy} style={{ marginVertical: 24 }} />}
      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          {retry && (
            <Pressable style={styles.retryBtn} onPress={retry}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </Pressable>
          )}
        </View>
      )}
    </>
  );
}

export function EmptyState({
  title = 'No Data',
  detail = 'There are no records to display.',
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptySymbol}>○</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDetail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 448,
    backgroundColor: '#FAFAFC',
  },
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFC',
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 32,
    color: darkText,
    fontWeight: '300',
    marginTop: -4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: darkText,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F1F3',
  },
  bottomNav: {
    minHeight: 62,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F0F1F3',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 3,
  },
  tabIcon: {
    fontSize: 22,
    color: '#98A2B3',
  },
  tabLabel: {
    fontSize: 11,
    color: '#98A2B3',
    fontWeight: '500',
  },
  activeTabColor: {
    color: burgundy,
    fontWeight: '700',
  },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#F0F1F3',
    boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
    marginVertical: 4,
  },
  dateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: darkText,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#EAECF0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  dropdownText: {
    fontSize: 13,
    color: '#475467',
    fontWeight: '500',
  },
  dropdownChevron: {
    fontSize: 13,
    color: '#475467',
    marginTop: -2,
  },
  metricCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F1F3',
    boxShadow: '0 1px 3px rgba(16,24,40,0.04)',
    gap: 4,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
    color: darkText,
  },
  metricLabel: {
    fontSize: 12,
    color: '#697386',
    fontWeight: '500',
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  deltaText: {
    fontSize: 12,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#FEF3F2',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    alignItems: 'center',
  },
  errorText: {
    color: '#B42318',
    fontSize: 13,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECDCA',
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B42318',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptySymbol: {
    fontSize: 40,
    color: '#D0D5DD',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: darkText,
  },
  emptyDetail: {
    fontSize: 13,
    color: '#697386',
    textAlign: 'center',
    maxWidth: 260,
  },
});
