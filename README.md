# CodeLink

CodeLink is a development tool that enables AI-assisted code editing through a mobile interface, without requiring cloud IDEs or repository synchronization. All changes require human approval before being applied.

## Architecture Overview

CodeLink consists of three main components:

### 1. VS Code Extension (`packages/vscode-extension`)

A Visual Studio Code extension that integrates with your local development environment. It communicates with the relay server to receive code change requests from the mobile client.

### 2. Relay Server (`packages/relay-server`)

A WebSocket relay server built with Socket.IO that facilitates real-time communication between the VS Code extension and the mobile client. It runs locally on your machine and handles message routing.

### 3. Mobile Client (`packages/mobile-client`)

A Progressive Web App (PWA) built with React that provides a mobile interface for reviewing and approving code changes. It connects to the relay server via WebSocket.

### 4. Protocol Package (`packages/protocol`)

A shared TypeScript package that defines the message types and interfaces used for communication between all components.

## Core Principles

- **No Cloud IDE**: All code editing happens in your local VS Code instance
- **No Repository Sync**: No automatic syncing or pushing to remote repositories
- **Human Approval Required**: All code changes must be explicitly approved by the developer
- **Unified Diff as Primary UI**: Code changes are presented as unified diffs for easy review

## Setup Instructions

### Prerequisites

- Node.js 20.x or higher
- npm 9.x or higher

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Build all packages:

```bash
npm run build
```

## Development Instructions

### Running All Components

Start all components in development mode:

```bash
npm run dev
```

### Running Components Individually

**Protocol Package** (build and watch):

```bash
cd packages/protocol
npm run dev
```

**VS Code Extension** (build and watch):

```bash
cd packages/vscode-extension
npm run dev
```

Then press F5 in VS Code to launch the Extension Development Host.

**Relay Server** (start server):

```bash
cd packages/relay-server
npm run build
npm start
```

The relay server will listen on port 8080 by default. You can change this by setting the `PORT` environment variable:

```bash
PORT=3001 npm start
```

**Note**: The `npm run dev` command only compiles TypeScript in watch mode - it does not start the server. To run the server during development, use two terminals:

Terminal 1 (compile in watch mode):

```bash
cd packages/relay-server
npm run dev
```

Terminal 2 (run the server):

```bash
cd packages/relay-server
npm start
```

**Mobile Client** (development server):

```bash
cd packages/mobile-client
npm run dev
```

The mobile client will be available at http://localhost:3000

## Testing the Complete Flow

To verify the entire system is working:

1. **Start the relay server**:

   ```bash
   cd packages/relay-server
   npm run build
   npm start
   ```

   You should see: `CodeLink Relay Server listening on port 8080`

2. **Start the mobile client**:

   ```bash
   cd packages/mobile-client
   npm run dev
   ```

   Open http://localhost:3000 in your browser

3. **Verify the connection**:
   - The mobile client should show status: "Connected" (in green)
   - Check the browser console - you should see:
     - "Connected to relay server"
     - "Sent ping: {id, timestamp, type, source}"
     - "Received message: {id, timestamp, type, originalId}"
   - Check the relay server terminal - you should see:
     - "Client connected: [socket-id]"
     - "Received message: {type: 'ping', ...}"
     - "Sent pong: {type: 'pong', ...}"
   - The mobile client UI should display the "Last Pong Received" section with message details

4. **Test the VS Code extension** (optional):
   - Open the VS Code workspace
   - Press F5 to launch Extension Development Host
   - Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
   - Run "CodeLink: Hello World"
   - You should see a notification with a ping message ID

## Code Quality Scripts

### Linting

Check code for linting errors:

```bash
npm run lint
```

### Formatting

Format all code files:

```bash
npm run format
```

Check if code is properly formatted:

```bash
npm run format:check
```

### Testing

Run all tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## Project Structure

```
codelink/
├── packages/
│   ├── protocol/          # Shared TypeScript types and interfaces
│   ├── vscode-extension/  # VS Code extension
│   ├── relay-server/      # WebSocket relay server
│   └── mobile-client/     # React PWA mobile client
├── tests/                 # Integration and property-based tests
├── package.json           # Root workspace configuration
├── tsconfig.base.json     # Shared TypeScript configuration
└── README.md              # This file
```

## License

MIT
