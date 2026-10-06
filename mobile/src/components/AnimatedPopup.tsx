import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BORDER_RADIUS,
  COLORS,
  FONT_SIZES,
  FONT_WEIGHTS,
  SHADOWS,
  SPACING,
} from '../constants/theme';

interface AnimatedPopupProps {
  visible: boolean;
  variant?: 'success' | 'confirmation';
  title: string;
  message: string;
  buttonText?: string;
  cancelText?: string;
  onCancel?: () => void;
  onContinue: () => void;
}

const useNativeDriver = Platform.OS !== 'web';

const AnimatedPopup: React.FC<AnimatedPopupProps> = ({
  visible,
  variant = 'success',
  title,
  message,
  buttonText,
  cancelText = 'Cancel',
  onCancel,
  onContinue,
}) => {
  const [opacity] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(0.82));

  useEffect(() => {
    if (!visible) return;

    opacity.setValue(0);
    scale.setValue(0.82);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 14,
        stiffness: 180,
        useNativeDriver,
      }),
    ]).start();
  }, [opacity, scale, visible]);

  const dismiss = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.quad),
        useNativeDriver,
      }),
      Animated.timing(scale, {
        toValue: 0.92,
        duration: 150,
        easing: Easing.in(Easing.quad),
        useNativeDriver,
      }),
    ]).start(({ finished }) => {
      if (finished) callback();
    });
  };

  const cancel = () => dismiss(onCancel ?? onContinue);
  const primaryAction = () => dismiss(onContinue);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={variant === 'confirmation' ? cancel : primaryAction}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity }]} />
        <Animated.View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[styles.card, { opacity, transform: [{ scale }] }]}
        >
          <View
            style={[
              styles.iconOuter,
              variant === 'confirmation' ? styles.confirmIconOuter : undefined,
            ]}
          >
            <View
              style={[
                styles.iconInner,
                variant === 'confirmation' ? styles.confirmIconInner : undefined,
              ]}
            >
              <Text style={styles.checkmark}>
                {variant === 'confirmation' ? '?' : '\u2713'}
              </Text>
            </View>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {variant === 'confirmation' ? (
            <View style={styles.actions}>
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={cancel}
                style={[styles.button, styles.cancelButton]}
              >
                <Text style={[styles.buttonText, styles.cancelButtonText]}>
                  {cancelText}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={primaryAction}
                style={[styles.button, styles.confirmButton]}
              >
                <Text style={styles.buttonText}>
                  {buttonText ?? 'Yes, Cancel'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={primaryAction}
              style={styles.button}
            >
              <Text style={styles.buttonText}>{buttonText ?? 'Continue'}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(20, 16, 16, 0.52)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    ...SHADOWS.lg,
  },
  iconOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  confirmIconOuter: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
  },
  iconInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmIconInner: {
    backgroundColor: COLORS.warning,
  },
  checkmark: {
    color: COLORS.white,
    fontSize: 34,
    fontWeight: FONT_WEIGHTS.bold,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  message: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  button: {
    width: '100%',
    minHeight: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    color: COLORS.textPrimary,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: COLORS.error,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semibold,
  },
});

export default AnimatedPopup;
