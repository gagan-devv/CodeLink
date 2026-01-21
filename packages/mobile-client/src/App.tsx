import { useState, useEffect } from 'react';
import { FileContextPayload } from '@codelink/protocol';
import { WebSocketClient, ConnectionStatus } from './websocket/WebSocketClient';

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
      <h1 style={styles.title}>CodeLink Mobile Client</h1>

      <div style={styles.statusContainer}>
        <div style={styles.statusLabel}>Status:</div>
        <div
          style={{
            ...styles.statusValue,
            color:
              status === 'connected' ? '#22c55e' : status === 'connecting' ? '#eab308' : '#ef4444',
          }}
        >
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </div>
      </div>

      {payload ? (
        <div style={styles.payloadContainer}>
          <h2 style={styles.subtitle}>File Context:</h2>
          <div style={styles.messageDetails}>
            <div>
              <strong>File:</strong> {payload.fileName}
            </div>
            <div>
              <strong>Dirty:</strong> {payload.isDirty ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Timestamp:</strong> {new Date(payload.timestamp).toLocaleString()}
            </div>
            <div>
              <strong>Original Length:</strong> {payload.originalFile.length} chars
            </div>
            <div>
              <strong>Modified Length:</strong> {payload.modifiedFile.length} chars
            </div>
          </div>
        </div>
      ) : (
        <div style={styles.welcomeContainer}>
          <p>Waiting for file context from VS Code...</p>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    maxWidth: '600px',
    margin: '0 auto',
    padding: '20px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '20px',
  },
  statusContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: '#f3f4f6',
    borderRadius: '8px',
  },
  statusLabel: {
    fontSize: '16px',
    fontWeight: '600',
  },
  statusValue: {
    fontSize: '16px',
    fontWeight: 'bold',
  },
  payloadContainer: {
    marginTop: '20px',
    padding: '15px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  welcomeContainer: {
    marginTop: '20px',
    padding: '15px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    textAlign: 'center' as const,
    color: '#6b7280',
  },
  subtitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '10px',
  },
  messageDetails: {
    fontSize: '14px',
    lineHeight: '1.8',
  },
};

export default App;
