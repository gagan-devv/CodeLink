package middleware_test

import (
	"bytes"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gagan-devv/codelink/services/auth/internal/middleware"
	"github.com/gin-gonic/gin"
)

func TestRequestLogger(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("generates requestId and logs method, path, status, latency", func(t *testing.T) {
		var logBuf bytes.Buffer
		log.SetOutput(&logBuf)
		defer log.SetOutput(os.Stderr)

		r := gin.New()
		r.Use(middleware.RequestLogger())
		r.GET("/v1/test", func(c *gin.Context) {
			c.String(http.StatusOK, "ok")
		})

		req := httptest.NewRequest("GET", "/v1/test", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}

		reqID := w.Header().Get("X-Request-Id")
		if reqID == "" {
			t.Fatal("expected X-Request-Id header on response")
		}

		logOutput := logBuf.String()
		if !strings.Contains(logOutput, "method=GET") {
			t.Errorf("expected log to contain method=GET: %s", logOutput)
		}
		if !strings.Contains(logOutput, "path=/v1/test") {
			t.Errorf("expected log to contain path=/v1/test: %s", logOutput)
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

	t.Run("preserves incoming X-Request-Id", func(t *testing.T) {
		var logBuf bytes.Buffer
		log.SetOutput(&logBuf)
		defer log.SetOutput(os.Stderr)

		r := gin.New()
		r.Use(middleware.RequestLogger())
		r.POST("/v1/sessions", func(c *gin.Context) {
			c.String(http.StatusCreated, "created")
		})

		req := httptest.NewRequest("POST", "/v1/sessions", nil)
		req.Header.Set("X-Request-Id", "custom-req-id-123")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Header().Get("X-Request-Id") != "custom-req-id-123" {
			t.Errorf("expected X-Request-Id to be preserved, got %s", w.Header().Get("X-Request-Id"))
		}

		logOutput := logBuf.String()
		if !strings.Contains(logOutput, "requestId=custom-req-id-123") {
			t.Errorf("expected log to contain custom requestId: %s", logOutput)
		}
	})
}
