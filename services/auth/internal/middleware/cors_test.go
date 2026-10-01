package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gagan-devv/codelink/services/auth/internal/config"
	"github.com/gagan-devv/codelink/services/auth/internal/middleware"
	"github.com/gin-gonic/gin"
)

func setupTestRouter(allowed []string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.CORS(allowed))
	r.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})
	r.POST("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "created")
	})
	return r
}

func TestCORS_TableDriven(t *testing.T) {
	tests := []struct {
		name               string
		allowed            []string
		method             string
		origin             string
		expectedStatus     int
		expectedACAO       string
		expectVaryOrigin   bool
		checkPreflightHdrs bool
	}{
		{
			name:             "no Origin: no CORS headers, handler runs",
			allowed:          []string{"http://localhost:5173"},
			method:           http.MethodGet,
			origin:           "",
			expectedStatus:   http.StatusOK,
			expectedACAO:     "",
			expectVaryOrigin: false,
		},
		{
			name:             "allowed Origin GET: ACAO equals that origin, Vary: Origin present, no *",
			allowed:          []string{"http://localhost:5173"},
			method:           http.MethodGet,
			origin:           "http://localhost:5173",
			expectedStatus:   http.StatusOK,
			expectedACAO:     "http://localhost:5173",
			expectVaryOrigin: true,
		},
		{
			name:               "allowed Origin OPTIONS: 204, Allow-Methods, Allow-Headers and Max-Age present",
			allowed:            []string{"http://localhost:5173"},
			method:             http.MethodOptions,
			origin:             "http://localhost:5173",
			expectedStatus:     http.StatusNoContent,
			expectedACAO:       "http://localhost:5173",
			expectVaryOrigin:   true,
			checkPreflightHdrs: true,
		},
		{
			name:             "disallowed Origin OPTIONS: 403, no ACAO",
			allowed:          []string{"http://localhost:5173"},
			method:           http.MethodOptions,
			origin:           "https://evil.example",
			expectedStatus:   http.StatusForbidden,
			expectedACAO:     "",
			expectVaryOrigin: false,
		},
		{
			name:             "disallowed Origin GET: no ACAO",
			allowed:          []string{"http://localhost:5173"},
			method:           http.MethodGet,
			origin:           "https://evil.example",
			expectedStatus:   http.StatusOK,
			expectedACAO:     "",
			expectVaryOrigin: false,
		},
		{
			name:             "empty allowlist plus any Origin: no ACAO",
			allowed:          []string{},
			method:           http.MethodGet,
			origin:           "http://localhost:5173",
			expectedStatus:   http.StatusOK,
			expectedACAO:     "",
			expectVaryOrigin: false,
		},
		{
			name:             "empty allowlist plus any Origin OPTIONS: 403, no ACAO",
			allowed:          []string{},
			method:           http.MethodOptions,
			origin:           "http://localhost:5173",
			expectedStatus:   http.StatusForbidden,
			expectedACAO:     "",
			expectVaryOrigin: false,
		},
		{
			name:             "HTTP://LOCALHOST:5173 matches an allowed http://localhost:5173",
			allowed:          []string{"http://localhost:5173"},
			method:           http.MethodGet,
			origin:           "HTTP://LOCALHOST:5173",
			expectedStatus:   http.StatusOK,
			expectedACAO:     "HTTP://LOCALHOST:5173",
			expectVaryOrigin: true,
		},
		{
			name:             "http://localhost:5173/ does not match http://localhost:5173",
			allowed:          []string{"http://localhost:5173"},
			method:           http.MethodGet,
			origin:           "http://localhost:5173/",
			expectedStatus:   http.StatusOK,
			expectedACAO:     "",
			expectVaryOrigin: false,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			r := setupTestRouter(tc.allowed)
			req := httptest.NewRequest(tc.method, "/test", nil)
			if tc.origin != "" {
				req.Header.Set("Origin", tc.origin)
			}
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != tc.expectedStatus {
				t.Fatalf("expected status %d, got %d", tc.expectedStatus, w.Code)
			}

			acao := w.Header().Get("Access-Control-Allow-Origin")
			if acao != tc.expectedACAO {
				t.Errorf("expected ACAO '%s', got '%s'", tc.expectedACAO, acao)
			}
			if acao == "*" {
				t.Errorf("ACAO must never be wildcard '*'")
			}

			vary := w.Header().Get("Vary")
			if tc.expectVaryOrigin && !strings.Contains(vary, "Origin") {
				t.Errorf("expected Vary: Origin, got '%s'", vary)
			}
			if !tc.expectVaryOrigin && strings.Contains(vary, "Origin") {
				t.Errorf("did not expect Vary: Origin, got '%s'", vary)
			}

			if tc.checkPreflightHdrs {
				methods := w.Header().Get("Access-Control-Allow-Methods")
				if methods != "GET, POST, DELETE, OPTIONS" {
					t.Errorf("expected Allow-Methods, got '%s'", methods)
				}
				headers := w.Header().Get("Access-Control-Allow-Headers")
				if headers != "Content-Type, X-Laptop-Id, X-Laptop-Sig" {
					t.Errorf("expected Allow-Headers, got '%s'", headers)
				}
				maxAge := w.Header().Get("Access-Control-Max-Age")
				if maxAge != "600" {
					t.Errorf("expected Max-Age: 600, got '%s'", maxAge)
				}
			}
		})
	}
}

func TestCORS_Config(t *testing.T) {
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
			PostgresURL:      "postgres://localhost",
			RedisURL:         "redis://localhost",
			HMACSecret:       strings.Repeat("a", 32),
			JWTPrivateKeyPEM: "pem",
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
			PostgresURL:      "postgres://localhost",
			RedisURL:         "redis://localhost",
			HMACSecret:       strings.Repeat("a", 32),
			JWTPrivateKeyPEM: "pem",
			AllowedOrigins:   []string{"http://localhost:5173", "*"},
		}
		err := cfg.Validate()
		if err == nil {
			t.Fatal("expected error for wildcard '*', got nil")
		}
	})

	t.Run("trailing slash fails validate()", func(t *testing.T) {
		cfg := &config.Config{
			PostgresURL:      "postgres://localhost",
			RedisURL:         "redis://localhost",
			HMACSecret:       strings.Repeat("a", 32),
			JWTPrivateKeyPEM: "pem",
			AllowedOrigins:   []string{"http://localhost:5173/"},
		}
		err := cfg.Validate()
		if err == nil {
			t.Fatal("expected error for trailing slash, got nil")
		}
	})

	t.Run("valid origins pass validate()", func(t *testing.T) {
		cfg := &config.Config{
			PostgresURL:      "postgres://localhost",
			RedisURL:         "redis://localhost",
			HMACSecret:       strings.Repeat("a", 32),
			JWTPrivateKeyPEM: "pem",
			AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:19006"},
		}
		if err := cfg.Validate(); err != nil {
			t.Fatalf("unexpected validation error: %v", err)
		}
	})
}
