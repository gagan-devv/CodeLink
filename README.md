# CodeLink

CodeLink is a development tool that enables AI-assisted code editing through a mobile interface, without requiring cloud IDEs or repository synchronization. All changes require human approval before being applied.

## Architecture Overview

CodeLink consists of three main components:

### 1. VS Code Extension (`packages/vscode-extension`)

A Visual Studio Code extension that integrates with your local development environment. It communicates with the relay server to receive code change requests from the mobile client.

**Git Integration Components**:
- **File Watcher**: Monitors active editor changes with 1000ms debouncing
- **Git Integration Module**: Fetches HEAD versions from local Git repository using simple-git
- **Diff Generator**: Compares HEAD vs current file state and generates FileContextPayload
- **WebSocket Client**: Transmits SYNC_FULL_CONTEXT messages to relay server

### 2. Relay Server (`packages/relay-server`)

A WebSocket relay server built with Socket.IO that facilitates real-time communication between the VS Code extension and the mobile client. It runs locally on your machine and handles message routing.

**Message Routing**: Routes SYNC_FULL_CONTEXT messages from VS Code extension to all connected mobile clients.

### 3. Mobile Client (`packages/mobile-client`)

A Progressive Web App (PWA) built with React that provides a mobile interface for reviewing and approving code changes. It connects to the relay server via WebSocket.

**Diff Viewer**: Renders unified diffs using react-diff-viewer-continued with mobile-optimized styling, dirty state indicators, and timestamp display.

### 4. Protocol Package (`packages/protocol`)

A shared TypeScript package that defines the message types and interfaces used for communication between all components.

**Message Types**: Includes SYNC_FULL_CONTEXT message type and FileContextPayload interface for Git integration.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          VS Code Extension                               │
│                                                                          │
│  ┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐      │
│  │ File Watcher │───▶│ Git Integration │───▶│ Diff Generator   │      │
│  │              │    │ Module          │    │                  │      │
│  │ - Debounce   │    │ - Fetch HEAD    │    │ - Compare        │      │
│  │ - Track file │    │ - Check tracked │    │ - Build payload  │      │
│  └──────────────┘    └─────────────────┘    └──────────────────┘      │
│                                                        │                 │
│                                                        ▼                 │
│                                              ┌──────────────────┐       │
│                                              │ WebSocket Client │       │
│                                              │ - Send message   │       │
│                                              │ - Queue/retry    │       │
│                                              └──────────────────┘       │
└──────────────────────────────────────────────────────┬──────────────────┘
                                                       │
                                                       │ SYNC_FULL_CONTEXT
                                                       │ message
                                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Relay Server                                   │
│                                                                          │
│                    ┌──────────────────────────┐                         │
│                    │   Message Router         │                         │
│                    │   - Receive from VS Code │                         │
│                    │   - Broadcast to mobile  │                         │
│                    └──────────────────────────┘                         │
└──────────────────────────────────────────────────────┬──────────────────┘
                                                       │
                                                       │ Forward to all
                                                       │ mobile clients
                                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Mobile Client (PWA)                             │
│                                                                          │
│  ┌──────────────────┐    ┌─────────────────────────────────────┐      │
│  │ WebSocket Client │───▶│         Diff Viewer                  │      │
│  │ - Receive msg    │    │ - Render unified diff                │      │
│  │ - Parse payload  │    │ - Show dirty indicator               │      │
│  │ - Handle errors  │    │ - Display timestamp                  │      │
│  └──────────────────┘    │ - Mobile-optimized layout            │      │
│                          └─────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘

External Dependencies:
┌─────────────────┐         ┌─────────────────┐
│ Git Repository  │         │  File System    │
│ - HEAD content  │         │ - Current files │
└─────────────────┘         └─────────────────┘
        ▲                            ▲
        │                            │
        └────────────────────────────┘
              Used by VS Code Extension
```

**Data Flow**:
1. User edits file in VS Code
2. File Watcher detects change (after 1000ms debounce)
3. Git Integration Module fetches HEAD version from Git repository
4. Git Integration Module reads current file from disk
5. Diff Generator compares HEAD vs current and creates FileContextPayload
6. WebSocket Client sends SYNC_FULL_CONTEXT message to Relay Server
7. Relay Server broadcasts message to all connected Mobile Clients
8. Mobile Client receives message and renders diff in Diff Viewer

## Core Principles

- **No Cloud IDE**: All code editing happens in your local VS Code instance
- **No Repository Sync**: No automatic syncing or pushing to remote repositories
- **Human Approval Required**: All code changes must be explicitly approved by the developer
- **Unified Diff as Primary UI**: Code changes are presented as unified diffs for easy review

## Features

### Git Integration & File Diffing

CodeLink provides real-time unified diff viewing on mobile devices, allowing you to monitor your code changes as you work. The system automatically detects file edits in VS Code, compares them against the Git HEAD version, and displays the differences on your mobile device.

#### How It Works

The Git Integration feature follows a pipeline architecture:

```
File Edit in VS Code
    ↓
File Watcher (1000ms debounce)
    ↓
Git Integration Module (fetch HEAD version)
    ↓
Diff Generator (compare HEAD vs current)
    ↓
