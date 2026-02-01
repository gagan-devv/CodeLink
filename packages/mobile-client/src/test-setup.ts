// Test setup file for vitest
// This file is executed before running tests

import { vi } from 'vitest';
import React from 'react';

// Mock React Native modules
vi.mock('react-native', () => ({
  StyleSheet: {
    create: (styles: any) => styles,
  },
  View: ({ children, ...props }: any) => React.createElement('div', props, children),
  Text: ({ children, ...props }: any) => React.createElement('span', props, children),
  ScrollView: ({ children, ...props }: any) => React.createElement('div', props, children),
  TextInput: (props: any) => React.createElement('input', props),
  Pressable: ({ children, onPress, ...props }: any) => 
    React.createElement('button', { ...props, onClick: onPress }, children),
  useWindowDimensions: vi.fn(() => ({ width: 375, height: 667 })),
  Platform: {
    OS: 'ios',
    select: (obj: any) => obj.ios || obj.default,
  },
}));

// Mock React Native Paper
vi.mock('react-native-paper', () => {
  const React = require('react');
  
  const Button = ({ children, onPress, ...props }: any) => 
    React.createElement('button', { ...props, onClick: onPress }, children);
  
  const CardContent = ({ children, ...props }: any) => 
    React.createElement('div', props, children);
  
  const Card = Object.assign(
    ({ children, ...props }: any) => React.createElement('div', { ...props, className: 'card' }, children),
    {
      Content: CardContent,
    }
  );
  
  return {
    Button,
    Card,
    Snackbar: ({ children, ...props }: any) => React.createElement('div', props, children),
    TextInput: (props: any) => React.createElement('input', props),
  };
});
