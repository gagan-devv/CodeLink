# Manual Testing Guide: Git Integration & File Diffing

This guide walks you through manually testing the Git Integration & File Diffing feature end-to-end.

## Prerequisites

- Node.js 20.x or higher
- VS Code installed
- A Git repository (this CodeLink project works perfectly)
- Three terminal windows

## Setup (One-Time)

1. **Build all packages**:
   ```bash
   npm run build
   ```

2. **Verify the build succeeded**:
   ```bash
   ls packages/protocol/dist
   ls packages/relay-server/dist
   ls packages/vscode-extension/dist
   ls packages/mobile-client/dist
   ```

## Manual Testing Steps

### Step 1: Start the Relay Server

**Terminal 1:**
```bash
cd packages/relay-server
npm start
```

**Expected Output:**
```
[RelayServer] CodeLink Relay Server listening on port 8080
```

**Troubleshooting:**
- If you see "Address already in use", another process is using port 8080
- Change the port: `PORT=3000 npm start`
- Remember to update the mobile client URL in Step 2

---

### Step 2: Start the Mobile Client

**Terminal 2:**
```bash
cd packages/mobile-client
npm run dev
```

**Expected Output:**
```
VITE v5.x.x  ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

**Open in Browser:**
1. Open http://localhost:5173/ in your browser (or the URL shown)
2. Open browser DevTools (F12) and go to Console tab

**Expected Behavior:**
- You should see "Connected" status (green indicator)
- Console should show:
  ```
  [WebSocketClient] Connected to relay server
  [WebSocketClient] Sending ping to register as mobile client
  [WebSocketClient] Received message: {type: "pong", ...}
  ```

**Troubleshooting:**
- If you see "Disconnected" (red), check that relay server is running
- If relay server is on a different port, update the URL in `packages/mobile-client/src/App.tsx`

---

### Step 3: Start VS Code Extension

**Terminal 3:**
```bash
# Make sure you're in the root directory
code .
```

**In VS Code:**
1. Press **F5** to launch Extension Development Host
2. A new VS Code window will open (titled "[Extension Development Host]")
3. In the new window, open this CodeLink project folder

**Expected Output in Debug Console:**
```
CodeLink extension activating...
Workspace root: /path/to/CodeLink
Git integration initialized successfully
Diff generator initialized
WebSocket client connecting to http://localhost:3000
File watcher initialized
CodeLink extension activated successfully
```

**Troubleshooting:**
- If you don't see the debug console, go to View → Debug Console
- If Git integration fails, make sure you're in a Git repository
- If WebSocket fails, check the relay server URL in `packages/vscode-extension/src/extension.ts` (line 52)

---

### Step 4: Test File Change Detection

**In the Extension Development Host window:**

1. **Open a file** in the CodeLink project (e.g., `README.md`)
2. **Make a change** - add a line or modify existing text
3. **Wait 1 second** (debounce period)

**Expected Behavior:**

**In VS Code Debug Console:**
```
[INFO] File changed: /path/to/CodeLink/README.md
[PERF] Git operation: XXms (HEAD content: XXX bytes)
[PERF] Diff generation: XXms (README.md, isDirty: true)
[PERF] WebSocket send: XXms (message id: ...)
[PERF] Total pipeline: XXXms
```

**In Relay Server Terminal:**
```
[RelayServer] Received message type: SYNC_FULL_CONTEXT from [socket-id]
[RelayServer] Routing SYNC_FULL_CONTEXT message to 1 mobile clients
[RelayServer] Broadcast complete: 1 successful, 0 errors, 1 total mobile clients
```

**In Mobile Client Browser:**
- The diff viewer should update automatically
- You should see:
  - File name: `README.md`
  - Orange dot (dirty indicator) next to the file name
  - Timestamp showing when the diff was generated
  - Unified diff showing your changes:
    - Red lines (deletions) with `-` prefix
    - Green lines (additions) with `+` prefix

**Troubleshooting:**
- If nothing happens, check the VS Code Debug Console for errors
- If you see errors about Git, make sure the file is tracked by Git
- If the mobile client doesn't update, check browser console for errors

---

### Step 5: Test Different Scenarios

#### Scenario A: Untracked File (New File)

1. **Create a new file** in the Extension Development Host:
   ```bash
   # In Terminal 3
   echo "console.log('new file');" > newfile.ts
   ```

2. **Open the file** in VS Code

3. **Expected Result:**
   - Mobile client shows the entire file as additions (all green lines)
   - No orange dot (isDirty: false)
   - originalFile is empty

#### Scenario B: No Changes

1. **Open a file** that hasn't been modified since last commit
2. **Expected Result:**
   - Mobile client shows "No changes" or identical content
   - No orange dot (isDirty: false)

#### Scenario C: Save File

1. **Make changes** to a file
2. **Wait for diff** to appear on mobile (with orange dot)
3. **Save the file** (Ctrl+S / Cmd+S)
4. **Wait 1 second**
5. **Expected Result:**
   - Orange dot should disappear (isDirty: false)
   - Diff still shows changes compared to HEAD

#### Scenario D: Multiple Rapid Changes

1. **Open a file**
2. **Type rapidly** without stopping for 1 second
3. **Expected Result:**
   - Only ONE diff should be sent after you stop typing
   - Check Debug Console - should see only one pipeline execution

#### Scenario E: Large File

1. **Open a large file** (>1000 lines)
2. **Make a change**
3. **Expected Result:**
   - Should still complete within 2 seconds
   - Check Debug Console for performance metrics
   - If file is >50KB, you should see compression logs

---

### Step 6: Test Multiple Mobile Clients

1. **Open a second browser tab** to http://localhost:5173/
2. **Make a change** in VS Code
3. **Expected Result:**
   - BOTH browser tabs should receive the diff simultaneously
   - Check relay server logs - should show "Routing to 2 mobile clients"

---

### Step 7: Test Error Handling

#### Test A: Disconnect Mobile Client

1. **Close the mobile client browser tab**
2. **Make a change** in VS Code
3. **Expected Result:**
   - VS Code should queue the message
   - Relay server should show "0 mobile clients"
   - No errors in VS Code Debug Console

#### Test B: Disconnect Relay Server

1. **Stop the relay server** (Ctrl+C in Terminal 1)
2. **Make a change** in VS Code
3. **Expected Result:**
   - VS Code should queue messages
   - Mobile client should show "Disconnected" (red)
4. **Restart relay server**
5. **Expected Result:**
   - Mobile client reconnects automatically
   - Queued messages are sent

#### Test C: Binary File

1. **Open a binary file** (e.g., an image)
2. **Expected Result:**
   - Should handle gracefully (may skip or show as binary)

---

## Performance Verification

### Check Total Pipeline Time

1. **Make a change** to a file
2. **Check VS Code Debug Console** for the line:
   ```
   [PERF] Total pipeline: XXXms
   ```
3. **Expected:** Should be under 2000ms (typically 100-500ms)

### Check Individual Stages

Look for these performance logs:
- `[PERF] Git operation: XXms` - Should be <500ms
- `[PERF] Diff generation: XXms` - Should be <200ms
- `[PERF] WebSocket send: XXms` - Should be <100ms

---

## Cleanup

When you're done testing:

1. **Close Extension Development Host** window
2. **Stop relay server** (Ctrl+C in Terminal 1)
3. **Stop mobile client** (Ctrl+C in Terminal 2)
4. **Close browser tabs**

---

## Common Issues and Solutions

### Issue: "Git repository not found"
**Solution:** Make sure you're testing in a Git repository. Run `git init` if needed.

### Issue: "WebSocket connection failed"
**Solution:** 
- Check relay server is running
- Verify port numbers match (default: 8080 for relay, 3000 for extension)
- Check firewall settings

### Issue: "No diff appears on mobile"
**Solution:**
- Check browser console for errors
- Verify mobile client is connected (green status)
- Check relay server logs to see if message was routed

### Issue: "Extension not activating"
**Solution:**
- Check VS Code Debug Console for errors
- Rebuild packages: `npm run build`
- Restart Extension Development Host (F5)

### Issue: "Diff shows but is incorrect"
**Solution:**
- Verify file is tracked by Git: `git ls-files | grep filename`
- Check if file has been committed: `git status`
- Try committing changes and testing again

---

## Success Criteria

You've successfully tested the feature if:

- ✅ File changes in VS Code appear on mobile within 1-2 seconds
- ✅ Diffs show correct additions (green) and deletions (red)
- ✅ Dirty indicator (orange dot) appears for unsaved files
- ✅ Untracked files show as all additions
- ✅ Multiple mobile clients receive updates simultaneously
- ✅ System handles disconnections gracefully
- ✅ Performance is under 2000ms end-to-end

---

## Next Steps

After manual testing, you can:

1. **Run automated tests**: `npm test`
2. **Run property-based tests**: `npm test -- --grep "properties"`
3. **Run performance tests**: `npm test -- --grep "performance"`
4. **Check code coverage**: `npm test -- --coverage`

---

## Feedback and Issues

If you encounter issues not covered in this guide:

1. Check the VS Code Debug Console for detailed error messages
2. Check the relay server terminal for connection issues
3. Check the browser console for mobile client errors
4. Review the logs for performance bottlenecks

Happy testing! 🚀


It is the test run of my project called 'CodeLink', I hope it must work.