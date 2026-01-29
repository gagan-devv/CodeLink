import { Server, Socket } from 'socket.io';
import { ProtocolMessage, PingMessage, PongMessage, SyncFullContextMessage, InjectPromptMessage, InjectPromptResponseMessage } from '@codelink/protocol';

// Track connected clients by type
export const extensionClients = new Set<Socket>();
export const mobileClients = new Set<Socket>();

// Track pending prompt injection requests: messageId -> mobile socket
const pendingPromptRequests = new Map<string, Socket>();

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
        } else if (message.type === 'INJECT_PROMPT') {
          console.log(`[RelayServer] Routing INJECT_PROMPT message to ${extensionClients.size} extension clients`);
          // Track which mobile client sent this request
          pendingPromptRequests.set(message.id, socket);
          routeToExtensionClients(message as InjectPromptMessage, socket);
        } else if (message.type === 'INJECT_PROMPT_RESPONSE') {
          console.log(`[RelayServer] Routing INJECT_PROMPT_RESPONSE back to mobile client`);
          const response = message as InjectPromptResponseMessage;
          
          // Find the mobile client that sent the original request
          if (response.originalRequestId && pendingPromptRequests.has(response.originalRequestId)) {
            const mobileSocket = pendingPromptRequests.get(response.originalRequestId)!;
            pendingPromptRequests.delete(response.originalRequestId);
            
            if (mobileSocket.connected) {
              mobileSocket.emit('message', JSON.stringify(response));
              console.log(`[RelayServer] Routed response to mobile client ${mobileSocket.id}`);
            } else {
              console.log(`[RelayServer] Mobile client ${mobileSocket.id} disconnected, cannot send response`);
            }
          } else {
            // Fallback: broadcast to all mobile clients if we can't find the original requester
            console.log(`[RelayServer] No original request ID found, broadcasting to all mobile clients`);
            broadcastResponseToMobileClients(response);
          }
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

/**
 * Broadcast INJECT_PROMPT_RESPONSE to all mobile clients (fallback when original requester is unknown)
 */
export function broadcastResponseToMobileClients(message: InjectPromptResponseMessage): void {
  const messageStr = JSON.stringify(message);
  let successCount = 0;

  mobileClients.forEach((client) => {
    try {
      if (client.connected) {
        client.emit('message', messageStr);
        successCount++;
      }
    } catch (error) {
      console.error(`[RelayServer] Error broadcasting response to client ${client.id}:`, error);
    }
  });

  console.log(`[RelayServer] Broadcast response complete: ${successCount} mobile clients notified`);
}

/**
 * Route INJECT_PROMPT message to extension clients.
 * The extension will handle the prompt injection and send back a response.
 */
export function routeToExtensionClients(message: InjectPromptMessage, originSocket: Socket): void {
  if (extensionClients.size === 0) {
    // No extension clients available - send error response back to mobile
    const errorResponse: InjectPromptResponseMessage = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'INJECT_PROMPT_RESPONSE',
      success: false,
      error: 'No extension client is connected. Please ensure the VS Code extension is running.',
    };
    
    originSocket.emit('message', JSON.stringify(errorResponse));
    console.log(`[RelayServer] No extension clients available for prompt injection`);
    return;
  }

  // Route to the first available extension client
  // In the future, we could implement more sophisticated routing (e.g., round-robin, load balancing)
  const messageStr = JSON.stringify(message);
  let routed = false;

  for (const client of extensionClients) {
    try {
      if (client.connected) {
        client.emit('message', messageStr);
        routed = true;
        console.log(`[RelayServer] Routed INJECT_PROMPT to extension client ${client.id}`);
        break; // Only send to one extension
      } else {
        // Remove disconnected clients
        console.log(`[RelayServer] Removing disconnected extension client: ${client.id}`);
        extensionClients.delete(client);
      }
    } catch (error) {
      console.error(`[RelayServer] Error routing to extension client ${client.id}:`, error);
      extensionClients.delete(client);
    }
  }

  if (!routed) {
    // All extension clients were disconnected - send error response
    const errorResponse: InjectPromptResponseMessage = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'INJECT_PROMPT_RESPONSE',
      success: false,
      error: 'All extension clients are disconnected. Please check your VS Code extension.',
    };
    
    originSocket.emit('message', JSON.stringify(errorResponse));
    console.log(`[RelayServer] Failed to route INJECT_PROMPT - all extension clients disconnected`);
  }
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
