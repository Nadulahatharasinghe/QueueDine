import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ManagerShell,
  burgundy,
  darkText,
} from '../../src/components/manager/ManagerUI';
import { CalendarIcon } from '../../src/components/manager/ManagerIcons';

export default function SelectDateRangeScreen() {
  const params = useLocalSearchParams<{
    returnTo?: string;
    currentRange?: string;
    from?: string;
    to?: string;
  }>();

  const todayStr = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const defaultFromStr = weekAgo.toISOString().slice(0, 10);

  // Normalize initial selection
  const initialOption = (() => {
    const cur = params.currentRange || '';
    if (cur.toLowerCase().includes('30')) return 'Last 30 Days';
    if (cur.toLowerCase().includes('yesterday')) return 'Yesterday';
    if (cur.toLowerCase().includes('today')) return 'Today';
    if (cur.toLowerCase().includes('custom') || cur.includes('-')) return 'Custom Range';
    return 'Last 7 Days';
  })();

  const [selectedRange, setSelectedRange] = useState(initialOption);
  const [fromDate, setFromDate] = useState(params.from || defaultFromStr);
  const [toDate, setToDate] = useState(params.to || todayStr);

  const options = [
    'Today',
    'Yesterday',
    'Last 7 Days',
    'Last 30 Days',
    'Custom Range',
  ];

  const handleApplyPreset = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    setFromDate(d.toISOString().slice(0, 10));
    setToDate(todayStr);
  };

  const handleApply = () => {
    let apiRange = 'last-7-days';
    let rangeLabel = selectedRange;

    if (selectedRange === 'Today') {
      apiRange = 'today';
      rangeLabel = 'Today';
    } else if (selectedRange === 'Yesterday') {
      apiRange = 'yesterday';
      rangeLabel = 'Yesterday';
    } else if (selectedRange === 'Last 7 Days') {
      apiRange = 'last-7-days';
      rangeLabel = 'Last 7 Days';
    } else if (selectedRange === 'Last 30 Days') {
      apiRange = 'last-30-days';
      rangeLabel = 'Last 30 Days';
    } else if (selectedRange === 'Custom Range') {
      apiRange = 'custom';
      // Validate dates
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
        Alert.alert('Invalid Date', 'Please enter dates in YYYY-MM-DD format (e.g. 2025-04-18).');
        return;
      }
      const fromObj = new Date(fromDate);
      const toObj = new Date(toDate);
      if (fromObj > toObj) {
        Alert.alert('Invalid Range', 'Start date must be before or equal to End date.');
        return;
      }
      rangeLabel = `${fromObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${toObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }

    const targetRoute = params.returnTo || '/manager/analytics';
    router.replace({
      pathname: targetRoute as any,
      params: {
        range: apiRange,
        rangeLabel,
        from: selectedRange === 'Custom Range' ? fromDate : undefined,
        to: selectedRange === 'Custom Range' ? toDate : undefined,
      },
    });
  };

  const footer = (
    <Pressable
      style={styles.applyBtn}
      onPress={handleApply}
      accessibilityRole="button"
      accessibilityLabel="Apply Date Range"
    >
      <Text style={styles.applyBtnText}>Apply</Text>
    </Pressable>
  );

  return (
    <ManagerShell title="Select Date Range" footer={footer}>
      <View style={styles.radioGroup}>
        {options.map((opt) => {
          const isSelected = selectedRange === opt;
          return (
            <View key={opt}>
              <Pressable
                style={styles.radioRow}
                onPress={() => setSelectedRange(opt)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                  {isSelected && <View style={styles.radioInnerDot} />}
                </View>
                <Text style={[styles.radioLabel, isSelected && styles.radioLabelSelected]}>
                  {opt}
                </Text>
              </Pressable>

              {/* Custom Date Range Card */}
              {opt === 'Custom Range' && isSelected && (
                <View style={styles.customContainer}>
                  <Text style={styles.customHint}>
                    Select or enter your desired date range:
                  </Text>

                  <View style={styles.quickPresetRow}>
                    <Pressable
                      style={styles.quickPresetPill}
                      onPress={() => handleApplyPreset(14)}
                    >
                      <Text style={styles.quickPresetText}>Last 14 Days</Text>
                    </Pressable>
                    <Pressable
                      style={styles.quickPresetPill}
                      onPress={() => handleApplyPreset(30)}
                    >
                      <Text style={styles.quickPresetText}>Last 30 Days</Text>
                    </Pressable>
                    <Pressable
                      style={styles.quickPresetPill}
                      onPress={() => handleApplyPreset(60)}
                    >
                      <Text style={styles.quickPresetText}>Last 60 Days</Text>
                    </Pressable>
                  </View>

                  <View style={styles.inputsRow}>
                    <View style={styles.inputCol}>
                      <Text style={styles.inputLabel}>Start Date</Text>
                      <View style={styles.inputWrapper}>
                        <CalendarIcon size={14} color="#697386" />
                        <TextInput
                          style={styles.dateTextInput}
                          value={fromDate}
                          onChangeText={setFromDate}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor="#98A2B3"
                          autoCapitalize="none"
                        />
                      </View>
                    </View>

                    <View style={styles.inputCol}>
                      <Text style={styles.inputLabel}>End Date</Text>
                      <View style={styles.inputWrapper}>
                        <CalendarIcon size={14} color="#697386" />
                        <TextInput
                          style={styles.dateTextInput}
                          value={toDate}
                          onChangeText={setToDate}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor="#98A2B3"
                          autoCapitalize="none"
                        />
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ManagerShell>
  );
}

const styles = StyleSheet.create({
  radioGroup: {
    paddingTop: 16,
    gap: 20,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#98A2B3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: burgundy,
  },
  radioInnerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: burgundy,
  },
  radioLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: darkText,
  },
  radioLabelSelected: {
    fontWeight: '700',
    color: burgundy,
  },
  customContainer: {
    marginTop: 8,
    marginLeft: 38,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAECF0',
    gap: 12,
  },
  customHint: {
    fontSize: 12,
    color: '#697386',
    fontWeight: '500',
  },
  quickPresetRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  quickPresetPill: {
    backgroundColor: '#F9EBEF',
    borderWidth: 1,
    borderColor: '#F0CED5',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  quickPresetText: {
    fontSize: 11,
    fontWeight: '700',
    color: burgundy,
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputCol: {
    flex: 1,
    gap: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#697386',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#EAECF0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  dateTextInput: {
    flex: 1,
    fontSize: 13,
    color: darkText,
    padding: 0,
    fontWeight: '500',
  },
  applyBtn: {
    backgroundColor: burgundy,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
