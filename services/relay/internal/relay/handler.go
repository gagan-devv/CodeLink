package relay

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gagan-devv/codelink/services/relay/internal/auth"
	"github.com/gagan-devv/codelink/services/relay/internal/session"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const (
	writeWait  = 10 * time.Second
	pongWait   = 75 * time.Second
	pingPeriod = 30 * time.Second
	maxMsgSize = 512 * 1024
)

type Handler struct {
	manager   *session.Manager
	validator *auth.Validator
	upgrader  websocket.Upgrader
}

func NewHandler(manager *session.Manager, validator *auth.Validator, allowedOrigins []string) *Handler {
	return &Handler{
		manager:   manager,
		validator: validator,
		upgrader: websocket.Upgrader{
			HandshakeTimeout:  5 * time.Second,
			ReadBufferSize:    32 * 1024,
			WriteBufferSize:   32 * 1024,
			EnableCompression: true,
			CheckOrigin:       BuildCheckOrigin(allowedOrigins),
		},
	}
}

// BuildCheckOrigin returns a CheckOrigin function for websocket.Upgrader.
func BuildCheckOrigin(allowedOrigins []string) func(r *http.Request) bool {
	return func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}
		for _, allowed := range allowedOrigins {
			if MatchOrigin(origin, allowed) {
				return true
			}
		}
		log.Printf("relay: rejected websocket origin: %s", origin)
		return false
	}
}

// MatchOrigin checks if candidate origin matches allowed origin.
// Exact match on scheme + host + port with no trailing slash, host compared case-insensitively.
func MatchOrigin(candidate, allowed string) bool {
	if candidate == "" || allowed == "" {
		return false
	}
	if strings.HasSuffix(candidate, "/") || strings.HasSuffix(allowed, "/") {
		return false
	}
	uCand, err := url.Parse(candidate)
	if err != nil || uCand.Scheme == "" || uCand.Host == "" || uCand.Path != "" || uCand.RawQuery != "" {
		return false
	}
	uAllow, err := url.Parse(allowed)
	if err != nil || uAllow.Scheme == "" || uAllow.Host == "" || uAllow.Path != "" || uAllow.RawQuery != "" {
		return false
	}
	if !strings.EqualFold(uCand.Scheme, uAllow.Scheme) {
		return false
	}
	if !strings.EqualFold(uCand.Host, uAllow.Host) {
		return false
	}
	return true
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tokenStr := r.URL.Query().Get("token")
	if tokenStr == "" {
		log.Println("relay: rejected websocket connection: reason=missing token")
		http.Error(w, "missing token", http.StatusUnauthorized)
		return
	}
	claims, err := h.validator.Validate(tokenStr)
	if err != nil {
		reason := "invalid token"
		if errors.Is(err, jwt.ErrTokenExpired) || strings.Contains(err.Error(), "token is expired") {
			reason = "expired"
		}
		log.Printf("relay: rejected websocket connection: reason=%s\n", reason)
		http.Error(w, reason, http.StatusUnauthorized)
		return
	}

	wsConn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("relay: rejected websocket connection: reason=upgrade failed")
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
	conn.CloseSend()
}

func (h *Handler) readPump(conn *session.Connection) {
	conn.Conn.SetReadLimit(maxMsgSize)
	conn.Conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.Conn.SetPongHandler(func(string) error {
		conn.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	limiter := NewRateLimiter(100, 200)

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
		if !limiter.Allow() {
			log.Printf("relay: rate limit exceeded [%s]", conn.ID)
			continue
		}
		if IsOversizedTerminalFrame(msg) {
			log.Printf("relay: dropped oversized terminal frame [%s] (%d bytes)", conn.ID, len(msg))
			continue
		}
		h.manager.Route(conn, msg)
	}
}

func (h *Handler) writePump(conn *session.Connection) {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		conn.Conn.Close()
	}()

	for {
		select {
		case msg, ok := <-conn.SendCh:
			conn.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				conn.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := conn.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				log.Printf("relay: write [%s]: %v", conn.ID, err)
				return
			}
		case <-ticker.C:
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
		V:       1,
		Type:    "HANDSHAKE_ACK",
		Payload: payload{ConnectionID: connID},
	})
	return b
}
