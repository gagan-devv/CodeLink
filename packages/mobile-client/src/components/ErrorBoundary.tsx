/**
 * ErrorBoundary Component
 *
 * Catches JavaScript errors anywhere in the component tree and displays
 * a fallback UI with retry option. Logs errors to console for debugging.
 *
 * Requirements: 17.11
 */

import React, { Component, ReactNode } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from '../design-system/typography/Text';
import { Button } from '../design-system/components/Button';
import { Icon } from '../design-system/components/Icon';
import { Card } from '../design-system/components/Card';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to console (Requirement 17.11)
    console.error('ErrorBoundary caught an error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });

    // Store error info in state for display
    this.setState({
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
          <View style={styles.iconContainer}>
            <Icon name="error" size={64} color="error" />
          </View>

          <Text variant="headline-lg" weight="bold" color="error" align="center">
            Something went wrong
          </Text>

          <Text variant="body-md" color="onSurfaceVariant" align="center" style={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>

          <Card variant="low" style={styles.errorCard}>
            <Text variant="label-sm" color="onSurfaceVariant" uppercase style={styles.errorLabel}>
              Error Details
            </Text>
            <Text variant="body-sm" color="onSurface" style={styles.errorText}>
              {this.state.error?.stack || 'No stack trace available'}
            </Text>
          </Card>

          <Button
            variant="primary"
            size="lg"
            onPress={this.handleReset}
            fullWidth
            icon={<Icon name="refresh" size={20} color="onPrimary" />}
            accessibilityLabel="Try again"
            accessibilityHint="Resets the error state and attempts to reload the app"
          >
            Try Again
          </Button>
        </ScrollView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131313', // surface color
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    marginBottom: 24,
  },
  message: {
    marginTop: 16,
    marginBottom: 24,
  },
  errorCard: {
    width: '100%',
    marginBottom: 24,
    padding: 16,
  },
  errorLabel: {
    marginBottom: 8,
  },
  errorText: {
    fontFamily: 'monospace',
  },
});
