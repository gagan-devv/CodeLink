const { io } = require('socket.io-client');

const SERVER = process.env.RELAY_SERVER_URL || 'http://localhost:8080';

const socket = io(SERVER, { transports: ['websocket'] });

socket.on('connect', () => {
  console.log('[extension-sim] connected', socket.id);

  // send a SYNC_FULL_CONTEXT message to be broadcast to mobile clients
  const syncMsg = {
    id: `sync-${Date.now()}`,
    timestamp: Date.now(),
    type: 'SYNC_FULL_CONTEXT',
    source: 'extension',
    payload: {
      files: [
        {
          path: 'docs/api.md',
          diff: '---\n+++\n@@ -1 +1 @@\n-Hello\n+Hello world',
        },
      ],
    },
  };

  socket.emit('message', JSON.stringify(syncMsg));
  console.log('[extension-sim] sent SYNC_FULL_CONTEXT');

  setTimeout(() => {
    console.log('[extension-sim] done');
    socket.disconnect();
    process.exit(0);
  }, 500);
});

socket.on('connect_error', (err) => {
  console.error('[extension-sim] connect_error', err.message);
  process.exit(1);
});
