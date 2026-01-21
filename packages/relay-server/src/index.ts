import { Server } from 'socket.io';
import { ProtocolMessage, PingMessage, PongMessage } from '@codelink/protocol';

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
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  return io;
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
