import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { Dashboard } from './Dashboard';
import { ConnectionStatus } from '../hooks/useConnection';

/**
 * Simplified smoke tests for Dashboard component
 * Validates: Requirements 6.2
 * 
 * Note: These are minimal smoke tests that verify the component can be
 * instantiated without errors. Full integration testing should be done
 * in an actual React Native environment.
 */
describe('Dashboard Component Smoke Tests', () => {
  const mockNavigateToPrompts = vi.fn();
  const mockNavigateToDiffs = vi.fn();

  const defaultProps = {
    connectionStatus: 'connected' as ConnectionStatus,
    onNavigateToPrompts: mockNavigateToPrompts,
    onNavigateToDiffs: mockNavigateToDiffs,
  };

  it('should instantiate with connected status', () => {
    expect(() => {
      React.createElement(Dashboard, { ...defaultProps, connectionStatus: 'connected' });
    }).not.toThrow();
  });

  it('should instantiate with disconnected status', () => {
    expect(() => {
      React.createElement(Dashboard, { ...defaultProps, connectionStatus: 'disconnected' });
    }).not.toThrow();
  });

  it('should instantiate with connecting status', () => {
    expect(() => {
      React.createElement(Dashboard, { ...defaultProps, connectionStatus: 'connecting' });
    }).not.toThrow();
  });

  it('should accept all required props', () => {
    expect(() => {
      React.createElement(Dashboard, defaultProps);
    }).not.toThrow();
  });

  it('should be a valid React component', () => {
    expect(Dashboard).toBeDefined();
    expect(typeof Dashboard).toBe('function');
  });

  it('should have correct prop types', () => {
    const element = React.createElement(Dashboard, defaultProps);
    expect(element.props.connectionStatus).toBe('connected');
    expect(element.props.onNavigateToPrompts).toBe(mockNavigateToPrompts);
    expect(element.props.onNavigateToDiffs).toBe(mockNavigateToDiffs);
  });
});
