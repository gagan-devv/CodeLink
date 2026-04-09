# Configuration Module

This module provides centralized configuration management for the mobile client application.

## Usage

### Basic Usage

```typescript
import { getConfig } from './config';

const config = getConfig();
console.log(config.relayServerUrl); // ws://localhost:3000
console.log(config.socketOptions.reconnectionAttempts); // 5
```

### Environment Variables

The relay server URL can be configured via:

1. **Environment variable** (highest priority):

   ```bash
   RELAY_SERVER_URL=ws://production-server:3000 npm start
   ```

2. **app.json extra field** (medium priority):

   ```json
   {
     "expo": {
       "extra": {
         "relayServerUrl": "ws://staging-server:3000"
       }
     }
   }
   ```

3. **Default value** (lowest priority):
   ```
   ws://localhost:3000
   ```

### Runtime Configuration Updates

For testing or dynamic configuration:

```typescript
import { updateConfig } from './config';

updateConfig({
  relayServerUrl: 'ws://test-server:4000',
  socketOptions: {
    reconnectionAttempts: 10,
  },
});
```

## Configuration Reference

### `relayServerUrl`

- **Type**: `string`
- **Default**: `ws://localhost:3000`
- **Description**: WebSocket URL for the relay server
- **Requirements**: 2.1

### `socketOptions`

#### `reconnection`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable automatic reconnection
- **Requirements**: 8.4

#### `reconnectionAttempts`

- **Type**: `number`
- **Default**: `5`
- **Description**: Maximum number of reconnection attempts
- **Requirements**: 8.4

#### `reconnectionDelay`

- **Type**: `number`
- **Default**: `1000` (ms)
- **Description**: Delay between reconnection attempts

#### `timeout`

- **Type**: `number`
- **Default**: `20000` (ms)
- **Description**: Connection timeout

### `ui`

#### `maxPromptLength`

- **Type**: `number`
- **Default**: `5000`
- **Description**: Maximum characters allowed in a prompt

#### `diffHistoryLimit`

- **Type**: `number`
- **Default**: `50`
- **Description**: Maximum number of diffs to keep in history

#### `notificationDuration`

- **Type**: `number`
- **Default**: `4000` (ms)
- **Description**: Duration to show notifications