WebSocket Client (send to relay server)
    ↓
Relay Server (route to mobile clients)
    ↓
Mobile Client (render unified diff)
```

#### Key Capabilities

- **Automatic Change Detection**: Monitors active file changes in VS Code with intelligent debouncing
- **Git Integration**: Fetches HEAD versions from your local Git repository using simple-git
- **Real-time Diff Transmission**: Sends unified diffs via WebSocket to connected mobile devices
- **Mobile-Optimized Display**: Renders diffs using react-diff-viewer-continued in unified view mode
- **Dirty State Tracking**: Shows visual indicators for files with unsaved changes
- **Untracked File Support**: Handles files not yet committed to Git gracefully
- **Performance Optimized**: End-to-end latency under 2 seconds for typical files

#### Using the Diff Viewer on Mobile

1. **Connect to the relay server**: Open the mobile client at http://localhost:3000 (or your configured URL)
2. **Verify connection**: Check that the status shows "Connected" in green
3. **Edit files in VS Code**: Open any file in your workspace and make changes
4. **View diffs automatically**: After you stop typing (1 second delay), the diff appears on your mobile device
5. **Review changes**: The diff viewer shows:
   - File name and path
   - Orange dot indicator for unsaved changes
   - Timestamp of when the diff was generated
   - Line-by-line comparison with additions (green) and deletions (red)
   - Unified view optimized for mobile screens

#### Diff Viewer Features

- **Unified View Mode**: Single-column diff display optimized for mobile screens
- **Syntax Highlighting**: Code is displayed with appropriate syntax coloring
- **Dark Theme**: Matches VS Code's dark theme for consistency
- **Dirty Indicator**: Orange dot (●) appears when file has unsaved changes
- **Timestamp Display**: Shows when the diff was last generated
- **New File Support**: Files not in Git are shown as all additions
- **No Changes Message**: Clear indication when file matches HEAD version

#### WebSocket Message Protocol

The Git Integration feature uses the `SYNC_FULL_CONTEXT` message type to transmit diff data:

```typescript
interface SyncFullContextMessage {
  type: 'SYNC_FULL_CONTEXT';
  payload: FileContextPayload;
  timestamp: number;
}

interface FileContextPayload {
  fileName: string;        // Workspace-relative path (e.g., "src/index.ts")
  originalFile: string;    // Content from Git HEAD (empty if untracked)
  modifiedFile: string;    // Current file content from disk
  isDirty: boolean;        // True if file has unsaved changes
  timestamp: number;       // Unix timestamp in milliseconds
}
```

**Message Flow**:
1. VS Code extension creates `SYNC_FULL_CONTEXT` message with `FileContextPayload`
2. Message is sent to relay server via WebSocket
3. Relay server broadcasts message to all connected mobile clients
4. Mobile client parses payload and renders diff using react-diff-viewer-continued

#### Performance Characteristics

The Git Integration feature is designed for responsive real-time feedback:

- **Debounce Delay**: 1000ms after last keystroke before diff generation
- **Git Operations**: Typically complete in under 500ms for standard files
- **Diff Generation**: Completes in under 200ms for files under 10,000 lines
- **WebSocket Latency**: Under 300ms on typical local networks
- **End-to-End Latency**: Total time from last keystroke to mobile display is under 2 seconds

**Performance Tips**:
- Large files (>10,000 lines) may take longer to process
- Binary files are automatically skipped
- Network latency affects WebSocket transmission time
- Multiple rapid edits are debounced to avoid excessive processing

#### Troubleshooting

**Diffs not appearing on mobile**:
- Verify the relay server is running and accessible
- Check that the mobile client shows "Connected" status
- Ensure the file is within your VS Code workspace
- Check VS Code Output panel for CodeLink extension logs
- Verify the file is a text file (binary files are skipped)

**Empty diffs for tracked files**:
- Ensure the file is committed to Git (check `git status`)
- Verify Git repository is initialized in your workspace
- Check that the file path is correct and relative to workspace root
- Review VS Code extension logs for Git operation errors

**Performance issues**:
- Large files (>10,000 lines) may experience slower processing
- Check network latency between VS Code and relay server
- Verify Git operations are not timing out (check logs)
- Consider closing unused files to reduce monitoring overhead

**Git repository not found**:
- Ensure your workspace is within a Git repository
- Run `git rev-parse --show-toplevel` to verify Git is initialized
- Check that the VS Code workspace folder is correctly configured
- Review extension logs for Git initialization errors

**WebSocket connection issues**:
- Verify relay server is running on the expected port (default: 8080)
- Check firewall settings allow WebSocket connections
- Ensure no other service is using the relay server port
- Review browser console for WebSocket connection errors

**Unsaved changes not reflected**:
- The diff shows disk content, not unsaved editor content
- Save the file (Ctrl+S / Cmd+S) to see unsaved changes in the diff
- The orange dot indicator shows when changes are unsaved
- isDirty flag tracks unsaved state separately from diff content

**Untracked files showing as all additions**:
- This is expected behavior for files not committed to Git
- The originalFile will be empty for untracked files
- Commit the file to Git to see proper diffs
- Use `git add <file>` and `git commit` to track the file

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
