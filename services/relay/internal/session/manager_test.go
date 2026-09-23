package session

import (
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
