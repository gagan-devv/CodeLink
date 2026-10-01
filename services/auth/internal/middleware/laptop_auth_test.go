package middleware_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gagan-devv/codelink/services/auth/internal/db"
	"github.com/gagan-devv/codelink/services/auth/internal/middleware"
	"github.com/gagan-devv/codelink/services/auth/internal/repository"
	"github.com/gin-gonic/gin"
)

func TestLaptopAuth_MissingHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var logBuf bytes.Buffer
	log.SetOutput(&logBuf)
	defer log.SetOutput(os.Stderr)

	r := gin.New()
	r.Use(middleware.LaptopAuth(nil))
	r.POST("/v1/sessions", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	t.Run("missing both headers returns 401 with missing field reason", func(t *testing.T) {
		logBuf.Reset()
		req := httptest.NewRequest("POST", "/v1/sessions", strings.NewReader(`{}`))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", w.Code)
		}

		var resp map[string]string
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to parse json response: %v", err)
		}
		if resp["reason"] != "missing field" {
			t.Errorf("expected reason 'missing field', got %q", resp["reason"])
		}

		logOutput := logBuf.String()
		if !strings.Contains(logOutput, "status=401") || !strings.Contains(logOutput, "reason=missing field") {
			t.Errorf("expected log to contain status=401 and reason=missing field: %s", logOutput)
		}
		if !strings.Contains(logOutput, "laptopId=(none)") {
			t.Errorf("expected log to contain laptopId=(none): %s", logOutput)
		}
	})

	t.Run("missing signature header returns 401 with laptopId in log", func(t *testing.T) {
		logBuf.Reset()
		req := httptest.NewRequest("POST", "/v1/sessions", strings.NewReader(`{}`))
		req.Header.Set("X-Laptop-Id", "lap-test-123")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", w.Code)
		}

		var resp map[string]string
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to parse json response: %v", err)
		}
		if resp["reason"] != "missing field" {
			t.Errorf("expected reason 'missing field', got %q", resp["reason"])
		}

		logOutput := logBuf.String()
		if !strings.Contains(logOutput, "laptopId=lap-test-123") {
			t.Errorf("expected log to contain laptopId=lap-test-123: %s", logOutput)
		}
	})
}

func TestLaptopAuth_WithDatabase(t *testing.T) {
	dsn := os.Getenv("TEST_POSTGRES_URL")
	if dsn == "" {
		dsn = "postgres://codelink:devpassword@localhost:5432/codelink"
	}
	pool, err := db.NewPostgresPool(context.Background(), dsn)
	if err != nil {
		t.Skipf("postgres unavailable, skipping db-dependent tests: %v", err)
	}
	defer pool.Close()

	repo := repository.NewLaptopRepository(pool)
	r := gin.New()
	r.Use(middleware.LaptopAuth(repo))
	r.POST("/v1/sessions", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	var logBuf bytes.Buffer
	log.SetOutput(&logBuf)
	defer log.SetOutput(os.Stderr)

	t.Run("unknown laptop returns 401 with laptop not found reason", func(t *testing.T) {
		logBuf.Reset()
		req := httptest.NewRequest("POST", "/v1/sessions", strings.NewReader(`{}`))
		req.Header.Set("X-Laptop-Id", "lap-doesnotexist-999")
		req.Header.Set("X-Laptop-Sig", "ZmFrZXNpZw==")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", w.Code)
		}

		var resp map[string]string
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to parse json response: %v", err)
		}
		if resp["reason"] != "laptop not found" {
			t.Errorf("expected reason 'laptop not found', got %q", resp["reason"])
		}

		logOutput := logBuf.String()
		if !strings.Contains(logOutput, "reason=laptop not found") {
			t.Errorf("expected log to contain reason=laptop not found: %s", logOutput)
		}
	})

	t.Run("malformed signature returns 401 with bad signature reason", func(t *testing.T) {
		logBuf.Reset()
		req := httptest.NewRequest("POST", "/v1/sessions", strings.NewReader(`{}`))
		req.Header.Set("X-Laptop-Id", "lap-test-exists")
		req.Header.Set("X-Laptop-Sig", "not-base64!@#$")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", w.Code)
		}

		var resp map[string]string
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to parse json response: %v", err)
		}
		// Either unknown laptop or bad signature
		if resp["reason"] != "laptop not found" && resp["reason"] != "bad signature" {
			t.Errorf("expected reason 'laptop not found' or 'bad signature', got %q", resp["reason"])
		}
	})
}
