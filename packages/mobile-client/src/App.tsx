import { useState, useEffect } from 'react';
import { FileContextPayload } from '@codelink/protocol';
import { WebSocketClient, ConnectionStatus } from './websocket/WebSocketClient';
import DiffViewer from './components/DiffViewer';

const RELAY_URL = 'http://localhost:8080';

function App() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [payload, setPayload] = useState<FileContextPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
      setIsLoading(true);
      // Simulate brief loading state for smooth transition
      setTimeout(() => {
        setPayload(newPayload);
        setIsLoading(false);
      }, 100);
    });

    // Connect to relay server
    client.connect();

    return () => {
      client.disconnect();
    };
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      default:
        return 'bg-red-500';
    }
  };

  const getStatusText = () => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="flex flex-col h-screen bg-vscode-bg font-sans">
      {/* Header */}
      <header className="flex justify-between items-center px-4 py-3 bg-vscode-sidebar border-b border-vscode-border">
        <h1 className="text-lg font-semibold text-vscode-text m-0">CodeLink</h1>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()} transition-colors duration-300`} />
          <span className="text-xs text-vscode-text">{getStatusText()}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {payload ? (
          <DiffViewer payload={payload} isLoading={isLoading} />
        ) : (
          <div className="flex items-center justify-center h-full p-5">
            <div className="text-center max-w-md">
              <h2 className="text-2xl font-semibold text-vscode-text mb-3">
                Welcome to CodeLink
              </h2>
              <p className="text-sm text-vscode-text-muted leading-relaxed">
                {status === 'connected'
                  ? 'Waiting for file changes from VS Code...'
                  : status === 'connecting'
                  ? 'Connecting to relay server...'
                  : 'Disconnected from relay server. Attempting to reconnect...'}
              </p>
              {status === 'connecting' && (
                <div className="mt-6 flex justify-center">
                  <div className="w-8 h-8 border-4 border-vscode-border border-t-vscode-text rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
