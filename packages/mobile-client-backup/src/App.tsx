import { useState, useEffect } from 'react';
import { FileContextPayload } from '@codelink/protocol';
import { WebSocketClient, ConnectionStatus } from './websocket/WebSocketClient';
import DiffViewer from './components/DiffViewer';
import Dashboard from './components/Dashboard';
import ErrorBoundary from './components/ErrorBoundary';

const RELAY_URL = 'http://localhost:8080';

function App() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [payload, setPayload] = useState<FileContextPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [latency, setLatency] = useState<number>(24);

  useEffect(() => {
    const client = new WebSocketClient({ url: RELAY_URL });

    // Register status change callback
    client.onStatusChange((newStatus) => {
      setStatus(newStatus);
      if (newStatus === 'connecting') {
        setIsLoading(true);
      } else {
        setIsLoading(false);
      }
    });

    // Register payload callback
    client.onPayload((newPayload) => {
      setPayload(newPayload);
      setLastSyncTime(new Date());
    });

    // Connect to relay server
    client.connect();

    // Simulate latency updates
    const latencyInterval = setInterval(() => {
      setLatency(Math.floor(Math.random() * 30) + 15);
    }, 5000);

    return () => {
      client.disconnect();
      clearInterval(latencyInterval);
    };
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setLastSyncTime(new Date());
    }, 500);
  };

  const handleDisconnect = () => {
    // Implement disconnect logic
    setStatus('disconnected');
  };

  const handleSettings = () => {
    console.log('Settings button clicked');
    alert('Settings functionality not yet implemented');
  };

  const handleBackToDashboard = () => {
    setShowDashboard(true);
  };

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen bg-[#0d1117] font-sans">
        {showDashboard ? (
          <Dashboard
            status={status}
            activeFile={payload?.fileName || null}
            lastSyncTime={lastSyncTime}
            latency={latency}
            onRefresh={handleRefresh}
            onDisconnect={handleDisconnect}
            onSettings={handleSettings}
            onViewDiff={() => setShowDashboard(false)}
            hasPayload={!!payload}
          />
        ) : payload ? (
          <DiffViewer
            payload={payload}
            isLoading={isLoading}
            onBack={handleBackToDashboard}
          />
        ) : null}
      </div>
    </ErrorBoundary>
  );
}

export default App;
