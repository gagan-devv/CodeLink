/**
 * Dynamic Text Sizing Example
 *
 * Demonstrates how the Text component respects system text size preferences.
 * This example can be used for manual testing with different text size settings.
 *
 * To test:
 * 1. iOS: Settings > Display & Brightness > Text Size
 * 2. Android: Settings > Display > Font size
 *
 * Requirements: 14.9
 */

import React from 'react';
import { View, ScrollView, StyleSheet, PixelRatio } from 'react-native';
import { Text } from './Text';

/**
 * Example component showing all text variants with dynamic sizing.
 * Font sizes will automatically scale based on system preferences.
 */
export const DynamicTextExample: React.FC = () => {
  const fontScale = PixelRatio.getFontScale();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text variant="headline-md" weight="bold" color="primary">
          Dynamic Text Sizing Demo
        </Text>
        <Text variant="body-md" color="onSurfaceVariant" style={styles.info}>
          Current font scale: {fontScale.toFixed(2)}x
        </Text>
        <Text variant="body-sm" color="onSurfaceVariant" style={styles.info}>
          Change your system text size settings to see this text scale automatically.
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="label-sm" uppercase color="onSurfaceVariant">
          Display Variants
        </Text>
        <Text variant="display-lg" weight="bold">
          Display Large
        </Text>
        <Text variant="display-md" weight="bold">
          Display Medium
        </Text>
        <Text variant="display-sm" weight="bold">
          Display Small
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="label-sm" uppercase color="onSurfaceVariant">
          Headline Variants
        </Text>
        <Text variant="headline-lg" weight="semibold">
          Headline Large
        </Text>
        <Text variant="headline-md" weight="semibold">
          Headline Medium
        </Text>
        <Text variant="headline-sm" weight="semibold">
          Headline Small
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="label-sm" uppercase color="onSurfaceVariant">
          Title Variants
        </Text>
        <Text variant="title-lg" weight="medium">
          Title Large
        </Text>
        <Text variant="title-md" weight="medium">
          Title Medium
        </Text>
        <Text variant="title-sm" weight="medium">
          Title Small
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="label-sm" uppercase color="onSurfaceVariant">
          Body Variants
        </Text>
        <Text variant="body-lg">
          Body Large - This is a longer text to demonstrate how body text scales with system
          preferences. The layout should adapt gracefully to larger text sizes.
        </Text>
        <Text variant="body-md">
          Body Medium - This is a longer text to demonstrate how body text scales with system
          preferences. The layout should adapt gracefully to larger text sizes.
        </Text>
        <Text variant="body-sm">
          Body Small - This is a longer text to demonstrate how body text scales with system
          preferences. The layout should adapt gracefully to larger text sizes.
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="label-sm" uppercase color="onSurfaceVariant">
          Label Variants
        </Text>
        <Text variant="label-lg">Label Large</Text>
        <Text variant="label-md">Label Medium</Text>
        <Text variant="label-sm">Label Small</Text>
      </View>

      <View style={styles.section}>
        <Text variant="label-sm" uppercase color="onSurfaceVariant">
          Layout Adaptation Test
        </Text>
        <View style={styles.card}>
          <Text variant="title-md" weight="semibold">
            Card Title
          </Text>
          <Text variant="body-md" color="onSurfaceVariant" style={styles.cardText}>
            This card demonstrates how layouts adapt to larger text. The card height should grow
            automatically as text size increases, preventing overflow and maintaining readability.
          </Text>
          <View style={styles.buttonRow}>
            <View style={styles.button}>
              <Text variant="label-md" weight="medium" color="primary">
                Action
              </Text>
            </View>
            <View style={styles.button}>
              <Text variant="label-md" weight="medium" color="onSurfaceVariant">
                Cancel
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131313',
  },
  section: {
    padding: 16,
    gap: 12,
  },
  info: {
    marginTop: 4,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  cardText: {
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    minHeight: 44, // Maintains touch target size
    justifyContent: 'center',
    alignItems: 'center',
  },
});
