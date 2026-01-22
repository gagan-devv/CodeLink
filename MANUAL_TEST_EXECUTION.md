# Manual Test Execution - Task 17

This document provides a streamlined execution guide for manual testing of the Git Integration & File Diffing feature.

## Quick Start

### Terminal Setup (3 terminals required)

**Terminal 1 - Relay Server:**
```bash
cd packages/relay-server
npm start
```

**Terminal 2 - Mobile Client:**
```bash
cd packages/mobile-client
npm run dev
```

**Terminal 3 - VS Code Extension:**
```bash
# In VS Code, press F5 to launch Extension Development Host
# Or use: code .
```

---

## Test Execution Plan

### Phase 1: Basic Functionality (15 minutes)

#### Test 1.1: TypeScript File
```bash
# In Extension Development Host, open:
packages/protocol/src/index.ts

# Make a change:
# Add: export const TEST_CONSTANT = 'manual-test';

# Wait 1 second
# ✓ Check mobile client shows diff
# ✓ Check orange dot appears (isDirty)
# ✓ Save file (Ctrl+S)
# ✓ Check orange dot disappears
```

**Expected Results:**
- Diff appears within 1-2 seconds
- Orange dot visible before save
- Orange dot disappears after save
- Debug Console shows pipeline < 2000ms

#### Test 1.2: JSON File
```bash
# Open: package.json
# Add a new script:
# "test:manual": "echo 'manual test'"

# Wait 1 second
# ✓ Check mobile client shows diff
# ✓ Verify JSON formatting preserved
```

#### Test 1.3: Markdown File
```bash
# Open: README.md
# Add a line: ## Manual Testing Section

# Wait 1 second
# ✓ Check mobile client shows diff
# ✓ Verify markdown syntax visible
```

---

### Phase 2: Untracked Files (10 minutes)

#### Test 2.1: Create Untracked File
```bash
# In Extension Development Host terminal:
echo "export const untracked = 'test';" > test-untracked.ts

# Open test-untracked.ts in VS Code
# ✓ Check entire file shows as green (additions)
# ✓ Check Debug Console: "File is not tracked by Git"
# ✓ No orange dot (file is saved)
```

**Expected Debug Console:**
```
[INFO] File changed: test-untracked.ts
[INFO] File is not tracked by Git, treating as new file
[PERF] Git operation: XXms (HEAD content: 0 bytes)
```

#### Test 2.2: Verify Git Status
```bash
git status
# Should show: test-untracked.ts as untracked
```

---

### Phase 3: Newly Added Files (5 minutes)

#### Test 3.1: Stage New File
```bash
# Create and stage:
echo "export const added = true;" > test-added.ts
git add test-added.ts

# Open test-added.ts in VS Code
# ✓ Check shows as all additions (green)
# ✓ No errors in Debug Console
```

---

### Phase 4: Large Files (10 minutes)

#### Test 4.1: Generate Large File
```bash
# Generate 10,500 line file:
node -e "
const lines = [];
for (let i = 0; i < 10500; i++) {
  lines.push(\`export const var\${i} = \${i}; // Line \${i}\`);
}
require('fs').writeFileSync('test-large.ts', lines.join('\n'));
"

# Commit it:
git add test-large.ts
git commit -m "Add large test file"

# Open test-large.ts in VS Code
# Go to line 5000 (Ctrl+G)
# Make a change
# Wait 1 second

# ✓ Check diff completes
# ✓ Check Debug Console performance:
#   - Git operation < 500ms
#   - Total pipeline < 2000ms
# ✓ Check mobile renders (may be slow)
```

**Performance Checklist:**
- [ ] Git operation: _____ ms (should be < 500ms)
- [ ] Diff generation: _____ ms (may exceed 200ms for large files)
- [ ] Total pipeline: _____ ms (should be < 2000ms)

---

### Phase 5: Binary Files (5 minutes)

#### Test 5.1: Binary File Handling
```bash
# Create a small binary file (if you have an image):
# cp /path/to/image.png test-image.png
# OR create a dummy binary:
echo -e "\x89PNG\x0D\x0A\x1A\x0A" > test-binary.bin

git add test-binary.bin
git commit -m "Add binary file"

# Open test-binary.bin in VS Code
# ✓ System should handle gracefully (no crash)
# ✓ Check Debug Console for appropriate handling
```

**Expected Behavior:**
- No crash or exception
- May show "Binary file" message or skip gracefully

---

### Phase 6: WebSocket Resilience (15 minutes)

#### Test 6.1: Disconnect Mobile Client
```bash
# 1. Verify mobile shows "Connected" (green)
# 2. Close mobile browser tab
# 3. Make changes in VS Code
# 4. Check Debug Console: should see message queuing
# 5. Reopen mobile client: http://localhost:5173
# 6. ✓ Mobile reconnects automatically
# 7. ✓ Queued messages delivered
```

