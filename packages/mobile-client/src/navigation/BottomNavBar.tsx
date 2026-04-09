/**
 * Bottom Navigation Bar Component
 *
 * Implements the bottom navigation bar with glassmorphism effect,
 * 4 navigation items, and haptic feedback.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.12, 11.1
 */

import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useDesignSystem } from '../design-system';
import { Text } from '../design-system/typography/Text';
import { Icon, type IconName } from '../design-system/components/Icon';

/**
 * Navigation item configuration
 */
interface NavItem {
  key: string;
  label: string;
  icon: IconName;
}

/**
 * BottomNavBar props
 */
interface BottomNavBarProps {
  activeRoute: string;
  onNavigate: (route: string) => void;
}

/**
 * Navigation items configuration
 * Requirements: 8.1, 8.2
 */
const NAV_ITEMS: NavItem[] = [
  { key: 'Dashboard', label: 'DASHBOARD', icon: 'home' },
  { key: 'Diffs', label: 'DIFFS', icon: 'difference' },
  { key: 'Compose', label: 'COMPOSE', icon: 'terminal' },
  { key: 'Settings', label: 'SETTINGS', icon: 'settings' },
];

/**
 * Navigation item component with animation
 * Requirements: 12.7, 12.8
 */
const NavItem: React.FC<{
  item: NavItem;
  isActive: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useDesignSystem>['theme'];
}> = ({ item, isActive, onPress, theme }) => {
  const elevationAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  const bgColorAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  // Animate elevation and background color on selection change
  // Requirements: 12.7, 12.8 - 200ms duration
  useEffect(() => {
    Animated.parallel([
      Animated.timing(elevationAnim, {
        toValue: isActive ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(bgColorAnim, {
        toValue: isActive ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isActive, elevationAnim, bgColorAnim]);

  const backgroundColor = bgColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', theme.colors.surfaceContainerLow],
  });

  const elevation = elevationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 4],
  });

  return (
    <TouchableOpacity
      style={styles.navItem}
      onPress={onPress}
      accessible={true}
      accessibilityLabel={`Navigate to ${item.label}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
    >
      <Animated.View
        style={[
          styles.navItemContent,
          {
            backgroundColor,
            borderRadius: theme.borderRadius.lg,
            elevation: Platform.OS === 'android' ? elevation : 0,
            shadowOpacity: Platform.OS === 'ios' ? elevationAnim : 0,
          },
        ]}
      >
        {/* Icon */}
        <Icon
          name={item.icon}
          size={24}
          color={isActive ? 'secondary' : 'surfaceContainerHighest'}
        />

        {/* Label */}
        <Text
          variant="label-sm"
          weight="medium"
          uppercase
          style={{
            color: isActive ? theme.colors.secondary : theme.colors.surfaceContainerHighest,
            marginTop: 4,
          }}
        >
          {item.label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

/**
 * BottomNavBar component with glassmorphism effect
 *
 * Features:
 * - 4 navigation items (Dashboard, Diffs, Compose, Settings)
 * - Material Symbols icons
 * - Space Grotesk font labels (uppercase)
 * - Active/inactive states with design system colors
 * - Glassmorphism effect with BlurView
 * - Safe area padding for notched devices
 * - Haptic feedback on tap
 * - Animated elevation and background color transitions
 *
 * Requirements: 8.1-8.12, 11.1, 12.7, 12.8
 */
export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeRoute, onNavigate }) => {
  const { theme } = useDesignSystem();
  const insets = useSafeAreaInsets();

  /**
   * Handle navigation item press
   * Provides haptic feedback and navigates to route
   * Requirements: 8.11, 8.12
   */
  const handlePress = async (route: string) => {
    // Haptic feedback on tap
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNavigate(route);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: `${theme.colors.surfaceVariant}CC`, // 80% opacity for glassmorphism
          paddingBottom: insets.bottom || 8, // Safe area padding
        },
      ]}
    >
      {/* 
        Glassmorphism backdrop with expo-blur
        
        To enable:
        1. Install: npm install expo-blur --legacy-peer-deps
        2. Uncomment the import at the top of this file
        3. Uncomment the BlurView below
        
        See INSTALL_EXPO_BLUR.md for details
      */}
      {/* <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} /> */}

      <View style={styles.itemsContainer}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeRoute === item.key;

          return (
            <NavItem
              key={item.key}
              item={item}
              isActive={isActive}
              onPress={() => handlePress(item.key)}
              theme={theme}
            />
          );
        })}
      </View>
    </View>
  );
};

/**
 * Styles for BottomNavBar
 * Requirements: 8.7, 8.8, 8.9, 8.10, 12.7, 12.8
 */
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 8,
    paddingHorizontal: 8,
    // Glassmorphism effect (requires expo-blur)
    // backdrop-filter: blur(20px) - handled by BlurView
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  itemsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56, // Ensures 44pt+ touch target with padding
    minWidth: 64,
  },
  navItemContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    width: '100%',
    // Shadow for iOS elevation animation
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
      },
    }),
  },
});
