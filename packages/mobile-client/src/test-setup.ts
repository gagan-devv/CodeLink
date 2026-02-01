// Test setup file for vitest
// This file is executed before running tests

import { vi } from 'vitest';
import * as React from 'react';

// Mock React Native modules with proper JSX components
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
      const { children, style, contentContainerStyle, ...rest } = props;
      return React.createElement('div', { ...rest, style: { ...style, ...contentContainerStyle } }, children);
    },
    TextInput: (props: any) => React.createElement('input', props),
    Pressable: (props: any) => {
      const { children, onPress, ...rest } = props;
      return React.createElement('button', { ...rest, onClick: onPress }, children);
    },
    useWindowDimensions: vi.fn(() => ({ width: 375, height: 667 })),
    Platform: {
      OS: 'ios',
      select: (obj: any) => obj.ios || obj.default,
    },
  };
});

// Mock React Native Paper
vi.mock('react-native-paper', () => {
  return {
    Button: (props: any) => {
      const { children, onPress, ...rest } = props;
      return React.createElement('button', { ...rest, onClick: onPress }, children);
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
      const { children, ...rest } = props;
      return React.createElement('div', rest, children);
    },
    TextInput: (props: any) => React.createElement('input', props),
    Text: (props: any) => {
      const { children, ...rest } = props;
      return React.createElement('span', rest, children);
    },
    HelperText: (props: any) => {
      const { children, ...rest } = props;
      return React.createElement('span', rest, children);
    },
  };
});
