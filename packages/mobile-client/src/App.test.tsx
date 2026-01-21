import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { FileContextPayload } from '@codelink/protocol';
import { WebSocketClient, ConnectionStatus } from './websocket/WebSocketClient';

// Mock the WebSocketClient
vi.mock('./websocket/WebSocketClient', () => {
  let statusCallback: ((status: ConnectionStatus) => void) | null = null;
  let payloadCallback: ((payload: FileContextPayload) => void) | null = null;

  return {
    ConnectionStatus: {},
    WebSocketClient: vi.fn().mockImplementation(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      onStatusChange: vi.fn((callback) => {
        statusCallback = callback;
      }),
      onPayload: vi.fn((callback) => {
        payloadCallback = callback;
      }),
      // Expose methods to trigger callbacks in tests
      _triggerStatusChange: (status: ConnectionStatus) => {
        if (statusCallback) statusCallback(status);
      },
      _triggerPayload: (payload: FileContextPayload) => {
        if (payloadCallback) payloadCallback(payload);
      },
    })),
  };
});

// Mock DiffViewer component
vi.mock('./components/DiffViewer', () => ({
  default: ({ payload }: { payload: FileContextPayload }) => (
    <div data-testid="diff-viewer">
      <div data-testid="diff-filename">{payload.fileName}</div>
      <div data-testid="diff-dirty">{payload.isDirty ? 'dirty' : 'clean'}</div>
    </div>
  ),
}));

