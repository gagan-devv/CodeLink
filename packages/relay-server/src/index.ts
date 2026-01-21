import { Server, Socket } from 'socket.io';
import { ProtocolMessage, PingMessage, PongMessage, SyncFullContextMessage } from '@codelink/protocol';

// Track connected clients by type
export const extensionClients = new Set<Socket>();
export const mobileClients = new Set<Socket>();

export function startServer(port: number = 8080): Server {
  const io = new Server(port, {
    cors: {
      origin: '*',
    },
  });

  console.log(`[RelayServer] CodeLink Relay Server listening on port ${port}`);

  io.on('connection', (socket) => {
    console.log(`[RelayServer] Client connected: ${socket.id}`);

    socket.on('message', (data: string) => {
      try {
        const message = parseMessage(data);
        console.log(`[RelayServer] Received message type: ${message.type} from ${socket.id}`);

        if (message.type === 'ping') {
          const pong = createPongMessage(message);
          socket.emit('message', JSON.stringify(pong));
          console.log(`[RelayServer] Sent pong to ${socket.id}`);
          
          // Track client type based on ping source
          if (message.source === 'extension') {
            extensionClients.add(socket);
            console.log(`[RelayServer] Registered extension client: ${socket.id} (total: ${extensionClients.size})`);
          } else if (message.source === 'mobile') {
            mobileClients.add(socket);
            console.log(`[RelayServer] Registered mobile client: ${socket.id} (total: ${mobileClients.size})`);
          }
        } else if (message.type === 'SYNC_FULL_CONTEXT') {
          console.log(`[RelayServer] Routing SYNC_FULL_CONTEXT message to ${mobileClients.size} mobile clients`);
          broadcastToMobileClients(message as SyncFullContextMessage);
        }
      } catch (error) {
        console.error(`[RelayServer] Error processing message from ${socket.id}:`, error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[RelayServer] Client disconnected: ${socket.id}`);
      extensionClients.delete(socket);
      mobileClients.delete(socket);
      console.log(`[RelayServer] Active clients - Extensions: ${extensionClients.size}, Mobile: ${mobileClients.size}`);
    });

    socket.on('error', (error) => {
      console.error(`[RelayServer] Socket error for ${socket.id}:`, error);
    });
  });

  return io;
}

export function broadcastToMobileClients(message: SyncFullContextMessage): void {
  const messageStr = JSON.stringify(message);
  let successCount = 0;
  let errorCount = 0;

  mobileClients.forEach((client) => {
    try {
      if (client.connected) {
        client.emit('message', messageStr);
        successCount++;
      } else {
        // Remove disconnected clients
        console.log(`[RelayServer] Removing disconnected client: ${client.id}`);
        mobileClients.delete(client);
      }
    } catch (error) {
      console.error(`[RelayServer] Error broadcasting to client ${client.id}:`, error);
      errorCount++;
      // Remove clients that error during broadcast
      mobileClients.delete(client);
    }
  });

  console.log(`[RelayServer] Broadcast complete: ${successCount} successful, ${errorCount} errors, ${mobileClients.size} total mobile clients`);
}

// Only start the server if this file is run directly (not imported)
if (require.main === module) {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
  startServer(PORT);
}

export function parseMessage(data: string): ProtocolMessage {
  const parsed = JSON.parse(data);

  // Basic validation
  if (!parsed.id || !parsed.timestamp || !parsed.type) {
    throw new Error('Invalid message format: missing required fields');
  }

  return parsed as ProtocolMessage;
}

export function createPongMessage(ping: PingMessage): PongMessage {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    type: 'pong',
    originalId: ping.id,
  };
}
