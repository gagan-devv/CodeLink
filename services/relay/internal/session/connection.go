package session

import (
	"sync"

	"github.com/gorilla/websocket"
)

type Role string

const (
	RoleHost   Role = "host"
	RoleClient Role = "client"
)

type Connection struct {
	ID        string
	Conn      *websocket.Conn
	SessionID string
	Role      Role
	SendCh    chan []byte
	closeOnce sync.Once
}

func (c *Connection) CloseSend() {
	c.closeOnce.Do(func() {
		close(c.SendCh)
	})
}
