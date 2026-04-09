# Navigation Setup

This directory contains the React Navigation configuration for the Obsidian UI redesign.

## Components

### NavigationContainer

Wraps React Navigation's NavigationContainer with design system theme integration. Automatically syncs navigation theme colors with the design system.

### BottomTabNavigator

Configures the bottom tab navigator with:

- Screen transition animations (300ms duration, ease-in-out timing)
- Design system integration
- Keyboard handling

### BottomNavBar

Custom bottom navigation bar component with:

- 4 navigation items (Dashboard, Diffs, Compose, Settings)
- Material Symbols icons
- Space Grotesk font labels (uppercase)
- Active/inactive states with design system colors
- Glassmorphism effect (requires expo-blur)
- Safe area padding for notched devices
- Haptic feedback on tap

## Installation

### Required Dependencies

All React Navigation dependencies are already installed. To enable glassmorphism effects, install expo-blur:

```bash
npx expo install expo-blur
```

## Usage

### Basic Setup

```typescript
import { NavigationContainer, Tab, defaultScreenOptions, BottomNavBar } from './navigation';

function App() {
  return (
    <ThemeProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={defaultScreenOptions}
          tabBar={(props) => (
            <BottomNavBar
              activeRoute={props.state.routes[props.state.index].name}
              onNavigate={(route) => props.navigation.navigate(route)}
            />
          )}
        >
          <Tab.Screen name="Dashboard" component={DashboardScreen} />
          <Tab.Screen name="Diffs" component={DiffViewerScreen} />
          <Tab.Screen name="Compose" component={PromptComposerScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}
```

### Enabling Glassmorphism

After installing expo-blur, uncomment the BlurView in BottomNavBar.tsx:

```typescript
import { BlurView } from 'expo-blur';

// In the component:
<BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
```

## Configuration

### Screen Transitions

- Duration: 300ms
- Timing: ease-in-out cubic bezier
- Animation: shift (smooth tab transitions)

### Theme Integration

Navigation theme automatically syncs with design system theme:

- Primary color → navigation primary
- Surface → navigation background
- Surface container → navigation card
- On surface → navigation text
- Outline variant → navigation border
- Secondary → navigation notification

### Bottom Navigation Bar

- Active state: secondary color (#61dac1) with surfaceContainerLow background
- Inactive state: surfaceContainerHighest color (#353535)
- Glassmorphism: 80% opacity with 20px blur (requires expo-blur)
- Touch targets: Minimum 56pt height (exceeds 44pt requirement)
- Safe area: Automatic padding for devices with bottom notch

## Requirements

- @react-navigation/native: ^7.2.2
- @react-navigation/bottom-tabs: ^7.15.9
- react-native-safe-area-context: ^5.6.2
- react-native-screens: ^4.24.0
- expo-haptics: ~15.0.8
- expo-blur: (optional, for glassmorphism)

All dependencies except expo-blur are already installed in package.json.
