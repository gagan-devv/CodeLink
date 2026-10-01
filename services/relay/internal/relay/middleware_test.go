package relay_test

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gagan-devv/codelink/services/relay/internal/auth"
	"github.com/gagan-devv/codelink/services/relay/internal/relay"
	"github.com/gagan-devv/codelink/services/relay/internal/session"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
)

func TestRelay_RequestLogger(t *testing.T) {
	t.Run("logs method, path, status, latency, requestId on single line", func(t *testing.T) {
		var logBuf bytes.Buffer
		log.SetOutput(&logBuf)
		defer log.SetOutput(os.Stderr)

		handler := relay.RequestLogger(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))

		req := httptest.NewRequest("GET", "/healthz", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}

		reqID := w.Header().Get("X-Request-Id")
		if reqID == "" {
			t.Fatal("expected X-Request-Id header")
		}

		logOutput := logBuf.String()
		if !strings.Contains(logOutput, "method=GET") {
			t.Errorf("expected log to contain method=GET: %s", logOutput)
		}
		if !strings.Contains(logOutput, "path=/healthz") {
			t.Errorf("expected log to contain path=/healthz: %s", logOutput)
		}
		if !strings.Contains(logOutput, "status=200") {
			t.Errorf("expected log to contain status=200: %s", logOutput)
		}
		if !strings.Contains(logOutput, "latency=") {
			t.Errorf("expected log to contain latency=: %s", logOutput)
		}
		if !strings.Contains(logOutput, "requestId="+reqID) {
			t.Errorf("expected log to contain requestId: %s", logOutput)
		}
		// Confirm single line
		trimmed := strings.TrimSpace(logOutput)
		if strings.Contains(trimmed, "\n") {
			t.Errorf("expected single line log, got multiple lines: %s", logOutput)
		}
	})
}

func TestRelay_RejectedWebSocketReasons(t *testing.T) {
	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate rsa key: %v", err)
	}
	pubBytes, err := x509.MarshalPKIXPublicKey(&privKey.PublicKey)
	if err != nil {
		t.Fatalf("failed to marshal public key: %v", err)
	}
	pubPEM := pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubBytes})

	validator, err := auth.NewValidator(string(pubPEM), "auth.codelink.io")
	if err != nil {
		t.Fatalf("failed to create validator: %v", err)
	}

	mgr := session.NewManager()
	h := relay.NewHandler(mgr, validator, []string{"http://localhost:5173"})
	srv := httptest.NewServer(h)
	defer srv.Close()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http")

	var logBuf bytes.Buffer
	log.SetOutput(&logBuf)
	defer log.SetOutput(os.Stderr)

	dialer := websocket.Dialer{}

	t.Run("missing token logs reason=missing token", func(t *testing.T) {
		logBuf.Reset()
		_, resp, err := dialer.Dial(wsURL, nil)
		if err == nil {
			t.Fatal("expected dial error")
		}
		if resp == nil || resp.StatusCode != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %v", resp)
		}

		logOutput := logBuf.String()
		if !strings.Contains(logOutput, "relay: rejected websocket connection: reason=missing token") {
			t.Errorf("expected missing token log, got: %s", logOutput)
		}
	})

	t.Run("invalid token logs reason=invalid token", func(t *testing.T) {
		logBuf.Reset()
		_, resp, err := dialer.Dial(wsURL+"?token=not-a-valid-jwt", nil)
		if err == nil {
			t.Fatal("expected dial error")
		}
		if resp == nil || resp.StatusCode != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %v", resp)
		}

		logOutput := logBuf.String()
		if !strings.Contains(logOutput, "relay: rejected websocket connection: reason=invalid token") {
			t.Errorf("expected invalid token log, got: %s", logOutput)
		}
	})

	t.Run("expired token logs reason=expired", func(t *testing.T) {
		logBuf.Reset()
		// Generate an expired token
		claims := &auth.Claims{
			RegisteredClaims: jwt.RegisteredClaims{
				Issuer:    "auth.codelink.io",
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
				IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
			},
			Role:      auth.RoleHost,
			SessionID: "sess-expired",
		}
		token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
		expiredTokenStr, err := token.SignedString(privKey)
		if err != nil {
			t.Fatalf("failed to sign expired token: %v", err)
		}

		_, resp, err := dialer.Dial(wsURL+"?token="+expiredTokenStr, nil)
		if err == nil {
			t.Fatal("expected dial error")
		}
		if resp == nil || resp.StatusCode != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %v", resp)
		}

		logOutput := logBuf.String()
		if !strings.Contains(logOutput, "relay: rejected websocket connection: reason=expired") {
			t.Errorf("expected expired reason log, got: %s", logOutput)
		}
		// Confirm the token is NOT logged in the output
		if strings.Contains(logOutput, expiredTokenStr) {
			t.Errorf("security violation: raw JWT token was logged: %s", logOutput)
		}
	})
}
