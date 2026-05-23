package relay

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gagan-devv/codelink/services/relay/internal/auth"
	"github.com/gagan-devv/codelink/services/relay/internal/session"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const (
	writeWait  = 10 * time.Second
	pongWait   = 75 * time.Second
	pingPeriod = 30 * time.Second
	maxMsgSize = 512 * 1024
)

var upgrader = websocket.Upgrader{
	HandshakeTimeout:  5 * time.Second,
	ReadBufferSize:    32 * 1024,
	WriteBufferSize:   32 * 1024,
	EnableCompression: true,
	CheckOrigin:       func(r *http.Request) bool { return true },
}

type Handler struct {
	manager   *session.Manager
	validator *auth.Validator
}

func NewHandler(manager *session.Manager, validator *auth.Validator) *Handler {
	return &Handler{manager: manager, validator: validator}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tokenStr := r.URL.Query().Get("token")
	if tokenStr == "" {
		http.Error(w, "missing token", http.StatusUnauthorized)
		return
	}
	claims, err := h.validator.Validate(tokenStr)
	if err != nil {
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}

	wsConn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("relay: upgrade error: %v", err)
		return
	}

	conn := &session.Connection{
		ID:        uuid.New().String(),
		Conn:      wsConn,
		SessionID: claims.SessionID,
		Role:      session.Role(claims.Role),
		SendCh:    make(chan []byte, 256),
	}

	if err := h.manager.Register(conn); err != nil {
		log.Printf("relay: register [%s]: %v", conn.ID, err)
		return
	}

	conn.SendCh <- buildHandshakeAck(conn.ID)

	go h.writePump(conn)
	h.readPump(conn)

	h.manager.Unregister(conn)
	close(conn.SendCh)	
}

func (h *Handler) readPump(conn *session.Connection) {
	conn.Conn.SetReadLimit(maxMsgSize)
	conn.Conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.Conn.SetPongHandler(func (string) error {
		conn.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, msg, err := conn.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err,
				websocket.CloseGoingAway,
				websocket.CloseNormalClosure,
			) {
				log.Printf("relay: read [%s]: %v", conn.ID, err)
			}
			return
		}
		h.manager.Route(conn, msg)
	}
}

func (h *Handler) writePump(conn *session.Connection) {
	ticker := time.NewTicker(pingPeriod)
	defer func ()  {
		ticker.Stop()
		conn.Conn.Close()
	} ()

	for {
		select {
		case msg, ok := <- conn.SendCh:
			conn.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				conn.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := conn.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				log.Printf("relay: write [%s]: %v", conn.ID, err)
				return
			}
		case <- ticker.C:
			conn.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := conn.Conn.WriteControl(
				websocket.PingMessage, nil, time.Now().Add(writeWait),
			); err != nil {
				return
			}
		}
	}
}

func buildHandshakeAck(connID string) []byte {
	type payload struct {
		ConnectionID string `json:"connectionID"`
	}
	type envelope struct {
		V       int     `json:"v"`
		Type    string  `json:"type"`
		Payload payload `json:"payload"`
	}
	b, _ := json.Marshal(envelope{
		V: 1,
		Type: "HANDSHAKE_ACK",
		Payload: payload{ConnectionID: connID},
	})
	return b
}
