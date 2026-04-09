# TopAppBar Component

The TopAppBar component provides a consistent header across all screens with CodeLink branding and real-time connection status.

## Features

- **Branding**: Terminal icon in primary color (#95ccff) with "CodeLink" text in Manrope font
- **Connection Status**: Real-time status indicator with color-coded dots
  - Green: Connected
  - Red: Disconnected
  - Orange: Connecting (with pulse animation)
- **Sticky Positioning**: Remains at top during scrolling
- **Safe Area Support**: Automatically adjusts for device notches and status bars
- **Accessibility**: Full screen reader support with proper labels

## Requirements

Implements requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8

## Usage

### Basic Usage

```tsx
import { TopAppBar } from '../navigation';
import { useConnection } from '../hooks';

export const MyScreen = () => {
  const { status } = useConnection();

  return (
    <View style={{ flex: 1 }}>
      <TopAppBar connectionStatus={status} />
      <ScrollView>{/* Screen content */}</ScrollView>
    </View>
  );
};
```

### With Different Connection States

```tsx
// Connected state
<TopAppBar connectionStatus="connected" />

// Disconnected state
<TopAppBar connectionStatus="disconnected" />

// Connecting state (with pulse animation)
<TopAppBar connectionStatus="connecting" />
```

### Integration with Screen Components

The TopAppBar should be placed at the top of each screen component:

```tsx
import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { TopAppBar } from '../navigation';
import { useConnection } from '../hooks';

export const DashboardScreen = () => {
  const { status } = useConnection();

  return (
    <View style={styles.container}>
      <TopAppBar connectionStatus={status} />
      <ScrollView style={styles.content}>{/* Dashboard content */}</ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
```

## Props

### `connectionStatus` (required)

Type: `'connected' | 'disconnected' | 'connecting'`

The current connection status. This determines the color and animation of the status indicator:

- `'connected'`: Green dot with "Connected" label
- `'disconnected'`: Red dot with "Disconnected" label
- `'connecting'`: Orange dot with pulse animation and "Connecting" label

### `showBackButton` (optional)

Type: `boolean`  
Default: `false`

Reserved for future use. Will show a back button in the app bar.

### `onBackPress` (optional)

Type: `() => void`

Reserved for future use. Callback when back button is pressed.

## Design System Integration

The TopAppBar uses the following design system tokens:

### Colors

- Background: `theme.colors.surface` (#131313)
- Icon: `theme.colors.primary` (#95ccff)
- Text: `theme.colors.onSurface`
- Status colors: `theme.colors.secondary` (green), `theme.colors.error` (red), `theme.colors.tertiary` (orange)

### Typography

- Brand text: `title-lg` variant with `bold` weight (Manrope font)
- Status label: `label-md` variant with `medium` weight (Space Grotesk font)

### Spacing

- Horizontal padding: 16px
- Vertical padding: 12px
- Minimum height: 56px (standard app bar height)

## Accessibility

The TopAppBar includes proper accessibility support:

- Status indicator has descriptive labels for screen readers
- Proper semantic structure for navigation
- High contrast support through design system tokens

## Animation

The connecting state includes a pulse animation:

- Scale: 1.0 → 1.5 → 1.0
- Opacity: 1.0 → 0.5 → 1.0
- Duration: 1000ms per cycle
- Loops continuously while in connecting state

## Platform Considerations

### iOS

- Automatically adjusts for status bar height using safe area insets
- Uses iOS-style shadow for depth

### Android

- Uses elevation for depth
- Respects system navigation bar

## Testing

See `TopAppBar.example.tsx` for usage examples and integration patterns.

## Related Components

- `StatusIndicator`: Used internally for connection status display
- `Icon`: Used for terminal icon
- `Text`: Used for brand text
- `BottomNavBar`: Complementary navigation component at bottom of screen
