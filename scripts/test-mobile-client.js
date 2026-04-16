const { io } = require('socket.io-client');

const SERVER = process.env.RELAY_SERVER_URL || 'http://localhost:8080';

const socket = io(SERVER, { transports: ['websocket'] });

socket.on('connect', () => {
  console.log('[mobile-client] connected', socket.id);

  // send a ping message to register as mobile
  const ping = {
    id: Date.now().toString(),
    timestamp: Date.now(),
    type: 'ping',
    source: 'mobile',
  };

  socket.emit('message', JSON.stringify(ping));
  console.log('[mobile-client] sent ping');
});

socket.on('message', (data) => {
  try {
    const msg = typeof data === 'string' ? JSON.parse(data) : data;
    console.log('[mobile-client] received message:', JSON.stringify(msg, null, 2));
  } catch (err) {
    console.error('[mobile-client] failed to parse message', err, data);
  }
});

socket.on('disconnect', (reason) => {
  console.log('[mobile-client] disconnected', reason);
});

socket.on('connect_error', (err) => {
  console.error('[mobile-client] connect_error', err.message);
});

// Keep process alive
process.stdin.resume();
