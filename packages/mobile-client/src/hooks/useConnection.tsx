import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import { SocketManager, SocketManagerImpl } from '../services/SocketManager';

/**
 * Connection status type
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

/**
 * Connection context value interface
 */
export interface ConnectionContextValue {
  status: ConnectionStatus;
  error: Error | null;
  reconnect: () => void;
  socketManager: SocketManager;
}

/**
 * Connection context
 */
const ConnectionContext = createContext<ConnectionContextValue | null>(null);

/**
 * ConnectionStatusProvider props
 */
export interface ConnectionStatusProviderProps {
  children: ReactNode;
  serverUrl?: string;
}

/**
 * Default relay server URL
 */
// const DEFAULT_SERVER_URL = process.env.RELAY_SERVER_URL || 'http://localhost:8080';
const DEFAULT_SERVER_URL = 'http://localhost:8080';

/**
 * ConnectionStatusProvider manages global connection state and provides
 * access to the SocketManager instance for the entire application
 */
export const ConnectionStatusProvider: React.FC<ConnectionStatusProviderProps> = ({
  children,
  serverUrl = DEFAULT_SERVER_URL,
}) => {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<Error | null>(null);
  const socketManager = useRef<SocketManager>(new SocketManagerImpl());
  const serverUrlRef = useRef(serverUrl);

  useEffect(() => {
    const manager = socketManager.current;

    // Register event handlers
    manager.onConnect(() => {
      setStatus('connected');
      setError(null);
      // Requirement 14.11: Announce connection state changes
      AccessibilityInfo.announceForAccessibility('Connected to relay server');
    });

    manager.onDisconnect(() => {
      setStatus('disconnected');
      // Requirement 14.11: Announce connection state changes
      AccessibilityInfo.announceForAccessibility('Disconnected from relay server');
    });

    manager.onError((err) => {
      // Log network errors (Requirement 17.11)
      console.error('Connection error:', {
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
        serverUrl: serverUrlRef.current,
      });
      setError(err);
      setStatus('disconnected');
    });

    // Initial connection
    setStatus('connecting');
    // Requirement 14.11: Announce loading states
    AccessibilityInfo.announceForAccessibility('Connecting to relay server');
    manager.connect(serverUrlRef.current).catch((err) => {
      // Log network errors (Requirement 17.11)
      console.error('Initial connection failed:', {
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
        serverUrl: serverUrlRef.current,
      });
      setError(err);
      setStatus('disconnected');
    });

    // Cleanup on unmount
    return () => {
      manager.disconnect();
    };
  }, []);

  /**
   * Manually trigger reconnection
   */
  const reconnect = () => {
    setStatus('connecting');
    setError(null);
    // Requirement 14.11: Announce loading states
    AccessibilityInfo.announceForAccessibility('Reconnecting to relay server');
    socketManager.current.connect(serverUrlRef.current).catch((err) => {
      // Log network errors (Requirement 17.11)
      console.error('Reconnection failed:', {
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
        serverUrl: serverUrlRef.current,
      });
      setError(err);
      setStatus('disconnected');
    });
  };

  const value: ConnectionContextValue = {
    status,
    error,
    reconnect,
    socketManager: socketManager.current,
  };

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
};

/**
 * Hook to access connection context
 * @throws Error if used outside ConnectionStatusProvider
 */
export const useConnection = (): ConnectionContextValue => {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnection must be used within ConnectionStatusProvider');
  }
  return context;
};
