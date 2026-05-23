package session

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

var ErrHostAlreadyConnected = errors.New("session already has a host connection")

type internalSession struct {
	mu      sync.RWMutex
	ID      string
	Host    *Connection
	Clients map[string]*Connection
}

type Manager struct {
	mu       sync.RWMutex
	sessions map[string]*internalSession
}

func NewManager() *Manager {
	return &Manager{sessions: make(map[string]*internalSession)}
}

func (m *Manager) Register(conn *Connection) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	sess, ok := m.sessions[conn.SessionID]
	if !ok {
		sess = &internalSession{
			ID:      conn.SessionID,
			Clients: make(map[string]*Connection),
		}
		m.sessions[conn.SessionID] = sess
	}

	sess.mu.Lock()
	defer sess.mu.Unlock()

	switch conn.Role {
	case RoleHost:
		if sess.Host != nil {
			return ErrHostAlreadyConnected
		}
		sess.Host = conn
	case RoleClient:
		sess.Clients[conn.ID] = conn
	}
	return nil
}

func (m *Manager) Unregister(conn *Connection) {
	m.mu.Lock()
	defer m.mu.Unlock()

	sess, ok := m.sessions[conn.ID]
	if !ok {
		return
	}

	sess.mu.Lock()
	defer sess.mu.Unlock()

	switch conn.Role {
	case RoleHost:
		if sess.Host != nil && sess.Host.ID == conn.ID {
			sess.Host = nil
		}
	case RoleClient:
		delete(sess.Clients, conn.ID)
	}

	if sess.Host == nil && len(sess.Clients) == 0 {
		delete(m.sessions, conn.SessionID)
	}
}

func (m *Manager) Route(from *Connection, msg []byte) {
	m.mu.RLock()
	sess, ok := m.sessions[from.SessionID]
	m.mu.RUnlock()
	if !ok {
		return
	}

	sess.mu.RLock()
	defer sess.mu.RUnlock()

	switch from.Role {
	case RoleHost:
		for _, client := range sess.Clients {
			safeSend(client.SendCh, msg)
		}
	case RoleClient:
		if sess.Host != nil {
			safeSend(sess.Host.SendCh, msg)
		}
	}
}

func (m *Manager) WatchRevocations(ctx context.Context, rdb *redis.Client) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.checkRevocations(ctx, rdb)
		}
	}
}

func (m *Manager) checkRevocations(ctx context.Context, rdb *redis.Client) {
	m.mu.RLock()
	ids := make([]string, 0, len(m.sessions))
	for id := range m.sessions {
		ids = append(ids, id)
	}
	m.mu.RUnlock()

	for _, id := range ids {
		raw, err := rdb.Get(ctx, "session:"+id).Result()
		if err != nil {
			continue
		}
		var data struct {
			State string `json:"state"`
		}
		if json.Unmarshal([]byte(raw), &data) != nil {
			continue
		}
		if data.State == "revoked" {
			log.Printf("relay: session %s revoked - notifying connections", id)
			m.broadcast(id, revokedMsg)
		}
	}
}

func (m *Manager) broadcast(sessionID string, msg []byte) {
	m.mu.Lock()
	sess, ok := m.sessions[sessionID]
	m.mu.RUnlock()
	if !ok {
		return
	}

	sess.mu.RLock()
	defer sess.mu.RUnlock()

	if sess.Host != nil {
		safeSend(sess.Host.SendCh, msg)
	}
	for _, c := range sess.Clients {
		safeSend(c.SendCh, msg)
	}
}

func safeSend(ch chan []byte, msg []byte) {
	defer func () { recover() } ()
	select {
	case ch <- msg:
	default:

	}
}

var revokedMsg = func () []byte {
	b, _ := json.Marshal(map[string]interface{}{
		"v": 1,
		"type": "SESSION_REVOKED",
		"payload": map[string]string{"reason": "host_requested"},
	})
	return b
} ()