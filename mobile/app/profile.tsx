import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  Modal,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, SPACING, BORDER_RADIUS, SHADOWS } from '../src/constants/theme';
import ScreenContainer from '../src/components/ScreenContainer';
import CustomButton from '../src/components/CustomButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../src/services/api';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLogoutConfirmationVisible, setIsLogoutConfirmationVisible] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    seatingPreference: '',
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const response = await apiClient.get('/api/users/profile');
      if (response.data) {
        setUser(response.data);
        setFormData({
          fullName: response.data.fullName || '',
          phone: response.data.phone || '',
          seatingPreference: response.data.seatingPreference || '',
        });
        await AsyncStorage.setItem('user', JSON.stringify(response.data));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setFormData({
          fullName: parsedUser.fullName || '',
          phone: parsedUser.phone || '',
          seatingPreference: parsedUser.seatingPreference || '',
        });
      }
    }
  };

  const handleImagePick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        await uploadProfilePicture(uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadProfilePicture = async (uri: string) => {
    try {
      const formData = new FormData();
      formData.append('picture', {
        uri,
        type: 'image/jpeg',
        name: 'profile.jpg',
      } as any);

      const response = await apiClient.post('/api/users/profile/picture', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        transformRequest: [(data) => data],
      });

      if (response.data.profilePicture) {
        setUser({ ...user, profilePicture: response.data.profilePicture });
        await AsyncStorage.setItem('user', JSON.stringify({ ...user, profilePicture: response.data.profilePicture }));
        Alert.alert('Success', 'Profile picture updated successfully');
      }
    } catch (error) {
      console.error('Error uploading picture:', error);
      Alert.alert('Error', 'Failed to upload profile picture');
    }
  };

  const handleDeletePicture = async () => {
    Alert.alert(
      'Delete Profile Picture',
      'Are you sure you want to delete your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete('/api/users/profile/picture');
              setUser({ ...user, profilePicture: null });
              await AsyncStorage.setItem('user', JSON.stringify({ ...user, profilePicture: null }));
              Alert.alert('Success', 'Profile picture deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete profile picture');
            }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    try {
      console.log('Saving profile data:', formData);
      const response = await apiClient.put('/api/users/profile', formData);
      console.log('Save response:', response.data);

      if (response.data) {
        setUser(response.data);
        await AsyncStorage.setItem('user', JSON.stringify(response.data));
        setIsEditing(false);
        Alert.alert('Success', 'Profile updated successfully');
        await loadUserData();
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      router.replace('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleLogout = () => setIsLogoutConfirmationVisible(true);

  if (!user) {
    return (
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={{ backgroundColor: '#F5F5F5' }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Profile Header */}
          <LinearGradient
            colors={['#D4A574', '#8B5A2B']}
            style={styles.headerGradient}
          >
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <View style={styles.profileHeader}>
              <TouchableOpacity style={styles.avatarWrapper} onPress={handleImagePick}>
                {user.profilePicture ? (
                  <Image source={{ uri: user.profilePicture }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>{user.fullName?.charAt(0) || 'U'}</Text>
                  </View>
                )}
                <View style={styles.cameraIcon}>
                  <Text style={styles.cameraIconText}>📷</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.fullName}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>QueueDine Foodie • Gold</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* Stats Section */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Bookings</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Queues</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Favorites</Text>
            </View>
          </View>

          {/* Dining & Account Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DINING & ACCOUNT</Text>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setIsEditing(true)}
            >
              <View style={styles.menuItemLeft}>
                <Text style={styles.menuIcon}>✏️</Text>
                <Text style={styles.menuItemText}>Edit Profile</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Text style={styles.menuIcon}>🍽️</Text>
                <Text style={styles.menuItemText}>Dining Preferences</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Text style={styles.menuIcon}>💳</Text>
                <Text style={styles.menuItemText}>Payment Methods</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Activity & Records Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ACTIVITY & RECORDS</Text>

            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Text style={styles.menuIcon}>❤️</Text>
                <Text style={styles.menuItemText}>Favorite Restaurants</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Text style={styles.menuIcon}>📜</Text>
                <Text style={styles.menuItemText}>Reservation History</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>

            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Text style={styles.menuIcon}>🔔</Text>
                <Text style={styles.menuItemText}>SMS & Queue Alerts</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#767577', true: '#D4A574' }}
                thumbColor={notificationsEnabled ? '#FFFFFF' : '#FFFFFF'}
              />
            </View>
          </View>

          {/* Support & About Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SUPPORT & ABOUT</Text>

            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Text style={styles.menuIcon}>❓</Text>
                <Text style={styles.menuItemText}>Help & Support</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Text style={styles.menuIcon}>ℹ️</Text>
                <Text style={styles.menuItemText}>About QueueDine</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteAccountButton}>
            <Text style={styles.deleteAccountText}>Delete or deactivate account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={isLogoutConfirmationVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLogoutConfirmationVisible(false)}
      >
        <View style={styles.logoutModalOverlay}>
          <View style={styles.logoutModal}>
            <View style={styles.logoutModalIcon}>
              <Text style={styles.logoutModalIconText}>↪</Text>
            </View>
            <Text style={styles.logoutModalTitle}>Logout</Text>
            <Text style={styles.logoutModalMessage}>Are you sure you want to logout?</Text>
            <View style={styles.logoutModalActions}>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.logoutCancelButton}
                onPress={() => setIsLogoutConfirmationVisible(false)}
              >
                <Text style={styles.logoutCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.logoutConfirmButton}
                onPress={() => {
                  setIsLogoutConfirmationVisible(false);
                  void signOut();
                }}
              >
                <Text style={styles.logoutConfirmText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditing}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsEditing(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.modalSave}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.editAvatarContainer}>
              <TouchableOpacity onPress={handleImagePick}>
                {user.profilePicture ? (
                  <Image source={{ uri: user.profilePicture }} style={styles.editAvatar} />
                ) : (
                  <View style={styles.editAvatarPlaceholder}>
                    <Text style={styles.editAvatarText}>{user.fullName?.charAt(0) || 'U'}</Text>
                  </View>
                )}
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.editForm}>
              <View style={styles.editFormGroup}>
                <Text style={styles.editLabel}>Full Name</Text>
                <TextInput
                  style={styles.editInput}
                  value={formData.fullName}
                  onChangeText={(text) => setFormData({ ...formData, fullName: text })}
                  placeholder="Enter your full name"
                />
              </View>

              <View style={styles.editFormGroup}>
                <Text style={styles.editLabel}>Email</Text>
                <TextInput
                  style={[styles.editInput, styles.editInputDisabled]}
                  value={user.email}
                  editable={false}
                />
              </View>

              <View style={styles.editFormGroup}>
                <Text style={styles.editLabel}>Phone</Text>
                <TextInput
                  style={styles.editInput}
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  placeholder="Enter your phone number"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.editFormGroup}>
                <Text style={styles.editLabel}>Seating Preference</Text>
                <TextInput
                  style={styles.editInput}
                  value={formData.seatingPreference}
                  onChangeText={(text) => setFormData({ ...formData, seatingPreference: text })}
                  placeholder="Indoor / AC, Outdoor Garden, Window View, Any"
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  content: {
    paddingBottom: 80,
  },
  headerGradient: {
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
  },
  backButton: {
    position: 'absolute',
    top: SPACING.xl,
    left: SPACING.lg,
    zIndex: 1,
  },
  backButtonText: {
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: FONT_WEIGHTS.bold,
  },
  profileHeader: {
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: '#8B5A2B',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D4A574',
  },
  cameraIconText: {
    fontSize: 16,
  },
  userInfo: {
    alignItems: 'center',
  },
  userName: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: '#FFFFFF',
    marginBottom: SPACING.xs,
  },
  userEmail: {
    fontSize: FONT_SIZES.sm,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: SPACING.sm,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  badgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semibold,
    color: '#FFFFFF',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: SPACING.lg,
    marginTop: -SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.xxl,
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
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    fontSize: 24,
    marginRight: SPACING.md,
  },
  menuItemText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
  },
  menuArrow: {
    fontSize: FONT_SIZES.xxl,
    color: COLORS.textLight,
  },
  logoutButton: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  logoutButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.error,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  logoutModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: 'rgba(26, 26, 26, 0.45)',
  },
  logoutModal: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: COLORS.white,
    ...SHADOWS.lg,
  },
  logoutModalIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#FCE8E6',
  },
  logoutModalIconText: {
    fontSize: FONT_SIZES.xxl,
    color: COLORS.error,
  },
  logoutModalTitle: {
    marginBottom: SPACING.sm,
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
  },
  logoutModalMessage: {
    marginBottom: SPACING.lg,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  logoutModalActions: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: SPACING.sm,
  },
  logoutCancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.white,
  },
  logoutCancelText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.textSecondary,
  },
  logoutConfirmButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  logoutConfirmText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.white,
  },
  deleteAccountButton: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  deleteAccountText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
    textDecorationLine: 'underline',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalCancel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
  },
  modalSave: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  modalContent: {
    flex: 1,
    padding: SPACING.lg,
  },
  editAvatarContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  editAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: SPACING.md,
  },
  editAvatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  editAvatarText: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.white,
  },
  changePhotoText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  editForm: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  editFormGroup: {
    marginBottom: SPACING.lg,
  },
  editLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  editInput: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#FFFFFF',
  },
  editInputDisabled: {
    backgroundColor: COLORS.surface,
    color: COLORS.textLight,
  },
});
