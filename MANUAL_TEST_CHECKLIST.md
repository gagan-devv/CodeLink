# Manual Test Checklist - Task 17

This checklist covers all manual verification scenarios for the Git Integration & File Diffing feature.

## Test Environment Setup

- [ ] Node.js 20.x or higher installed
- [ ] VS Code installed
- [ ] Git repository initialized
- [ ] All packages built (`npm run build`)
- [ ] Three terminal windows ready

---

## Test Category 1: Various File Types

### Test 1.1: TypeScript Files
- [ ] Open a `.ts` file (e.g., `packages/protocol/src/index.ts`)
- [ ] Make changes (add a function, modify interface)
- [ ] Wait 1 second for debounce
- [ ] **Verify:** Diff appears on mobile with correct syntax highlighting
- [ ] **Verify:** TypeScript code is readable and properly formatted
- [ ] **Verify:** Total pipeline time < 2000ms

**Notes:**
```
File tested: _______________
Pipeline time: _____ ms
Issues found: _______________
```

### Test 1.2: JavaScript Files
- [ ] Open a `.js` file (e.g., `test-mobile-client.js`)
- [ ] Make changes (add console.log, modify logic)
- [ ] Wait 1 second for debounce
- [ ] **Verify:** Diff appears on mobile
- [ ] **Verify:** JavaScript syntax is correctly displayed

**Notes:**
```
File tested: _______________
Pipeline time: _____ ms
Issues found: _______________
```

### Test 1.3: JSON Files
- [ ] Open a `.json` file (e.g., `package.json`)
- [ ] Make changes (add dependency, modify version)
- [ ] Wait 1 second for debounce
- [ ] **Verify:** Diff appears on mobile
- [ ] **Verify:** JSON formatting is preserved
- [ ] **Verify:** Indentation is correct

**Notes:**
```
File tested: _______________
Pipeline time: _____ ms
Issues found: _______________
```

### Test 1.4: Markdown Files
- [ ] Open a `.md` file (e.g., `README.md`)
- [ ] Make changes (add heading, modify text)
- [ ] Wait 1 second for debounce
- [ ] **Verify:** Diff appears on mobile
- [ ] **Verify:** Markdown syntax is visible (not rendered)
- [ ] **Verify:** Special characters display correctly

**Notes:**
```
File tested: _______________
Pipeline time: _____ ms
Issues found: _______________
```

---

## Test Category 2: Untracked Files (Requirement 2.3)

### Test 2.1: Create New Untracked File
- [ ] Create new file: `touch test-untracked.ts`
- [ ] Add content: `echo "export const test = 'untracked';" > test-untracked.ts`
- [ ] Open file in VS Code
- [ ] **Verify:** Entire file shows as additions (all green)
- [ ] **Verify:** originalFile is empty
- [ ] **Verify:** No errors in Debug Console
- [ ] **Verify:** isDirty is false (file is saved)

**Expected Debug Console Output:**
```
[INFO] File changed: test-untracked.ts
[INFO] File is not tracked by Git, treating as new file
[PERF] Git operation: XXms (HEAD content: 0 bytes)
```

**Notes:**
```
Issues found: _______________
```

### Test 2.2: Verify Git Status
- [ ] Run `git status` in terminal
- [ ] **Verify:** File appears as untracked
- [ ] **Verify:** Mobile shows file as all additions

**Notes:**
```
Git status output: _______________
```

---

## Test Category 3: Newly Added Files (Requirement 2.3)

### Test 3.1: Add File to Git (Not Committed)
- [ ] Create new file: `touch test-added.ts`
- [ ] Add content: `echo "export const added = true;" > test-added.ts`
- [ ] Stage file: `git add test-added.ts`
- [ ] Open file in VS Code
- [ ] **Verify:** File shows as all additions (green)
- [ ] **Verify:** System treats it like untracked file
- [ ] **Verify:** No errors occur

**Notes:**
```
Issues found: _______________
```

### Test 3.2: Modify Newly Added File
- [ ] Make changes to the staged file
- [ ] **Verify:** Diff shows changes correctly
- [ ] **Verify:** isDirty flag appears (orange dot)

**Notes:**
```
Issues found: _______________
```

---

## Test Category 4: Large Files (Requirement 3.3)

### Test 4.1: Create Large TypeScript File
```bash
# Generate a large file with >10,000 lines
node -e "
const lines = [];
for (let i = 0; i < 10500; i++) {
  lines.push(\`export const var\${i} = \${i}; // Line \${i}\`);
}
require('fs').writeFileSync('test-large.ts', lines.join('\\n'));
"
```

