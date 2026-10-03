package handlers_test

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gagan-devv/codelink/services/auth/internal/config"
	authcrypto "github.com/gagan-devv/codelink/services/auth/internal/crypto"
	"github.com/gagan-devv/codelink/services/auth/internal/domain"
	"github.com/gagan-devv/codelink/services/auth/internal/handlers"
	"github.com/gagan-devv/codelink/services/auth/internal/middleware"
	"github.com/gagan-devv/codelink/services/auth/internal/repository"
	"github.com/gin-gonic/gin"
)

type mockSessionStore struct {
	sessions map[string]*repository.RedisSession
}

func (m *mockSessionStore) GetRedisSession(ctx context.Context, sessionID string) (*repository.RedisSession, error) {
	if s, ok := m.sessions[sessionID]; ok {
		return s, nil
	}
	return nil, errors.New("session not found")
}

func (m *mockSessionStore) Create(ctx context.Context, s *domain.Session, challenge string) error {
	return nil
}

func (m *mockSessionStore) Activate(ctx context.Context, sessionID, mobileDeviceID, laptopID, laptopToken, mobileToken string) error {
	return nil
}

func (m *mockSessionStore) Revoke(ctx context.Context, sessionID string) error {
	return nil
}

func generateRSAKeys(t *testing.T) (privPEM, pubPEM string, privKey *rsa.PrivateKey) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate rsa key: %v", err)
	}
	privDER := x509.MarshalPKCS1PrivateKey(key)
	privPEM = string(pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: privDER}))

	pubDER, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	if err != nil {
		t.Fatalf("marshal pub key: %v", err)
	}
	pubPEM = string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubDER}))
	return privPEM, pubPEM, key
}

