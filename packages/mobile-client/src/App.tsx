import { useState, useEffect } from 'react';
import { FileContextPayload } from '@codelink/protocol';
import { WebSocketClient, ConnectionStatus } from './websocket/WebSocketClient';
import DiffViewer from './components/DiffViewer';

const RELAY_URL = 'http://localhost:8080';

function App() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [payload, setPayload] = useState<FileContextPayload | null>(null);

  useEffect(() => {
    const client = new WebSocketClient({ url: RELAY_URL });

    // Register status change callback
    client.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    // Register payload callback
    client.onPayload((newPayload) => {
      setPayload(newPayload);
    });

    // Connect to relay server
    client.connect();

    return () => {
      client.disconnect();
    };
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>CodeLink</h1>
        <div style={styles.statusContainer}>
          <div
            style={{
              ...styles.statusIndicator,
              backgroundColor:
                status === 'connected' ? '#22c55e' : status === 'connecting' ? '#eab308' : '#ef4444',
            }}
          />
          <span style={styles.statusText}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
      </div>

      {payload ? (
        <DiffViewer payload={payload} />
      ) : (
        <div style={styles.welcomeContainer}>
          <div style={styles.welcomeContent}>
            <h2 style={styles.welcomeTitle}>Welcome to CodeLink</h2>
            <p style={styles.welcomeMessage}>
              {status === 'connected'
                ? 'Waiting for file changes from VS Code...'
                : 'Connecting to relay server...'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    backgroundColor: '#1e1e1e',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#252526',
    borderBottom: '1px solid #3e3e42',
  },
  title: {
    fontSize: '18px',
    fontWeight: '600' as const,
    color: '#cccccc',
    margin: 0,
  },
  statusContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusIndicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  statusText: {
    fontSize: '12px',
    color: '#cccccc',
  },
  welcomeContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  welcomeContent: {
    textAlign: 'center' as const,
    maxWidth: '400px',
  },
  welcomeTitle: {
    fontSize: '24px',
    fontWeight: '600' as const,
    color: '#cccccc',
    marginBottom: '12px',
  },
  welcomeMessage: {
    fontSize: '14px',
    color: '#858585',
    lineHeight: '1.6',
  },
};

export default App;
