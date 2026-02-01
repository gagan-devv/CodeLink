// Test setup file for vitest
// This file is executed before running tests

import { vi } from 'vitest';
import React from 'react';

// Mock React Native modules with proper JSX components
vi.mock('react-native', () => {
  return {
    StyleSheet: {
      create: (styles: any) => styles,
    },
    View: ({ children, style, ...props }: any) => (
      React.createElement('div', { ...props, style }, children)
    ),
    Text: ({ children, style, numberOfLines, onPress, ...props }: any) => (
      React.createElement(onPress ? 'button' : 'span', { ...props, style, onClick: onPress }, children)
    ),
    ScrollView: ({ children, horizontal, style, contentContainerStyle, ...props }: any) => (
      React.createElement('div', { ...props, style: { ...style, ...contentContainerStyle } }, children)
    ),
    TextInput: (props: any) => React.createElement('input', props),
    Pressable: ({ children, onPress, style, ...props }: any) => (
      React.createElement('button', { ...props, style, onClick: onPress }, children)
    ),
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
    Button: ({ children, onPress, ...props }: any) => (
      React.createElement('button', { ...props, onClick: onPress }, children)
    ),
    Card: Object.assign(
      ({ children, ...props }: any) => (
        React.createElement('div', { ...props, className: 'card' }, children)
      ),
      {
        Content: ({ children, ...props }: any) => (
          React.createElement('div', props, children)
        ),
      }
    ),
    IconButton: ({ icon, onPress, ...props }: any) => (
      React.createElement('button', { ...props, onClick: onPress, 'data-icon': icon })
    ),
    Snackbar: ({ children, ...props }: any) => (
      React.createElement('div', props, children)
    ),
    TextInput: (props: any) => React.createElement('input', props),
  };
});
