import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  ManagerShell,
  burgundy,
  darkText,
} from '../../src/components/manager/ManagerUI';
import {
  UserAvatar,
  SettingsIcon,
  BellIcon,
  ShieldIcon,
  HelpIcon,
  InfoIcon,
  EditIcon,
  LockIcon,
  CloseIcon,
  CheckIcon,
} from '../../src/components/manager/ManagerIcons';
import { useStaffSession, signOutStaff, updateStaff } from '../../src/services/staffAuth';
import {
  getManagerProfile,
  updateManagerProfile,
  changeManagerPassword,
  ManagerProfileDetails,
} from '../../src/services/managerData';

function showDialog(title: string, message: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function ManagerProfileScreen() {
  const staff = useStaffSession();
  const [profileData, setProfileData] = useState<ManagerProfileDetails | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Edit Profile Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  // Change Password Modal State
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Load real profile from backend
  const loadProfile = useCallback(async () => {
    try {
      const res = await getManagerProfile();
      setProfileData(res);
      setEditName(res.fullName);
      setEditEmail(res.email);
    } catch {
      // Fallback to active session
      if (staff) {
        setEditName(staff.fullName || '');
        setEditEmail(staff.email || '');
      }
    }
  }, [staff]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile])
  );

  const displayName = profileData?.fullName || staff?.fullName || 'R. Perera';
  const displayEmail = profileData?.email || staff?.email || 'manager@example.com';
  const displayStaffId = profileData?.staffId || staff?.staffId || 'manager-001';

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'MN';

  // Cross-Platform Sign Out Function
  const executeSignOut = async () => {
    setSigningOut(true);
    try {
      await signOutStaff();
    } catch {
      // Ignore
    } finally {
      setSigningOut(false);
      router.replace('/staff/login');
    }
  };

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' ? window.confirm('Are you sure you want to sign out of the Manager Portal?') : true;
      if (confirmed) {
        void executeSignOut();
      }
    } else {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out of the Manager Portal?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: () => void executeSignOut(),
          },
        ]
      );
    }
  };

  // Open Edit Profile Modal
  const openEditModal = () => {
    setEditName(displayName);
    setEditEmail(displayEmail);
    setEditError('');
    setEditSuccess('');
    setEditModalVisible(true);
  };

  // Handle Save Profile
  const handleSaveProfile = async () => {
    if (!editName.trim() || editName.trim().length < 2) {
      setEditError('Full name must be at least 2 characters.');
      return;
    }
    if (!editEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())) {
      setEditError('Please enter a valid email address.');
      return;
    }

    setEditLoading(true);
    setEditError('');
    setEditSuccess('');

    try {
      const updated = await updateManagerProfile({
        fullName: editName.trim(),
        email: editEmail.trim(),
      });

      setProfileData((prev) => (prev ? { ...prev, ...updated } : updated));
      if (staff) {
        updateStaff({
          ...staff,
          fullName: updated.fullName,
          email: updated.email,
        });
      }

      setEditSuccess('Profile updated successfully!');
      setTimeout(() => {
        setEditModalVisible(false);
        setEditSuccess('');
      }, 1200);
    } catch (err: any) {
      setEditError(err?.response?.data?.error || err?.message || 'Failed to update profile.');
    } finally {
      setEditLoading(false);
    }
  };

  // Open Change Password Modal
  const openPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSuccess('');
    setPasswordModalVisible(true);
  };

  // Handle Change Password
  const handleChangePassword = async () => {
    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordLoading(true);
    setPasswordError('');
    setPasswordSuccess('');

    try {
      await changeManagerPassword({
        currentPassword,
        newPassword,
      });

      setPasswordSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPasswordModalVisible(false);
        setPasswordSuccess('');
      }, 1400);
    } catch (err: any) {
      setPasswordError(err?.response?.data?.error || err?.message || 'Failed to update password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const menuItems = [
    {
      title: 'Edit Profile Details',
      subtitle: 'Update your name and email address',
      icon: <EditIcon size={18} color="#697386" />,
      action: openEditModal,
    },
    {
      title: 'Change Password',
      subtitle: 'Update your security credentials',
      icon: <LockIcon size={18} color="#697386" />,
      action: openPasswordModal,
    },
    {
      title: 'Restaurant Settings',
      subtitle: 'Capacity: 12 tables / 50 seats · 11 AM – 11 PM',
      icon: <SettingsIcon size={18} color="#697386" />,
      action: () => showDialog('Restaurant Settings', 'Restaurant: Ember & Oak\nLocation: Colombo, Sri Lanka\nOperating Hours: 11:00 AM – 11:00 PM\nCapacity: 12 tables / 50 seats.'),
    },
    {
      title: 'Notification Preferences',
      subtitle: 'Queue alerts and end-of-day summaries',
      icon: <BellIcon size={18} color="#697386" />,
      action: () => showDialog('Notification Preferences', 'Queue volume alerts: Enabled\nWalkaway detections: Enabled\nEnd-of-day reports: Enabled'),
    },
    {
      title: 'Help & Support',
      subtitle: 'QueueDine customer care hotline',
      icon: <HelpIcon size={18} color="#697386" />,
      action: () => showDialog('Help & Support', 'QueueDine Technical Support:\nEmail: support@queuedine.com\nHotline: +94 11 234 5678'),
    },
    {
      title: 'About QueueDine',
      subtitle: 'Version 2.4.0 · Management Portal',
      icon: <InfoIcon size={18} color="#697386" />,
      action: () => showDialog('About QueueDine', 'QueueDine v2.4.0\nRestaurant Table Reservation & Queue Management System\nUniversity Final Project'),
    },
  ];

  return (
    <ManagerShell title="Profile & Settings">
      {/* Profile Card with interactive Edit action */}
      <Pressable
        style={({ pressed }) => [
          styles.profileCard,
          pressed && { opacity: 0.9, borderColor: burgundy },
        ]}
        onPress={openEditModal}
        accessibilityRole="button"
        accessibilityLabel="Edit profile details"
      >
        <UserAvatar initials={initials} size={60} />
        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.managerName}>{displayName}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>Manager</Text>
            </View>
          </View>
          <Text style={styles.managerEmail}>{displayEmail}</Text>
          <Text style={styles.restaurantMeta}>
            ID: {displayStaffId} · Ember & Oak, Colombo
          </Text>
        </View>
        <View style={styles.editPill}>
          <EditIcon size={14} color={burgundy} />
          <Text style={styles.editPillText}>Edit</Text>
        </View>
      </Pressable>

      {/* Menu List */}
      <View style={styles.menuContainer}>
        {menuItems.map((item, idx) => (
          <Pressable
            key={item.title}
            style={({ pressed }) => [
              styles.menuRow,
              idx === 0 && { borderTopWidth: 0 },
              pressed && { backgroundColor: '#F9FAFB' },
            ]}
            onPress={item.action}
            accessibilityRole="button"
            accessibilityLabel={item.title}
          >
            <View style={styles.menuLeft}>
              <View style={styles.iconBox}>{item.icon}</View>
              <View>
                <Text style={styles.menuTitle}>{item.title}</Text>
                {item.subtitle ? (
                  <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                ) : null}
              </View>
            </View>
            <Text style={styles.menuChevron}>›</Text>
          </Pressable>
        ))}
      </View>

      {/* Sign Out Button */}
      <Pressable
        style={({ pressed }) => [
          styles.signOutBtn,
          pressed && { opacity: 0.8 },
          signingOut && { opacity: 0.6 },
        ]}
        onPress={handleSignOut}
        disabled={signingOut}
        accessibilityRole="button"
        accessibilityLabel="Sign Out"
      >
        {signingOut ? (
          <View style={styles.btnRow}>
            <ActivityIndicator size="small" color="#D92D4B" />
            <Text style={styles.signOutText}>Signing Out...</Text>
          </View>
        ) : (
          <Text style={styles.signOutText}>Sign Out</Text>
        )}
      </Pressable>

      {/* App Branding Footer */}
      <View style={styles.footerBranding}>
        <Text style={styles.versionText}>QueueDine v2.4.0</Text>
        <Text style={styles.taglineText}>Wait Less. Dine Better</Text>
      </View>

      {/* ================= EDIT PROFILE MODAL ================= */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Edit Profile Details</Text>
                <Text style={styles.modalSubtitle}>Update your personal and contact details</Text>
              </View>
              <Pressable
                style={styles.closeBtn}
                onPress={() => setEditModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close modal"
              >
                <CloseIcon size={18} color="#697386" />
              </Pressable>
            </View>

            {/* Error / Success Banners */}
            {editError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{editError}</Text>
              </View>
            ) : null}

            {editSuccess ? (
              <View style={styles.successBanner}>
                <CheckIcon size={16} color="#0E9384" />
                <Text style={styles.successBannerText}>{editSuccess}</Text>
              </View>
            ) : null}

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {/* Staff ID (Read Only) */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Staff ID (System Identifier)</Text>
                <View style={styles.readOnlyInput}>
                  <Text style={styles.readOnlyText}>{displayStaffId}</Text>
                  <View style={styles.lockBadge}>
                    <Text style={styles.lockBadgeText}>Read-only</Text>
                  </View>
                </View>
              </View>

              {/* Full Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Full Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="e.g. R. Perera"
                  placeholderTextColor="#98A2B3"
                  autoCapitalize="words"
                />
              </View>

              {/* Email / Username */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Email Address / Username</Text>
                <TextInput
                  style={styles.textInput}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="e.g. manager@example.com"
                  placeholderTextColor="#98A2B3"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Role */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Role & Permissions</Text>
                <View style={styles.readOnlyInput}>
                  <Text style={styles.readOnlyText}>Restaurant Manager</Text>
                  <View style={styles.badgeGreen}>
                    <Text style={styles.badgeGreenText}>Full Access</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setEditModalVisible(false)}
                disabled={editLoading}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, editLoading && { opacity: 0.7 }]}
                onPress={handleSaveProfile}
                disabled={editLoading}
              >
                {editLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================= CHANGE PASSWORD MODAL ================= */}
      <Modal
        visible={passwordModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Change Password</Text>
                <Text style={styles.modalSubtitle}>Enter your current and new credentials</Text>
              </View>
              <Pressable
                style={styles.closeBtn}
                onPress={() => setPasswordModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close modal"
              >
                <CloseIcon size={18} color="#697386" />
              </Pressable>
            </View>

            {/* Error / Success Banners */}
            {passwordError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{passwordError}</Text>
              </View>
            ) : null}

            {passwordSuccess ? (
              <View style={styles.successBanner}>
                <CheckIcon size={16} color="#0E9384" />
                <Text style={styles.successBannerText}>{passwordSuccess}</Text>
              </View>
            ) : null}

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {/* Current Password */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Current Password</Text>
                <TextInput
                  style={styles.textInput}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter your current password"
                  placeholderTextColor="#98A2B3"
                  secureTextEntry={true}
                />
              </View>

              {/* New Password */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>New Password</Text>
                <TextInput
                  style={styles.textInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor="#98A2B3"
                  secureTextEntry={true}
                />
              </View>

              {/* Confirm New Password */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Confirm New Password</Text>
                <TextInput
                  style={styles.textInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter your new password"
                  placeholderTextColor="#98A2B3"
                  secureTextEntry={true}
                />
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setPasswordModalVisible(false)}
                disabled={passwordLoading}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, passwordLoading && { opacity: 0.7 }]}
                onPress={handleChangePassword}
                disabled={passwordLoading}
              >
                {passwordLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Update Password</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ManagerShell>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EDEEF2',
    boxShadow: '0 1px 3px rgba(16,24,40,0.04)',
    marginVertical: 8,
    gap: 14,
  },
  profileInfo: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  managerName: {
    fontSize: 17,
    fontWeight: '800',
    color: darkText,
  },
  roleBadge: {
    backgroundColor: '#F9EBEF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    color: burgundy,
    fontSize: 11,
    fontWeight: '700',
  },
  managerEmail: {
    fontSize: 13,
    color: '#475467',
    fontWeight: '500',
  },
  restaurantMeta: {
    fontSize: 12,
    color: '#98A2B3',
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FDF2F4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F9D4DC',
  },
  editPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: burgundy,
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#EDEEF2',
    marginVertical: 12,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F2F4F7',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#EAECF0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: darkText,
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#98A2B3',
    marginTop: 2,
  },
  menuChevron: {
    fontSize: 20,
    color: '#98A2B3',
  },
  signOutBtn: {
    backgroundColor: '#FFF0F3',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECDCA',
    marginTop: 8,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#D92D4B',
  },
  footerBranding: {
    alignItems: 'center',
    marginVertical: 24,
    gap: 4,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#98A2B3',
  },
  taglineText: {
    fontSize: 11,
    color: '#D0D5DD',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 480,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: darkText,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#697386',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F4F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#344054',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: darkText,
  },
  readOnlyInput: {
    backgroundColor: '#F2F4F7',
    borderWidth: 1,
    borderColor: '#EAECF0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readOnlyText: {
    fontSize: 14,
    color: '#697386',
    fontWeight: '500',
  },
  lockBadge: {
    backgroundColor: '#EAECF0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lockBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#697386',
  },
  badgeGreen: {
    backgroundColor: '#ECFDF3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeGreenText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0E9384',
  },
  errorBanner: {
    backgroundColor: '#FEF3F2',
    borderWidth: 1,
    borderColor: '#FECDCA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  errorBannerText: {
    color: '#B42318',
    fontSize: 12,
    fontWeight: '600',
  },
  successBanner: {
    backgroundColor: '#ECFDF3',
    borderWidth: 1,
    borderColor: '#A6F4C5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  successBannerText: {
    color: '#0E9384',
    fontSize: 12,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F2F4F7',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F2F4F7',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475467',
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: burgundy,
    minWidth: 110,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
