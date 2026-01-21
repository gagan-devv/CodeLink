import { Server } from 'socket.io';
import { ProtocolMessage, PingMessage, PongMessage } from '@codelink/protocol';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;

const io = new Server(PORT, {
  cors: {
    origin: '*',
  },
});

console.log(`CodeLink Relay Server listening on port ${PORT}`);

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
