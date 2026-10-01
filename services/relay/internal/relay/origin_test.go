package relay_test

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gagan-devv/codelink/services/relay/internal/auth"
	"github.com/gagan-devv/codelink/services/relay/internal/config"
	"github.com/gagan-devv/codelink/services/relay/internal/relay"
	"github.com/gagan-devv/codelink/services/relay/internal/session"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
)

func generateTestJWT(t *testing.T, privKey *rsa.PrivateKey, issuer, sessionID string, role auth.Role) string {
	t.Helper()
	claims := &auth.Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuer,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
		Role:      role,
		SessionID: sessionID,
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	tokenStr, err := token.SignedString(privKey)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}
	return tokenStr
}

func setupTestRelay(t *testing.T, allowedOrigins []string) (*httptest.Server, *rsa.PrivateKey) {
	t.Helper()
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
	h := relay.NewHandler(mgr, validator, allowedOrigins)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/ws" {
			h.ServeHTTP(w, r)
			return
		}
		http.NotFound(w, r)
	}))

	return srv, privKey
}

func TestRelay_Origin_TableDriven(t *testing.T) {
	tests := []struct {
		name           string
		allowedOrigins []string
		includeToken   bool
		originHeader   string
		expectedStatus int
		expectUpgrade  bool
	}{
		{
			name:           "no Origin plus valid token: upgrade succeeds",
			allowedOrigins: []string{"http://localhost:5173"},
			includeToken:   true,
			originHeader:   "",
			expectedStatus: http.StatusSwitchingProtocols,
			expectUpgrade:  true,
		},
		{
			name:           "allowed Origin plus valid token: upgrade succeeds",
			allowedOrigins: []string{"http://localhost:5173"},
			includeToken:   true,
			originHeader:   "http://localhost:5173",
			expectedStatus: http.StatusSwitchingProtocols,
			expectUpgrade:  true,
		},
		{
			name:           "disallowed Origin plus valid token: HTTP 403, no upgrade",
			allowedOrigins: []string{"http://localhost:5173"},
			includeToken:   true,
			originHeader:   "https://evil.example",
			expectedStatus: http.StatusForbidden,
			expectUpgrade:  false,
		},
		{
			name:           "empty allowlist plus Origin header: 403",
			allowedOrigins: []string{},
			includeToken:   true,
			originHeader:   "http://localhost:5173",
			expectedStatus: http.StatusForbidden,
			expectUpgrade:  false,
		},
		{
			name:           "missing token plus allowed Origin: still 401",
			allowedOrigins: []string{"http://localhost:5173"},
			includeToken:   false,
			originHeader:   "http://localhost:5173",
			expectedStatus: http.StatusUnauthorized,
			expectUpgrade:  false,
		},
		{
			name:           "case insensitive host matches",
			allowedOrigins: []string{"http://localhost:5173"},
			includeToken:   true,
			originHeader:   "HTTP://LOCALHOST:5173",
			expectedStatus: http.StatusSwitchingProtocols,
			expectUpgrade:  true,
		},
		{
			name:           "trailing slash in origin rejected: 403",
			allowedOrigins: []string{"http://localhost:5173"},
			includeToken:   true,
			originHeader:   "http://localhost:5173/",
			expectedStatus: http.StatusForbidden,
			expectUpgrade:  false,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			srv, privKey := setupTestRelay(t, tc.allowedOrigins)
			defer srv.Close()

			wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws"
			if tc.includeToken {
				token := generateTestJWT(t, privKey, "auth.codelink.io", "sess-test", auth.RoleHost)
				wsURL += "?token=" + token
			}

			headers := make(http.Header)
			if tc.originHeader != "" {
				headers.Set("Origin", tc.originHeader)
			}

			dialer := websocket.Dialer{}
			conn, resp, err := dialer.Dial(wsURL, headers)
			if tc.expectUpgrade {
				if err != nil {
					t.Fatalf("expected successful upgrade, got error: %v (resp: %v)", err, resp)
				}
				if conn == nil {
					t.Fatal("expected non-nil connection")
				}
				defer conn.Close()
				if resp.StatusCode != http.StatusSwitchingProtocols {
					t.Errorf("expected status %d, got %d", http.StatusSwitchingProtocols, resp.StatusCode)
				}
			} else {
				if err == nil {
					conn.Close()
					t.Fatal("expected dial error, got nil")
				}
				if resp == nil {
					t.Fatalf("expected non-nil response for failure, got nil (err: %v)", err)
				}
				if resp.StatusCode != tc.expectedStatus {
					t.Errorf("expected status %d, got %d", tc.expectedStatus, resp.StatusCode)
				}
			}
		})
	}
}

func TestRelay_Config(t *testing.T) {
	t.Run("whitespace and empty entries are trimmed", func(t *testing.T) {
		raw := " http://localhost:5173 , , http://localhost:19006,   "
		origins, err := config.ParseAllowedOrigins(raw)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(origins) != 2 {
			t.Fatalf("expected 2 origins, got %d: %v", len(origins), origins)
		}
		if origins[0] != "http://localhost:5173" || origins[1] != "http://localhost:19006" {
			t.Errorf("unexpected parsed origins: %v", origins)
		}
	})

	t.Run("empty string gives empty slice", func(t *testing.T) {
		origins, err := config.ParseAllowedOrigins("   ")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(origins) != 0 {
			t.Errorf("expected 0 origins, got %d", len(origins))
		}
	})

	t.Run("* fails validate()", func(t *testing.T) {
		cfg := &config.Config{
			RedisURL:         "redis://localhost",
			AuthPublicKeyPEM: "pem",
			AllowedOrigins:   []string{"*"},
		}
		err := cfg.Validate()
		if err == nil {
			t.Fatal("expected error for wildcard '*', got nil")
		}
		if !strings.Contains(err.Error(), "wildcard") {
			t.Errorf("expected wildcard error message, got: %v", err)
		}
	})

	t.Run("wildcard entry alongside valid fails validate()", func(t *testing.T) {
		cfg := &config.Config{
			RedisURL:         "redis://localhost",
			AuthPublicKeyPEM: "pem",
			AllowedOrigins:   []string{"http://localhost:5173", "*"},
		}
		err := cfg.Validate()
		if err == nil {
			t.Fatal("expected error for wildcard '*', got nil")
		}
	})

	t.Run("trailing slash fails validate()", func(t *testing.T) {
		cfg := &config.Config{
			RedisURL:         "redis://localhost",
			AuthPublicKeyPEM: "pem",
			AllowedOrigins:   []string{"http://localhost:5173/"},
		}
		err := cfg.Validate()
		if err == nil {
			t.Fatal("expected error for trailing slash, got nil")
		}
	})

	t.Run("valid origins pass validate()", func(t *testing.T) {
		cfg := &config.Config{
			RedisURL:         "redis://localhost",
			AuthPublicKeyPEM: "pem",
			AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:19006"},
		}
		if err := cfg.Validate(); err != nil {
			t.Fatalf("unexpected validation error: %v", err)
		}
	})
}
