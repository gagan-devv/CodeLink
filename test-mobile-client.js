#!/usr/bin/env node

/**
 * Test script to send a SYNC_FULL_CONTEXT message to the mobile client
 * Usage: node test-mobile-client.js
 */

const { io } = require('socket.io-client');

const RELAY_URL = 'http://localhost:8080';

console.log('Connecting to relay server...');
const socket = io(RELAY_URL);

socket.on('connect', () => {
  console.log('Connected to relay server');
  
  // Send ping to register as extension client
  const ping = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    type: 'ping',
    source: 'extension',
  };
  
  console.log('Sending ping to register as extension client...');
  socket.emit('message', JSON.stringify(ping));
  
  // Wait for pong, then send test message
  socket.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('Received:', message);
    
    if (message.type === 'pong') {
      console.log('Registered as extension client');
      
      // Send test SYNC_FULL_CONTEXT message
      const testMessage = {
        id: crypto.randomUUID(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'src/example.ts',
          originalFile: 'const x = 1;\nconst y = 2;\n\nfunction hello() {\n  console.log("Hello");\n}',
          modifiedFile: 'const x = 1;\nconst y = 3;\nconst z = 4;\n\nfunction hello() {\n  console.log("Hello World!");\n}',
          isDirty: true,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      };
      
      console.log('\nSending SYNC_FULL_CONTEXT message...');
      console.log('Payload:', testMessage.payload);
      socket.emit('message', JSON.stringify(testMessage));
      
      console.log('\n✅ Test message sent!');
      console.log('Check your mobile client browser - you should see the diff viewer now.');
      
      // Keep connection open for a bit
      setTimeout(() => {
        console.log('\nDisconnecting...');
        socket.disconnect();
        process.exit(0);
      }, 2000);
    }
  });
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
  console.error('\nMake sure the relay server is running:');
  console.error('  cd packages/relay-server');
  console.error('  npm run dev');
  process.exit(1);
});

socket.on('disconnect', () => {
  console.log('Disconnected from relay server');
});