describe('App Component Integration', () => {
  let mockClient: any;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render App component', () => {
    render(<App />);
    expect(screen.getByText('CodeLink')).toBeInTheDocument();
  });

  describe('Connection Status Display', () => {
    it('should display "Disconnected" status initially', () => {
      render(<App />);
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('should display "Connecting" status when connecting', async () => {
      render(<App />);

      // Get the mock client instance
      const MockedWebSocketClient = vi.mocked(WebSocketClient);
      mockClient = MockedWebSocketClient.mock.results[0].value;

      // Trigger status change to connecting
      mockClient._triggerStatusChange('connecting');

      await waitFor(() => {
        expect(screen.getByText('Connecting')).toBeInTheDocument();
      });
    });

    it('should display "Connected" status when connected', async () => {
      render(<App />);

      const MockedWebSocketClient = vi.mocked(WebSocketClient);
      mockClient = MockedWebSocketClient.mock.results[0].value;

      // Trigger status change to connected
      mockClient._triggerStatusChange('connected');

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });
    });
  });

  describe('Welcome Message', () => {
    it('should show welcome message when no payload is present', () => {
      render(<App />);
      expect(screen.getByText('Welcome to CodeLink')).toBeInTheDocument();
    });

    it('should show "Connecting" message when disconnected', () => {
      render(<App />);
      expect(screen.getByText(/Disconnected from relay server/i)).toBeInTheDocument();
    });

    it('should show "Waiting for file changes" message when connected', async () => {
      render(<App />);

      const MockedWebSocketClient = vi.mocked(WebSocketClient);
      mockClient = MockedWebSocketClient.mock.results[0].value;

      // Trigger status change to connected
      mockClient._triggerStatusChange('connected');

      await waitFor(() => {
        expect(screen.getByText(/Waiting for file changes from VS Code/i)).toBeInTheDocument();
      });
    });
  });

  describe('DiffViewer Rendering', () => {
    it('should render DiffViewer when payload is received', async () => {
      render(<App />);

      const MockedWebSocketClient = vi.mocked(WebSocketClient);
      mockClient = MockedWebSocketClient.mock.results[0].value;

      const testPayload: FileContextPayload = {
        fileName: 'src/test.ts',
        originalFile: 'original content',
        modifiedFile: 'modified content',
        isDirty: true,
        timestamp: Date.now(),
      };

      // Trigger payload
      mockClient._triggerPayload(testPayload);

      await waitFor(() => {
        expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
        expect(screen.getByTestId('diff-filename')).toHaveTextContent('src/test.ts');
        expect(screen.getByTestId('diff-dirty')).toHaveTextContent('dirty');
      });
    });

    it('should hide welcome message when payload is present', async () => {
      render(<App />);

      const MockedWebSocketClient = vi.mocked(WebSocketClient);
      mockClient = MockedWebSocketClient.mock.results[0].value;

      const testPayload: FileContextPayload = {
        fileName: 'src/test.ts',
        originalFile: 'original content',
        modifiedFile: 'modified content',
        isDirty: false,
        timestamp: Date.now(),
      };

      // Trigger payload
      mockClient._triggerPayload(testPayload);

      await waitFor(() => {
        expect(screen.queryByText('Welcome to CodeLink')).not.toBeInTheDocument();
      });
    });
  });

  describe('State Updates on Message Receipt', () => {
    it('should update state when new payload is received', async () => {
      render(<App />);

      const MockedWebSocketClient = vi.mocked(WebSocketClient);
      mockClient = MockedWebSocketClient.mock.results[0].value;

      const firstPayload: FileContextPayload = {
        fileName: 'src/first.ts',
        originalFile: 'first original',
        modifiedFile: 'first modified',
        isDirty: true,
        timestamp: Date.now(),
      };

      // Trigger first payload
      mockClient._triggerPayload(firstPayload);

      await waitFor(() => {
        expect(screen.getByTestId('diff-filename')).toHaveTextContent('src/first.ts');
      });

      const secondPayload: FileContextPayload = {
        fileName: 'src/second.ts',
        originalFile: 'second original',
        modifiedFile: 'second modified',
        isDirty: false,
        timestamp: Date.now(),
      };

      // Trigger second payload
      mockClient._triggerPayload(secondPayload);

      await waitFor(() => {
        expect(screen.getByTestId('diff-filename')).toHaveTextContent('src/second.ts');
        expect(screen.getByTestId('diff-dirty')).toHaveTextContent('clean');
      });
    });

    it('should update connection status independently of payload', async () => {
      render(<App />);

      const MockedWebSocketClient = vi.mocked(WebSocketClient);
      mockClient = MockedWebSocketClient.mock.results[0].value;

      // Start with connected status
      mockClient._triggerStatusChange('connected');

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });

      // Send a payload
      const testPayload: FileContextPayload = {
        fileName: 'src/test.ts',
        originalFile: 'content',
        modifiedFile: 'content',
        isDirty: false,
        timestamp: Date.now(),
      };

      mockClient._triggerPayload(testPayload);

      await waitFor(() => {
        expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
      });

      // Change status to disconnected
      mockClient._triggerStatusChange('disconnected');

      await waitFor(() => {
        expect(screen.getByText('Disconnected')).toBeInTheDocument();
        // DiffViewer should still be visible
        expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
      });
    });
  });

  describe('WebSocket Client Integration', () => {
    it('should initialize WebSocketClient on mount', () => {
      render(<App />);

      const MockedWebSocketClient = vi.mocked(WebSocketClient);
      expect(MockedWebSocketClient).toHaveBeenCalledWith({ url: 'http://localhost:8080' });
    });

    it('should register status change callback', () => {
      render(<App />);

      const MockedWebSocketClient = vi.mocked(WebSocketClient);
      mockClient = MockedWebSocketClient.mock.results[0].value;

      expect(mockClient.onStatusChange).toHaveBeenCalled();
    });

    it('should register payload callback', () => {
      render(<App />);

      const MockedWebSocketClient = vi.mocked(WebSocketClient);
      mockClient = MockedWebSocketClient.mock.results[0].value;

      expect(mockClient.onPayload).toHaveBeenCalled();
    });

    it('should call connect on mount', () => {
      render(<App />);

      const MockedWebSocketClient = vi.mocked(WebSocketClient);
      mockClient = MockedWebSocketClient.mock.results[0].value;

      expect(mockClient.connect).toHaveBeenCalled();
    });

    it('should call disconnect on unmount', () => {
      const { unmount } = render(<App />);

      const MockedWebSocketClient = vi.mocked(WebSocketClient);
      mockClient = MockedWebSocketClient.mock.results[0].value;

      unmount();

      expect(mockClient.disconnect).toHaveBeenCalled();
    });
  });
});