- [ ] Add and commit the file: `git add test-large.ts && git commit -m "Add large file"`
- [ ] Open `test-large.ts` in VS Code
- [ ] Make a change on line 5000
- [ ] Wait 1 second
- [ ] **Verify:** Diff generation completes
- [ ] **Verify:** Performance metrics in Debug Console
- [ ] **Verify:** Git operation < 500ms
- [ ] **Verify:** Diff generation < 200ms (may be higher for large files)
- [ ] **Verify:** Total pipeline < 2000ms
- [ ] **Verify:** Mobile client renders diff (may be slow)

**Performance Metrics:**
```
File size: _____ lines
Git operation: _____ ms
Diff generation: _____ ms
Total pipeline: _____ ms
Mobile render time: _____ ms
Issues found: _______________
```

### Test 4.2: Large File with Many Changes
- [ ] Make changes on multiple lines (10+ lines)
- [ ] **Verify:** All changes appear in diff
- [ ] **Verify:** Performance is acceptable
- [ ] **Verify:** No memory issues

**Notes:**
```
Number of changes: _____
Performance: _______________
Issues found: _______________
```

---

## Test Category 5: Binary Files

### Test 5.1: Open Binary File (Image)
- [ ] Add a small image to the repo: `cp /path/to/image.png test-image.png`
- [ ] Commit it: `git add test-image.png && git commit -m "Add image"`
- [ ] Open `test-image.png` in VS Code
- [ ] **Verify:** System handles gracefully (no crash)
- [ ] **Verify:** Debug Console shows appropriate message
- [ ] **Verify:** Mobile client shows appropriate message or skips

**Expected Behavior:**
- System should detect binary file and either:
  - Skip diff generation with log message
  - Show "Binary file" message
  - Handle without errors

**Notes:**
```
Actual behavior: _______________
Issues found: _______________
```

### Test 5.2: Binary File in Git
- [ ] Modify the binary file (replace with different image)
- [ ] Open in VS Code
- [ ] **Verify:** No crash or errors
- [ ] **Verify:** Graceful handling

**Notes:**
```
Issues found: _______________
```

---

## Test Category 6: WebSocket Disconnection and Reconnection (Requirement 6.3)

### Test 6.1: Disconnect Mobile Client
- [ ] Open mobile client in browser
- [ ] **Verify:** Status shows "Connected" (green)
- [ ] Close browser tab
- [ ] Make changes in VS Code
- [ ] **Verify:** VS Code queues messages (check Debug Console)
- [ ] Reopen mobile client
- [ ] **Verify:** Mobile client reconnects
- [ ] **Verify:** Queued messages are delivered

**Debug Console Expected:**
```
[WebSocketClient] Message queued (connection lost)
[WebSocketClient] Queue size: 1
```

**Notes:**
```
Queue behavior: _______________
Issues found: _______________
```

### Test 6.2: Disconnect Relay Server
- [ ] Stop relay server (Ctrl+C)
- [ ] **Verify:** Mobile client shows "Disconnected" (red)
- [ ] **Verify:** VS Code shows connection lost
- [ ] Make changes in VS Code
- [ ] **Verify:** Messages are queued
- [ ] Restart relay server
- [ ] **Verify:** Both clients reconnect automatically
- [ ] **Verify:** Queued messages are sent
- [ ] **Verify:** Mobile client receives updates

**Reconnection Time:**
```
Time to reconnect: _____ seconds
Messages delivered: _____
Issues found: _______________
```

### Test 6.3: Disconnect VS Code Extension
- [ ] Close Extension Development Host window
- [ ] **Verify:** Mobile client remains connected to relay
- [ ] Restart Extension Development Host (F5)
- [ ] **Verify:** Extension reconnects
- [ ] Make changes
- [ ] **Verify:** Diffs flow normally

**Notes:**
```
Issues found: _______________
```

### Test 6.4: Multiple Disconnections
- [ ] Disconnect and reconnect mobile client 5 times rapidly
- [ ] **Verify:** System handles gracefully
- [ ] **Verify:** No memory leaks
- [ ] **Verify:** Connection stabilizes

**Notes:**
```
Issues found: _______________
```

---

## Test Category 7: Actual Mobile Device Testing

### Test 7.1: Find Mobile Device IP
```bash
# On your development machine, find your local IP
# macOS/Linux:
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows:
ipconfig | findstr IPv4
```

