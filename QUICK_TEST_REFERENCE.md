# Quick Test Reference Card

## 🚀 Quick Start (3 Commands)

```bash
# Terminal 1 - Relay Server
cd packages/relay-server && npm start

# Terminal 2 - Mobile Client  
cd packages/mobile-client && npm run dev

# Terminal 3 - VS Code Extension
# Press F5 in VS Code
```

**Mobile Client URL:** http://localhost:5173

---

## 📋 Quick Test Checklist

### Basic Test (5 minutes)
```bash
# 1. Generate test files
./scripts/generate-test-files.sh

# 2. Open test-untracked.ts in Extension Development Host
# 3. Make a change, wait 1 second
# 4. Check mobile client shows diff
# 5. Verify orange dot (isDirty)
# 6. Save file (Ctrl+S)
# 7. Verify orange dot disappears
```

### Performance Check
Look for in VS Code Debug Console:
```
[PERF] Total pipeline: XXXms
```
✅ Should be < 2000ms (typically 100-500ms)

### Connection Check
Mobile client should show:
- 🟢 **Connected** (green) = Good
- 🔴 **Disconnected** (red) = Problem

---

## 🧪 Test Scenarios

### 1. Untracked File
```bash
# File shows as all green (additions)
# No orange dot
# Debug Console: "File is not tracked by Git"
```

### 2. Large File (10,500 lines)
```bash
# Open test-large.ts
# Change line 5000
# Check performance < 2000ms
```

### 3. WebSocket Disconnect
```bash
# Close mobile browser tab
# Make changes in VS Code
# Reopen mobile tab
# Messages should be delivered
```

---

## 🔍 Debug Console Messages

### Good Messages ✅
```
[INFO] File changed: filename.ts
[PERF] Git operation: 50ms
[PERF] Diff generation: 30ms
[PERF] WebSocket send: 10ms
[PERF] Total pipeline: 100ms
```

### Warning Messages ⚠️
```
[WARN] Pipeline exceeded 2000ms threshold
[WARN] File is not tracked by Git
```

### Error Messages ❌
```
[ERROR] Failed to fetch HEAD version
[ERROR] Failed to generate diff
[ERROR] Failed to send message
```

---

## 📊 Performance Targets

| Metric | Target | Typical |
|--------|--------|---------|
| Debounce | 1000ms | 1000ms |
| Git op | < 500ms | 50-200ms |
| Diff gen | < 200ms | 20-100ms |
| **Total** | **< 2000ms** | **100-500ms** |

---

## 🧹 Cleanup

```bash
# Remove test files
./scripts/cleanup-test-files.sh

# Stop processes
# Ctrl+C in all terminals
```

---

## 📚 Full Documentation

- **MANUAL_TEST_EXECUTION.md** - Detailed testing procedures
- **MANUAL_TEST_CHECKLIST.md** - Complete checklist
- **MANUAL_TESTING_GUIDE.md** - Comprehensive guide
- **MANUAL_TEST_SUMMARY.md** - Overview and status

---

## 🆘 Quick Troubleshooting

### Mobile shows "Disconnected"
```bash
# Check relay server is running
# Check URL: http://localhost:8080
```

### No diff appears
```bash
# Check VS Code Debug Console for errors
# Verify file is in workspace
# Wait full 1 second after typing
```

### Extension not activating
```bash
# Rebuild: npm run build
# Restart: Close Extension Development Host, press F5
```

---

## ✅ Success Criteria

- [x] Diffs appear within 1-2 seconds
- [x] Orange dot for unsaved files
- [x] Untracked files show as additions
- [x] Large files work (may be slower)
- [x] Reconnection works automatically
- [x] No crashes or errors

---

**Ready to test?** Run: `./scripts/generate-test-files.sh`
