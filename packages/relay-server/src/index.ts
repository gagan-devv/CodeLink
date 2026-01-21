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

  console.log(`CodeLink Relay Server listening on port ${port}`);

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('message', (data: string) => {
      try {
        const message = parseMessage(data);
        console.log('Received message:', message);

        if (message.type === 'ping') {
          const pong = createPongMessage(message);
          socket.emit('message', JSON.stringify(pong));
          console.log('Sent pong:', pong);
          
          // Track client type based on ping source
          if (message.source === 'extension') {
            extensionClients.add(socket);
            console.log(`Registered extension client: ${socket.id}`);
          } else if (message.source === 'mobile') {
            mobileClients.add(socket);
            console.log(`Registered mobile client: ${socket.id}`);
          }
        } else if (message.type === 'SYNC_FULL_CONTEXT') {
          console.log('Routing SYNC_FULL_CONTEXT message to mobile clients');
          broadcastToMobileClients(message as SyncFullContextMessage);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      extensionClients.delete(socket);
      mobileClients.delete(socket);
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
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
        mobileClients.delete(client);
      }
    } catch (error) {
      console.error(`Error broadcasting to client ${client.id}:`, error);
      errorCount++;
      // Remove clients that error during broadcast
      mobileClients.delete(client);
    }
  });

  console.log(`Broadcast complete: ${successCount} successful, ${errorCount} errors, ${mobileClients.size} total mobile clients`);
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