**Your IP:** `_______________`

### Test 7.2: Update Mobile Client Configuration
- [ ] Update relay server URL in mobile client to use your IP
- [ ] File: `packages/mobile-client/src/App.tsx`
- [ ] Change: `http://localhost:8080` → `http://YOUR_IP:8080`
- [ ] Rebuild: `npm run build` in mobile-client

### Test 7.3: Start Relay Server on Network
```bash
cd packages/relay-server
# Allow network connections
HOST=0.0.0.0 npm start
```

### Test 7.4: Access from Mobile Device
- [ ] On mobile device, open browser
- [ ] Navigate to: `http://YOUR_IP:5173`
- [ ] **Verify:** Mobile client loads
- [ ] **Verify:** Connection status shows "Connected"
- [ ] Make changes in VS Code
- [ ] **Verify:** Diffs appear on mobile device
- [ ] **Verify:** Touch scrolling works
- [ ] **Verify:** Pinch-to-zoom works (if supported)
- [ ] **Verify:** Landscape orientation works

**Mobile Device Info:**
```
Device: _______________
OS: _______________
Browser: _______________
Screen size: _______________
Issues found: _______________
```

### Test 7.5: Mobile Device Performance
- [ ] Make changes to various file types
- [ ] **Verify:** Rendering is smooth
- [ ] **Verify:** No lag or stuttering
- [ ] **Verify:** Battery usage is reasonable

**Notes:**
```
Performance: _______________
Issues found: _______________
```

---

## Test Category 8: Poor Network Conditions

### Test 8.1: Simulate Network Latency (Chrome DevTools)
- [ ] Open mobile client in Chrome
- [ ] Open DevTools (F12) → Network tab
- [ ] Select "Slow 3G" from throttling dropdown
- [ ] Make changes in VS Code
- [ ] **Verify:** Diffs eventually appear
- [ ] **Verify:** No errors or crashes
- [ ] **Verify:** Connection remains stable

**Observed Latency:**
```
Time to receive diff: _____ seconds
Issues found: _______________
```

### Test 8.2: Simulate Packet Loss
- [ ] In Chrome DevTools Network tab
- [ ] Use "Offline" mode briefly, then back to "Online"
- [ ] Make changes during offline period
- [ ] **Verify:** Messages are queued
- [ ] **Verify:** Messages delivered when back online

**Notes:**
```
Queue behavior: _______________
Issues found: _______________
```

### Test 8.3: Intermittent Connection
- [ ] Toggle between "Online" and "Offline" multiple times
- [ ] Make changes during various states
- [ ] **Verify:** System recovers gracefully
- [ ] **Verify:** No duplicate messages
- [ ] **Verify:** No lost messages

**Notes:**
```
Issues found: _______________
```

---

## Summary Checklist

### Requirements Validation

**Requirement 1.1 (File Change Detection):**
- [ ] File changes detected correctly
- [ ] Debounce timing works (1000ms)

**Requirement 2.3 (Untracked Files):**
- [ ] Untracked files show as all additions
- [ ] No errors for untracked files

**Requirement 3.3 (Large Files):**
- [ ] Large files (>10,000 lines) handled
- [ ] Performance acceptable

**Requirement 5.5 (New Files Display):**
- [ ] New files display correctly on mobile
- [ ] All additions shown in green

**Requirement 6.3 (WebSocket Resilience):**
- [ ] Disconnections handled gracefully
- [ ] Reconnections work automatically
- [ ] Messages queued and delivered

### Overall System Health
- [ ] No crashes or exceptions
- [ ] Performance within acceptable limits
- [ ] Error messages are clear and helpful
- [ ] Logging is comprehensive
- [ ] User experience is smooth

---

## Issues Found

### Critical Issues
```
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________
```

### Minor Issues
```
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________
```

### Performance Issues
```
1. _______________________________________________
2. _______________________________________________
```

### Usability Issues
```
1. _______________________________________________
2. _______________________________________________
```

---

## Test Completion

**Date:** _______________
**Tester:** _______________
**Duration:** _______________
**Overall Result:** [ ] PASS [ ] FAIL [ ] PARTIAL

**Recommendation:**
```
_______________________________________________
_______________________________________________
_______________________________________________
```

---

## Next Steps

After completing this checklist:

1. [ ] Document all issues found
2. [ ] Create bug reports for critical issues
3. [ ] Update documentation based on findings
4. [ ] Run automated test suite to verify fixes
5. [ ] Mark task 17 as complete in tasks.md
