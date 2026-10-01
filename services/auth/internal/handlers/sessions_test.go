package handlers_test

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gagan-devv/codelink/services/auth/internal/config"
	"github.com/gagan-devv/codelink/services/auth/internal/handlers"
	"github.com/gin-gonic/gin"
)

func TestSessionHandler_Create_ValidationAndErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := handlers.NewSessionHandler(nil, nil, &config.Config{
		HMACSecret: "test-secret",
		RelayWSS:   "ws://localhost:8082/ws",
	})

	r := gin.New()
	r.POST("/v1/sessions", func(c *gin.Context) {
		// Mock authenticated laptopID from LaptopAuth middleware
		c.Set("laptopID", "lap-auth-123")
		handler.Create(c)
	})

	var logBuf bytes.Buffer
	log.SetOutput(&logBuf)
	defer log.SetOutput(os.Stderr)

	t.Run("missing fields returns 400 with missing field reason", func(t *testing.T) {
		logBuf.Reset()
		req := httptest.NewRequest("POST", "/v1/sessions", strings.NewReader(`{}`))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}

		var resp map[string]string
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to parse json response: %v", err)
		}
		if resp["reason"] != "missing field" {
			t.Errorf("expected reason 'missing field', got %q", resp["reason"])
		}

		logOutput := logBuf.String()
		if !strings.Contains(logOutput, "status=400") || !strings.Contains(logOutput, "reason=missing field") {
			t.Errorf("expected log to contain status=400 and reason=missing field: %s", logOutput)
		}
		if !strings.Contains(logOutput, "laptopId=lap-auth-123") {
			t.Errorf("expected log to contain laptopId=lap-auth-123: %s", logOutput)
		}
	})

	t.Run("laptopId mismatch returns 403 with laptopId mismatch reason", func(t *testing.T) {
		logBuf.Reset()
		body, _ := json.Marshal(map[string]interface{}{
			"laptopId":    "lap-other-456",
			"requestedAt": time.Now().UnixMilli(),
		})
		req := httptest.NewRequest("POST", "/v1/sessions", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d", w.Code)
		}

		var resp map[string]string
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to parse json response: %v", err)
		}
		if resp["reason"] != "laptopId mismatch" {
			t.Errorf("expected reason 'laptopId mismatch', got %q", resp["reason"])
		}

		logOutput := logBuf.String()
		if !strings.Contains(logOutput, "status=403") || !strings.Contains(logOutput, "reason=laptopId mismatch") {
			t.Errorf("expected log to contain status=403 and reason=laptopId mismatch: %s", logOutput)
		}
	})

	t.Run("expired timestamp returns 401 with expired timestamp reason", func(t *testing.T) {
		logBuf.Reset()
		body, _ := json.Marshal(map[string]interface{}{
			"laptopId":    "lap-auth-123",
			"requestedAt": time.Now().Add(-10 * time.Minute).UnixMilli(),
		})
		req := httptest.NewRequest("POST", "/v1/sessions", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", w.Code)
		}

		var resp map[string]string
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to parse json response: %v", err)
		}
		if resp["reason"] != "expired timestamp" {
			t.Errorf("expected reason 'expired timestamp', got %q", resp["reason"])
		}

		logOutput := logBuf.String()
		if !strings.Contains(logOutput, "status=401") || !strings.Contains(logOutput, "reason=expired timestamp") {
			t.Errorf("expected log to contain status=401 and reason=expired timestamp: %s", logOutput)
		}
		if !strings.Contains(logOutput, "laptopId=lap-auth-123") {
			t.Errorf("expected log to contain laptopId=lap-auth-123: %s", logOutput)
		}
	})
}
