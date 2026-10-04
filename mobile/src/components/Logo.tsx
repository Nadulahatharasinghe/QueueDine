import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZES, FONT_WEIGHTS } from '../constants/theme';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
}

const Logo: React.FC<LogoProps> = ({ size = 'medium' }) => {
  const getFontSize = () => {
    switch (size) {
      case 'small':
        return FONT_SIZES.lg;
      case 'large':
        return FONT_SIZES.xxxl;
      default:
        return FONT_SIZES.xxl;
    }
  };

  const getTaglineSize = () => {
    switch (size) {
      case 'small':
        return FONT_SIZES.xs;
      case 'large':
        return FONT_SIZES.md;
      default:
        return FONT_SIZES.sm;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.logo, { fontSize: getFontSize() }]}>QueueDine</Text>
      <Text style={[styles.tagline, { fontSize: getTaglineSize() }]}>
        WAIT LESS. DINE BETTER.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  logo: {
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    letterSpacing: 1,
  },
  tagline: {
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
    marginTop: 4,
    letterSpacing: 2,
  },
});

export default Logo;
