import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { PingMessage, PongMessage } from '@codelink/protocol';

const RELAY_URL = 'http://localhost:8080';

function App() {
  const [status, setStatus] = useState<'Disconnected' | 'Connected' | 'Connecting'>('Disconnected');
  const [lastPong, setLastPong] = useState<PongMessage | null>(null);

  useEffect(() => {
    setStatus('Connecting');
    const newSocket = io(RELAY_URL);

    newSocket.on('connect', () => {
      console.log('Connected to relay server');
      setStatus('Connected');

      // Send a ping message on connection
      const ping: PingMessage = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'ping',
        source: 'mobile',
      };
      newSocket.emit('message', JSON.stringify(ping));
      console.log('Sent ping:', ping);
    });

    newSocket.on('message', (data: string) => {
      try {
        const message = JSON.parse(data);
        console.log('Received message:', message);

        if (message.type === 'pong') {
          setLastPong(message as PongMessage);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from relay server');
      setStatus('Disconnected');
    });

    return () => {
      newSocket.close();
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
              status === 'Connected' ? '#22c55e' : status === 'Connecting' ? '#eab308' : '#ef4444',
          }}
        >
          {status}
        </div>
      </div>

      {lastPong && (
        <div style={styles.pongContainer}>
          <h2 style={styles.subtitle}>Last Pong Received:</h2>
          <div style={styles.messageDetails}>
            <div>
              <strong>ID:</strong> {lastPong.id}
            </div>
            <div>
              <strong>Original ID:</strong> {lastPong.originalId}
            </div>
            <div>
              <strong>Timestamp:</strong> {new Date(lastPong.timestamp).toLocaleString()}
            </div>
          </div>
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
  pongContainer: {
    marginTop: '20px',
    padding: '15px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
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