**Debug Console Expected:**
```
[WebSocketClient] Message queued (connection lost)
[WebSocketClient] Queue size: 1
```

#### Test 6.2: Disconnect Relay Server
```bash
# 1. Stop relay server (Ctrl+C in Terminal 1)
# 2. ✓ Mobile shows "Disconnected" (red)
# 3. Make changes in VS Code
# 4. ✓ Messages queued in VS Code
# 5. Restart relay server: npm start
# 6. ✓ Both clients reconnect
# 7. ✓ Queued messages delivered
```

#### Test 6.3: Multiple Rapid Disconnections
```bash
# Disconnect/reconnect mobile 5 times rapidly
# ✓ System handles gracefully
# ✓ Connection stabilizes
# ✓ No memory leaks
```

---

### Phase 7: Mobile Device Testing (20 minutes)

#### Test 7.1: Find Your IP Address
```bash
# macOS/Linux:
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows:
ipconfig | findstr IPv4

# Note your IP: _______________
```

#### Test 7.2: Update Configuration
```bash
# Edit packages/mobile-client/src/App.tsx
# Change line 7:
# FROM: const RELAY_URL = 'http://localhost:8080';
# TO:   const RELAY_URL = 'http://YOUR_IP:8080';

# Rebuild mobile client:
cd packages/mobile-client
npm run build
npm run dev
```

#### Test 7.3: Start Network-Accessible Relay
```bash
# Terminal 1:
cd packages/relay-server
HOST=0.0.0.0 npm start
```

#### Test 7.4: Test on Mobile Device
```bash
# On mobile device browser, navigate to:
# http://YOUR_IP:5173

# ✓ Mobile client loads
# ✓ Shows "Connected"
# ✓ Make changes in VS Code
# ✓ Diffs appear on mobile
# ✓ Touch scrolling works
# ✓ Landscape orientation works
```

**Mobile Device Info:**
- Device: _______________
- OS: _______________
- Browser: _______________
- Screen size: _______________

---

### Phase 8: Poor Network Conditions (10 minutes)

#### Test 8.1: Simulate Slow Network
```bash
# In Chrome DevTools (F12):
# 1. Go to Network tab
# 2. Select "Slow 3G" from throttling dropdown
# 3. Make changes in VS Code
# 4. ✓ Diffs eventually appear
# 5. ✓ No errors or crashes
# 6. ✓ Connection remains stable
```

**Observed Latency:** _____ seconds

#### Test 8.2: Simulate Packet Loss
```bash
# In Chrome DevTools Network tab:
# 1. Toggle "Offline" mode briefly
# 2. Make changes during offline
# 3. Toggle back to "Online"
# 4. ✓ Messages queued
# 5. ✓ Messages delivered when online
```

---

## Verification Checklist

### Requirements Validation

- [ ] **Req 1.1**: File changes detected correctly
- [ ] **Req 2.3**: Untracked files show as all additions
- [ ] **Req 3.3**: Large files (>10,000 lines) handled
- [ ] **Req 5.5**: New files display correctly on mobile
- [ ] **Req 6.3**: WebSocket disconnections handled gracefully

### Performance Validation

- [ ] Debounce timing: 1000ms ± 50ms
- [ ] Git operations: < 500ms (typical files)
- [ ] Diff generation: < 200ms (files < 10,000 lines)
- [ ] Total pipeline: < 2000ms
- [ ] Mobile rendering: smooth and responsive

### Error Handling Validation

- [ ] No crashes with untracked files
- [ ] No crashes with binary files
- [ ] Graceful WebSocket disconnection handling
- [ ] Graceful reconnection
- [ ] Clear error messages in Debug Console

---

## Cleanup

```bash
# Remove test files:
rm -f test-untracked.ts test-added.ts test-large.ts test-binary.bin test-image.png

# Stop all processes:
# Terminal 1: Ctrl+C (relay server)
# Terminal 2: Ctrl+C (mobile client)
# Terminal 3: Close Extension Development Host window

# Restore mobile client config if changed:
# Edit packages/mobile-client/src/App.tsx
# Change back to: const RELAY_URL = 'http://localhost:8080';
```

---

## Issues Found

### Critical Issues
```
1. _______________________________________________
2. _______________________________________________
```

### Minor Issues
```
1. _______________________________________________
2. _______________________________________________
```

### Performance Issues
```
1. _______________________________________________
2. _______________________________________________
```

---

## Test Results Summary

**Date:** _______________
**Tester:** _______________
**Duration:** _______________
**Overall Result:** [ ] PASS [ ] FAIL [ ] PARTIAL

**Notes:**
```
_______________________________________________
_______________________________________________
_______________________________________________
```

---

## Next Steps

After completing manual testing:

1. [ ] Document all issues found
2. [ ] Run automated test suite: `npm test`
3. [ ] Mark task 17 as complete
4. [ ] Proceed to task 18 (Final checkpoint)

