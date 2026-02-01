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
      expect(screen.getByText('DISCONNECTED')).toBeInTheDocument();
    });

    it('should display "Connecting" status when connecting', async () => {
      render(<App />);

      // Get the mock client instance
      const MockedWebSocketClient = vi.mocked(WebSocketClient);
      mockClient = MockedWebSocketClient.mock.results[0].value;

      // Trigger status change to connecting
      mockClient._triggerStatusChange('connecting');

      await waitFor(() => {
        expect(screen.getByText('CONNECTING')).toBeInTheDocument();
      });
    });

    it('should display "Connected" status when connected', async () => {
      render(<App />);

      const MockedWebSocketClient = vi.mocked(WebSocketClient);
      mockClient = MockedWebSocketClient.mock.results[0].value;

      // Trigger status change to connected
      mockClient._triggerStatusChange('connected');

      await waitFor(() => {
        expect(screen.getByText('CONNECTED')).toBeInTheDocument();
      });
    });
  });

  describe('Welcome Message', () => {
    it('should show welcome message when no payload is present', () => {
      render(<App />);
      // The new UI shows a dashboard instead of a simple welcome message
      expect(screen.getByText('CodeLink')).toBeInTheDocument();
    });

    it('should show "Connecting" message when disconnected', () => {
      render(<App />);
      // The new UI shows status in the dashboard
      expect(screen.getByText('DISCONNECTED')).toBeInTheDocument();
    });

    it('should show "Waiting for file changes" message when connected', async () => {
      render(<App />);

      const MockedWebSocketClient = vi.mocked(WebSocketClient);
      mockClient = MockedWebSocketClient.mock.results[0].value;

      // Trigger status change to connected
      mockClient._triggerStatusChange('connected');

      await waitFor(() => {
        // The new UI shows "No file selected" in the dashboard
        expect(screen.getByText('No file selected')).toBeInTheDocument();
      });
    });
  });

  describe('DiffViewer Rendering', () => {
    it('should stay on Dashboard when payload is received', async () => {
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
        // Should stay on Dashboard and show the active file
        expect(screen.getByText('src/test.ts')).toBeInTheDocument();
        expect(screen.getByText('REFRESH')).toBeInTheDocument();
      });
    });

    it('should show active file in Dashboard when payload is present', async () => {
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
        // The new UI stays on dashboard and shows the active file
        expect(screen.getByText('src/test.ts')).toBeInTheDocument();
        expect(screen.getByText('REFRESH')).toBeInTheDocument();
      });
    });
  });

  describe('State Updates on Message Receipt', () => {
    it('should update active file when new payload is received', async () => {
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
        expect(screen.getByText('src/first.ts')).toBeInTheDocument();
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
        expect(screen.getByText('src/second.ts')).toBeInTheDocument();
      });
    });

    it('should update connection status independently of payload', async () => {
      render(<App />);

      const MockedWebSocketClient = vi.mocked(WebSocketClient);
      mockClient = MockedWebSocketClient.mock.results[0].value;

      // Start with connected status
      mockClient._triggerStatusChange('connected');

      await waitFor(() => {
        expect(screen.getByText('CONNECTED')).toBeInTheDocument();
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
        // Should stay on Dashboard and show the active file
        expect(screen.getByText('src/test.ts')).toBeInTheDocument();
        expect(screen.getByText('CONNECTED')).toBeInTheDocument();
      });

      // Change status to disconnected
      mockClient._triggerStatusChange('disconnected');

      await waitFor(() => {
        // Dashboard should show disconnected status
        expect(screen.getByText('DISCONNECTED')).toBeInTheDocument();
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