func TestCompanionToken_AuthenticationAndAuthorization(t *testing.T) {
	gin.SetMode(gin.TestMode)

	privPEM, pubPEM, _ := generateRSAKeys(t)
	signer, err := authcrypto.NewJWTSigner(privPEM, "auth.codelink.io")
	if err != nil {
		t.Fatalf("NewJWTSigner: %v", err)
	}
	validator, err := authcrypto.NewJWTValidator(pubPEM, "auth.codelink.io")
	if err != nil {
		t.Fatalf("NewJWTValidator: %v", err)
	}

	sessionID := "sess-comp-1"
	laptopID := "lap-owner-1"

	store := &mockSessionStore{
		sessions: map[string]*repository.RedisSession{
			sessionID: {
				State:          string(domain.SessionActive),
				LaptopID:       laptopID,
				MobileDeviceID: "mob-1",
				LaptopToken:    "lap-tok",
				MobileToken:    "mob-tok",
			},
			"sess-pending": {
				State:    string(domain.SessionPending),
				LaptopID: laptopID,
			},
			"sess-revoked": {
				State:    string(domain.SessionRevoked),
				LaptopID: laptopID,
			},
		},
	}

	cfg := &config.Config{
		RelayWSS: "wss://relay.test.codelink.io/ws",
	}

	handler := handlers.NewSessionHandler(store, signer, cfg)

	t.Run("negative: unauthenticated request (no LaptopAuth headers) is rejected with 401", func(t *testing.T) {
		r := gin.New()
		r.Use(middleware.LaptopAuth(nil))
		r.POST("/v1/sessions/:id/companion-token", handler.CompanionToken)

		req := httptest.NewRequest("POST", "/v1/sessions/"+sessionID+"/companion-token", bytes.NewReader([]byte("{}")))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 for unauthenticated request, got %d", w.Code)
		}
	})

	t.Run("negative: client-role bearer token cannot bypass LaptopAuth", func(t *testing.T) {
		clientToken, _ := signer.Issue(authcrypto.Claims{
			Role:           authcrypto.RoleClient,
			SessionID:      sessionID,
			MobileDeviceID: "mob-1",
		}, 1*time.Hour)

		r := gin.New()
		r.Use(middleware.LaptopAuth(nil))
		r.POST("/v1/sessions/:id/companion-token", handler.CompanionToken)

		req := httptest.NewRequest("POST", "/v1/sessions/"+sessionID+"/companion-token", bytes.NewReader([]byte("{}")))
		req.Header.Set("Authorization", "Bearer "+clientToken)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 when attempting to use client bearer token on companion-token endpoint, got %d", w.Code)
		}
	})

	t.Run("negative: laptopId mismatch returns 403", func(t *testing.T) {
		r := gin.New()
		r.POST("/v1/sessions/:id/companion-token", func(c *gin.Context) {
			c.Set("laptopID", "different-laptop-999")
			handler.CompanionToken(c)
		})

		req := httptest.NewRequest("POST", "/v1/sessions/"+sessionID+"/companion-token", bytes.NewReader([]byte("{}")))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusForbidden {
			t.Errorf("expected 403 for mismatched laptopId, got %d", w.Code)
		}
	})

	t.Run("negative: pending session returns 409 Conflict", func(t *testing.T) {
		r := gin.New()
		r.POST("/v1/sessions/:id/companion-token", func(c *gin.Context) {
			c.Set("laptopID", laptopID)
			handler.CompanionToken(c)
		})

		req := httptest.NewRequest("POST", "/v1/sessions/sess-pending/companion-token", bytes.NewReader([]byte("{}")))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusConflict {
			t.Errorf("expected 409 for non-active session, got %d", w.Code)
		}
	})

	t.Run("negative: revoked session returns 409 Conflict", func(t *testing.T) {
		r := gin.New()
		r.POST("/v1/sessions/:id/companion-token", func(c *gin.Context) {
			c.Set("laptopID", laptopID)
			handler.CompanionToken(c)
		})

		req := httptest.NewRequest("POST", "/v1/sessions/sess-revoked/companion-token", bytes.NewReader([]byte("{}")))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusConflict {
			t.Errorf("expected 409 for revoked session, got %d", w.Code)
		}
	})

	t.Run("negative: nonexistent session returns 404", func(t *testing.T) {
		r := gin.New()
		r.POST("/v1/sessions/:id/companion-token", func(c *gin.Context) {
			c.Set("laptopID", laptopID)
			handler.CompanionToken(c)
		})

		req := httptest.NewRequest("POST", "/v1/sessions/nonexistent/companion-token", bytes.NewReader([]byte("{}")))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404 for nonexistent session, got %d", w.Code)
		}
	})

	t.Run("positive: authenticated laptop receives valid role=companion JWT", func(t *testing.T) {
		r := gin.New()
		r.POST("/v1/sessions/:id/companion-token", func(c *gin.Context) {
			c.Set("laptopID", laptopID)
			handler.CompanionToken(c)
		})

		req := httptest.NewRequest("POST", "/v1/sessions/"+sessionID+"/companion-token", bytes.NewReader([]byte("{}")))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}

		var resp struct {
			CompanionToken string `json:"companionToken"`
			SessionID      string `json:"sessionId"`
			RelayWSS       string `json:"relayWss"`
			ExpiresAt      int64  `json:"expiresAt"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("parse response: %v", err)
		}

		if resp.SessionID != sessionID {
			t.Errorf("expected sessionId %q, got %q", sessionID, resp.SessionID)
		}
		if resp.CompanionToken == "" {
			t.Fatal("expected non-empty companionToken")
		}

		claims, err := validator.Validate(resp.CompanionToken)
		if err != nil {
			t.Fatalf("validate issued companion token: %v", err)
		}

		if claims.Role != authcrypto.RoleCompanion {
			t.Errorf("expected role %q, got %q", authcrypto.RoleCompanion, claims.Role)
		}
		if claims.SessionID != sessionID {
			t.Errorf("expected claim sessionId %q, got %q", sessionID, claims.SessionID)
		}
		if claims.LaptopID != laptopID {
			t.Errorf("expected claim laptopId %q, got %q", laptopID, claims.LaptopID)
		}

		// Ensure short-lived (1 hour TTL: ~3600 seconds)
		expiresIn := time.Until(claims.ExpiresAt.Time)
		if expiresIn < 55*time.Minute || expiresIn > 65*time.Minute {
			t.Errorf("expected token to expire in ~1h, got %v", expiresIn)
		}
	})

	t.Run("rate limiting: enforces max 10 requests per window", func(t *testing.T) {
		rateLimitSessionID := "sess-ratelimit"
		store.sessions[rateLimitSessionID] = &repository.RedisSession{
			State:    string(domain.SessionActive),
			LaptopID: laptopID,
		}

		r := gin.New()
		r.POST("/v1/sessions/:id/companion-token", func(c *gin.Context) {
			c.Set("laptopID", laptopID)
			handler.CompanionToken(c)
		})

		// Make 10 requests: all should succeed
		for i := 1; i <= 10; i++ {
			req := httptest.NewRequest("POST", "/v1/sessions/"+rateLimitSessionID+"/companion-token", bytes.NewReader([]byte("{}")))
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != http.StatusOK {
				t.Fatalf("request %d expected 200, got %d", i, w.Code)
			}
		}

		// 11th request should be rate-limited with 429
		req11 := httptest.NewRequest("POST", "/v1/sessions/"+rateLimitSessionID+"/companion-token", bytes.NewReader([]byte("{}")))
		w11 := httptest.NewRecorder()
		r.ServeHTTP(w11, req11)
		if w11.Code != http.StatusTooManyRequests {
			t.Errorf("expected 429 Too Many Requests on 11th call, got %d", w11.Code)
		}
	})
}
