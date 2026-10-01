package relay

import (
	"bufio"
	"errors"
	"log"
	"net"
	"net/http"
	"time"

	"github.com/google/uuid"
)

type loggingResponseWriter struct {
	http.ResponseWriter
	statusCode int
	written    bool
}

func (w *loggingResponseWriter) WriteHeader(code int) {
	if !w.written {
		w.statusCode = code
		w.written = true
	}
	w.ResponseWriter.WriteHeader(code)
}

func (w *loggingResponseWriter) Write(b []byte) (int, error) {
	if !w.written {
		w.statusCode = http.StatusOK
		w.written = true
	}
	return w.ResponseWriter.Write(b)
}

func (w *loggingResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if !w.written {
		w.statusCode = http.StatusSwitchingProtocols
		w.written = true
	}
	if h, ok := w.ResponseWriter.(http.Hijacker); ok {
		return h.Hijack()
	}
	return nil, nil, errors.New("hijacker not supported")
}

// RequestLogger logs incoming HTTP requests with method, path, status, latency and request ID.
// Plain text, strictly one line per event.
func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		reqID := r.Header.Get("X-Request-Id")
		if reqID == "" {
			reqID = uuid.New().String()
		}
		w.Header().Set("X-Request-Id", reqID)

		lw := &loggingResponseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}

		next.ServeHTTP(lw, r)

		latency := time.Since(start)
		method := r.Method
		path := r.URL.Path

		log.Printf("method=%s path=%s status=%d latency=%v requestId=%s\n",
			method, path, lw.statusCode, latency, reqID)
	})
}
