package middleware

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
)

// CORS returns a Gin middleware that enforces an origin allowlist.
func CORS(allowed []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin == "" {
			c.Next()
			return
		}

		if !isOriginAllowed(origin, allowed) {
			if c.Request.Method == http.MethodOptions {
				c.AbortWithStatus(http.StatusForbidden)
				return
			}
			c.Next()
			return
		}

		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Vary", "Origin")
		c.Header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, X-Laptop-Id, X-Laptop-Sig")

		if c.Request.Method == http.MethodOptions {
			c.Header("Access-Control-Max-Age", "600")
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func isOriginAllowed(origin string, allowed []string) bool {
	for _, target := range allowed {
		if MatchOrigin(origin, target) {
			return true
		}
	}
	return false
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
