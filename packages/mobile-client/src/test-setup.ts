// Test setup file for vitest
// This file is executed before running tests

import { vi } from 'vitest';
import * as React from 'react';

// Mock react-native
vi.mock('react-native', () => {
  return {
    StyleSheet: {
      create: (styles: any) => styles,
    },
    View: (props: any) => {
      const { children, ...rest } = props;
      return React.createElement('div', rest, children);
    },
    Text: (props: any) => {
      const { children, onPress, ...rest } = props;
      return React.createElement(onPress ? 'button' : 'span', { ...rest, onClick: onPress }, children);
    },
    ScrollView: (props: any) => {
      const { children, style, contentContainerStyle, horizontal, ...rest } = props;
      return React.createElement('div', { ...rest, style: { ...style, ...contentContainerStyle } }, children);
    },
    TextInput: (props: any) => {
      const { onChangeText, value, ...rest } = props;
      return React.createElement('input', {
        ...rest,
        value,
        onChange: (e: any) => onChangeText?.(e.target.value),
      });
    },
    Pressable: (props: any) => {
      const { children, onPress, ...rest } = props;
      return React.createElement('button', { ...rest, onClick: onPress }, children);
    },
    SafeAreaView: (props: any) => {
      const { children, ...rest } = props;
      return React.createElement('div', rest, children);
    },
    useWindowDimensions: vi.fn(() => ({ width: 375, height: 667 })),
    Dimensions: {
      get: vi.fn(() => ({ width: 375, height: 667, scale: 1, fontScale: 1 })),
      addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
    Platform: {
      OS: 'ios',
      select: (obj: any) => obj.ios || obj.default,
    },
  };
});

// Mock expo-status-bar
vi.mock('expo-status-bar', () => {
  return {
    StatusBar: (props: any) => React.createElement('div', props),
  };
});

// Mock React Native Paper components
vi.mock('react-native-paper', () => {
  return {
    Provider: (props: any) => {
      const { children } = props;
      return React.createElement('div', {}, children);
    },
    Button: (props: any) => {
      const { children, onPress, disabled, loading, ...rest } = props;
      return React.createElement('button', { ...rest, onClick: onPress, disabled: disabled || loading }, children);
    },
    Card: Object.assign(
      (props: any) => {
        const { children, ...rest } = props;
        return React.createElement('div', { ...rest, className: 'card' }, children);
      },
      {
        Content: (props: any) => {
          const { children, ...rest } = props;
          return React.createElement('div', rest, children);
        },
      }
    ),
    IconButton: (props: any) => {
      const { icon, onPress, ...rest } = props;
      return React.createElement('button', { ...rest, onClick: onPress, 'data-icon': icon });
    },
    Snackbar: (props: any) => {
      const { children, visible, ...rest } = props;
      return visible ? React.createElement('div', rest, children) : null;
    },
    TextInput: (props: any) => {
      const { onChangeText, value, ...rest } = props;
      return React.createElement('input', {
        ...rest,
        value,
        onChange: (e: any) => onChangeText?.(e.target.value),
      });
    },
    Text: (props: any) => {
      const { children, ...rest } = props;
      return React.createElement('span', rest, children);
    },
    HelperText: (props: any) => {
      const { children, ...rest } = props;
      return React.createElement('span', rest, children);
    },
    BottomNavigation: Object.assign(
      (props: any) => {
        const { renderScene, navigationState, onIndexChange } = props;
        const currentRoute = navigationState.routes[navigationState.index];
        const Scene = renderScene[currentRoute.key];
        
        return React.createElement(
          'div',
          { className: 'bottom-navigation-container' },
          React.createElement(
            React.Fragment,
            null,
            // Render navigation tabs
            React.createElement(
              'div',
              { key: 'tabs', className: 'bottom-navigation' },
              navigationState.routes.map((route: any, index: number) =>
                React.createElement(
                  'button',
                  {
                    key: route.key,
                    onClick: () => onIndexChange(index),
                    'data-active': index === navigationState.index,
                  },
                  route.title
                )
              )
            ),
            // Render current scene
            React.createElement('div', { key: 'scene' }, Scene ? React.createElement(Scene) : null)
          )
        );
      },
      {
        SceneMap: (scenes: any) => scenes,
      }
    ),
    MD3LightTheme: {
      colors: {
        primary: '#6200ee',
        secondary: '#03dac6',
        error: '#b00020',
      },
    },
  };
});
