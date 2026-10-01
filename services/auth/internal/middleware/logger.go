package middleware

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// RequestLogger logs method, path, status, latency and request ID in plain text, one line per event.
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		reqID := c.GetHeader("X-Request-Id")
		if reqID == "" {
			reqID = uuid.New().String()
		}
		c.Set("requestID", reqID)
		c.Header("X-Request-Id", reqID)

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()
		method := c.Request.Method
		path := c.Request.URL.Path

		log.Printf("method=%s path=%s status=%d latency=%v requestId=%s\n",
			method, path, status, latency, reqID)
	}
}
