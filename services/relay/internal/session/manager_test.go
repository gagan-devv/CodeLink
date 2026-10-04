package session

import (
	"strings"
	"testing"
	"time"
)

func TestManager_RegisterAndRoute(t *testing.T) {
	m := NewManager()

	hostConn := &Connection{
		ID:        "conn-host-1",
		SessionID: "sess-test-1",
		Role:      RoleHost,
		SendCh:    make(chan []byte, 10),
	}
	clientConn := &Connection{
		ID:        "conn-client-1",
		SessionID: "sess-test-1",
		Role:      RoleClient,
		SendCh:    make(chan []byte, 10),
	}

	if err := m.Register(hostConn); err != nil {
		t.Fatalf("failed to register host: %v", err)
	}
	if err := m.Register(clientConn); err != nil {
		t.Fatalf("failed to register client: %v", err)
	}

	// Host -> Client routing
	hostMsg := []byte("hello from host")
	m.Route(hostConn, hostMsg)

	select {
	case received := <-clientConn.SendCh:
		if string(received) != string(hostMsg) {
			t.Errorf("expected %s, got %s", hostMsg, received)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("timed out waiting for client to receive message from host")
	}

	// Client -> Host routing
	clientMsg := []byte("hello from client")
	m.Route(clientConn, clientMsg)

	select {
	case received := <-hostConn.SendCh:
		if string(received) != string(clientMsg) {
			t.Errorf("expected %s, got %s", clientMsg, received)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("timed out waiting for host to receive message from client")
	}
}

func TestManager_DuplicateHost(t *testing.T) {
	m := NewManager()

	host1 := &Connection{
		ID:        "conn-host-1",
		SessionID: "sess-test-dup",
		Role:      RoleHost,
		SendCh:    make(chan []byte, 10),
	}
	host2 := &Connection{
		ID:        "conn-host-2",
		SessionID: "sess-test-dup",
		Role:      RoleHost,
		SendCh:    make(chan []byte, 10),
	}

	if err := m.Register(host1); err != nil {
		t.Fatalf("failed to register first host: %v", err)
	}

	if err := m.Register(host2); err != ErrHostAlreadyConnected {
		t.Fatalf("expected ErrHostAlreadyConnected, got %v", err)
	}
}

func TestManager_UnregisterHost_AllowsReconnect(t *testing.T) {
	m := NewManager()

	host1 := &Connection{
		ID:        "conn-host-1",
		SessionID: "sess-test-reconnect",
		Role:      RoleHost,
		SendCh:    make(chan []byte, 10),
	}

	if err := m.Register(host1); err != nil {
		t.Fatalf("failed to register host: %v", err)
	}

	// Host disconnects
	m.Unregister(host1)

	// Reconnecting host should now succeed
	host2 := &Connection{
		ID:        "conn-host-2",
		SessionID: "sess-test-reconnect",
		Role:      RoleHost,
		SendCh:    make(chan []byte, 10),
	}
	if err := m.Register(host2); err != nil {
		t.Fatalf("reconnection failed after host unregistered: %v", err)
	}
}

func TestManager_UnregisterClient(t *testing.T) {
	m := NewManager()

	client := &Connection{
		ID:        "conn-client-1",
		SessionID: "sess-test-client",
		Role:      RoleClient,
		SendCh:    make(chan []byte, 10),
	}

	if err := m.Register(client); err != nil {
		t.Fatalf("failed to register client: %v", err)
	}

	m.Unregister(client)

	m.mu.RLock()
	_, exists := m.sessions["sess-test-client"]
	m.mu.RUnlock()

	if exists {
		t.Error("expected session to be deleted after last client unregistered")
	}
}

func TestManager_BroadcastAndClose_NoDeadlock(t *testing.T) {
	m := NewManager()

	host := &Connection{
		ID:        "conn-host-1",
		SessionID: "sess-test-revocation",
		Role:      RoleHost,
		SendCh:    make(chan []byte, 10),
	}
	client := &Connection{
		ID:        "conn-client-1",
		SessionID: "sess-test-revocation",
		Role:      RoleClient,
		SendCh:    make(chan []byte, 10),
	}

	_ = m.Register(host)
	_ = m.Register(client)

	revMsg := []byte("revoked")
	// Must not deadlock
	done := make(chan struct{})
	go func() {
		m.broadcastAndClose("sess-test-revocation", revMsg)
		close(done)
	}()

	select {
	case <-done:
		// Success
	case <-time.After(1 * time.Second):
		t.Fatal("deadlock detected in broadcastAndClose")
	}

	// Verify both connections received message
	select {
	case msg := <-host.SendCh:
		if string(msg) != string(revMsg) {
			t.Errorf("expected %s, got %s", revMsg, msg)
		}
	default:
		t.Error("host did not receive revocation message")
	}

	select {
	case msg := <-client.SendCh:
		if string(msg) != string(revMsg) {
			t.Errorf("expected %s, got %s", revMsg, msg)
		}
	default:
		t.Error("client did not receive revocation message")
	}

	// Verify session was evicted
	m.mu.RLock()
	_, exists := m.sessions["sess-test-revocation"]
	m.mu.RUnlock()
	if exists {
		t.Error("expected revoked session to be evicted from sessions map")
	}

	// Verify manager mutex is still operational (not locked or corrupted)
	newHost := &Connection{
		ID:        "conn-host-new",
		SessionID: "sess-new",
		Role:      RoleHost,
		SendCh:    make(chan []byte, 10),
	}
	if err := m.Register(newHost); err != nil {
		t.Fatalf("failed to register new session after revocation: %v", err)
	}
}

func TestManager_BroadcastAndClose_DrainsThenCloses(t *testing.T) {
	m := NewManager()

	host := &Connection{
		ID:        "conn-host-1",
		SessionID: "sess-drain",
		Role:      RoleHost,
		SendCh:    make(chan []byte, 10),
	}
	client := &Connection{
		ID:        "conn-client-1",
		SessionID: "sess-drain",
		Role:      RoleClient,
		SendCh:    make(chan []byte, 10),
	}

	_ = m.Register(host)
	_ = m.Register(client)

	revMsg := []byte("revoked")
	m.broadcastAndClose("sess-drain", revMsg)

	// Read host SendCh: first read gets message, second returns ok == false
	msg, ok := <-host.SendCh
	if !ok || string(msg) != string(revMsg) {
		t.Fatalf("expected revoke message on host, got %s (ok=%v)", msg, ok)
	}
	_, ok = <-host.SendCh
	if ok {
		t.Fatal("expected host SendCh to be closed after revoke message")
	}

	// Read client SendCh: first read gets message, second returns ok == false
	msg, ok = <-client.SendCh
	if !ok || string(msg) != string(revMsg) {
		t.Fatalf("expected revoke message on client, got %s (ok=%v)", msg, ok)
	}
	_, ok = <-client.SendCh
	if ok {
		t.Fatal("expected client SendCh to be closed after revoke message")
	}
}

func TestConnection_CloseSend_Idempotent(t *testing.T) {
	conn := &Connection{
		ID:        "conn-1",
		SessionID: "sess-1",
		Role:      RoleHost,
		SendCh:    make(chan []byte, 10),
	}

	conn.CloseSend()
	// Second call should not panic
	conn.CloseSend()

	// Verify channel is closed
	_, ok := <-conn.SendCh
	if ok {
		t.Error("expected channel to be closed")
	}
}

func TestManager_BroadcastAndClose_HandlerExitPath(t *testing.T) {
	m := NewManager()

	host := &Connection{
		ID:        "conn-host-1",
		SessionID: "sess-exit",
		Role:      RoleHost,
		SendCh:    make(chan []byte, 10),
	}
	client := &Connection{
		ID:        "conn-client-1",
		SessionID: "sess-exit",
		Role:      RoleClient,
		SendCh:    make(chan []byte, 10),
	}

	_ = m.Register(host)
	_ = m.Register(client)

	revMsg := []byte("revoked")
	m.broadcastAndClose("sess-exit", revMsg)

	// Handler exit path for host: Unregister followed by CloseSend
	m.Unregister(host)
	host.CloseSend()

	// Handler exit path for client: Unregister followed by CloseSend
	m.Unregister(client)
	client.CloseSend()

	// New host can register for the same session ID without error
	newHost := &Connection{
		ID:        "conn-host-2",
		SessionID: "sess-exit",
		Role:      RoleHost,
		SendCh:    make(chan []byte, 10),
	}
	if err := m.Register(newHost); err != nil {
		t.Fatalf("failed to register new host for same session ID after revocation: %v", err)
	}
}

func TestManager_RouteTerminalFramesBothWays(t *testing.T) {
	m := NewManager()

	host := &Connection{
		ID:        "conn-host",
		SessionID: "sess-term-1",
		Role:      RoleHost,
		SendCh:    make(chan []byte, 10),
	}
	companion := &Connection{
		ID:        "conn-companion",
		SessionID: "sess-term-1",
		Role:      RoleCompanion,
		SendCh:    make(chan []byte, 10),
	}
	client := &Connection{
		ID:        "conn-client",
		SessionID: "sess-term-1",
		Role:      RoleClient,
		SendCh:    make(chan []byte, 10),
	}

	if err := m.Register(host); err != nil {
		t.Fatalf("register host: %v", err)
	}
	if err := m.Register(companion); err != nil {
		t.Fatalf("register companion: %v", err)
	}
	if err := m.Register(client); err != nil {
		t.Fatalf("register client: %v", err)
	}

	// 1. Client -> Companion: TERM_INPUT must reach companion and NOT host
	termInput := []byte(`{"v":1,"type":"TERM_INPUT","payload":{"sessionId":"t1","data":"echo hello\n"}}`)
	m.Route(client, termInput)

	select {
	case received := <-companion.SendCh:
		if string(received) != string(termInput) {
			t.Errorf("companion expected %s, got %s", termInput, received)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("timed out waiting for companion to receive TERM_INPUT from client")
	}

	select {
	case unexpected := <-host.SendCh:
		t.Fatalf("host unexpectedly received terminal frame: %s", unexpected)
	default:
		// expected: host channel empty
	}

	// 2. Companion -> Client: TERM_OUTPUT must reach client and NOT host
	termOutput := []byte(`{"v":1,"type":"TERM_OUTPUT","payload":{"sessionId":"t1","data":"hello\n"}}`)
	m.Route(companion, termOutput)

	select {
	case received := <-client.SendCh:
		if string(received) != string(termOutput) {
			t.Errorf("client expected %s, got %s", termOutput, received)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("timed out waiting for client to receive TERM_OUTPUT from companion")
	}

	select {
	case unexpected := <-host.SendCh:
		t.Fatalf("host unexpectedly received companion frame: %s", unexpected)
	default:
		// expected: host channel empty
	}

	// 3. Client -> Host: Non-terminal frame (e.g. INJECT_PROMPT) must reach host and NOT companion
	promptMsg := []byte(`{"v":1,"type":"INJECT_PROMPT","payload":{"prompt":"write code"}}`)
	m.Route(client, promptMsg)

	select {
	case received := <-host.SendCh:
		if string(received) != string(promptMsg) {
			t.Errorf("host expected %s, got %s", promptMsg, received)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("timed out waiting for host to receive non-terminal message from client")
	}

	select {
	case unexpected := <-companion.SendCh:
		t.Fatalf("companion unexpectedly received non-terminal frame: %s", unexpected)
	default:
		// expected: companion channel empty
	}
}

func TestManager_RouteTerminalFrame_NoCompanionConnected(t *testing.T) {
	m := NewManager()

	host := &Connection{
		ID:        "conn-host",
		SessionID: "sess-no-comp",
		Role:      RoleHost,
		SendCh:    make(chan []byte, 10),
	}
	client := &Connection{
		ID:        "conn-client",
		SessionID: "sess-no-comp",
		Role:      RoleClient,
		SendCh:    make(chan []byte, 10),
	}

	_ = m.Register(host)
	_ = m.Register(client)

	// Client sends terminal message when no companion is present
	termInput := []byte(`{"v":1,"type":"TERM_INPUT","payload":{"data":"whoami\n"}}`)
	m.Route(client, termInput)

	// Client should immediately receive a TERM_ERROR frame
	select {
	case errFrame := <-client.SendCh:
		msgType, err := ParseMessageType(errFrame)
		if err != nil {
			t.Fatalf("failed to parse error frame: %v", err)
		}
		if msgType != "TERM_ERROR" {
			t.Errorf("expected TERM_ERROR frame, got %s", msgType)
		}
		if !strings.Contains(string(errFrame), "COMPANION_NOT_CONNECTED") {
			t.Errorf("expected error payload to contain COMPANION_NOT_CONNECTED, got %s", errFrame)
		}
		if !strings.Contains(string(errFrame), `"message"`) || !strings.Contains(string(errFrame), `"error"`) {
			t.Errorf("expected error payload to contain both message and error fields, got %s", errFrame)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("timed out waiting for client to receive error frame when companion not connected")
	}

	// Host should receive nothing
	select {
	case unexpected := <-host.SendCh:
		t.Fatalf("host unexpectedly received frame: %s", unexpected)
	default:
		// expected
	}
}

func TestManager_DuplicateCompanion(t *testing.T) {
	m := NewManager()

	comp1 := &Connection{
		ID:        "conn-comp-1",
		SessionID: "sess-dup-comp",
		Role:      RoleCompanion,
		SendCh:    make(chan []byte, 10),
	}
	comp2 := &Connection{
		ID:        "conn-comp-2",
		SessionID: "sess-dup-comp",
		Role:      RoleCompanion,
		SendCh:    make(chan []byte, 10),
	}

	if err := m.Register(comp1); err != nil {
		t.Fatalf("register first companion: %v", err)
	}
	if err := m.Register(comp2); err != ErrCompanionAlreadyConnected {
		t.Fatalf("expected ErrCompanionAlreadyConnected, got %v", err)
	}
}

func TestManager_CompanionUnregisterAndCleanup(t *testing.T) {
	m := NewManager()

	host := &Connection{
		ID:        "conn-host",
		SessionID: "sess-cleanup",
		Role:      RoleHost,
		SendCh:    make(chan []byte, 10),
	}
	companion := &Connection{
		ID:        "conn-companion",
		SessionID: "sess-cleanup",
		Role:      RoleCompanion,
		SendCh:    make(chan []byte, 10),
	}
	client := &Connection{
		ID:        "conn-client",
		SessionID: "sess-cleanup",
		Role:      RoleClient,
		SendCh:    make(chan []byte, 10),
	}

	_ = m.Register(host)
	_ = m.Register(companion)
	_ = m.Register(client)

	m.Unregister(host)
	m.mu.RLock()
	if _, exists := m.sessions["sess-cleanup"]; !exists {
		t.Error("expected session to remain active with companion and client")
	}
	m.mu.RUnlock()

	m.Unregister(client)
	m.mu.RLock()
	if _, exists := m.sessions["sess-cleanup"]; !exists {
		t.Error("expected session to remain active with companion alone")
	}
	m.mu.RUnlock()

	m.Unregister(companion)
	m.mu.RLock()
	if _, exists := m.sessions["sess-cleanup"]; exists {
		t.Error("expected session to be cleaned up after all participants unregistered")
	}
	m.mu.RUnlock()
}
