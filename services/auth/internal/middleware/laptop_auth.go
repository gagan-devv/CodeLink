package middleware

import (
	"bytes"
	"encoding/base64"
	"io"
	"log"
	"net/http"

	"github.com/gagan-devv/codelink/services/auth/internal/crypto"
	"github.com/gagan-devv/codelink/services/auth/internal/repository"
	"github.com/gin-gonic/gin"
)

func LaptopAuth(laptopRepo *repository.LaptopRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		laptopID := c.GetHeader("X-Laptop-Id")
		sigB64 := c.GetHeader("X-Laptop-Sig")

		if laptopID == "" || sigB64 == "" {
			lid := laptopID
			if lid == "" {
				lid = "(none)"
			}
			reason := "missing field"
			log.Printf("session auth failed: status=401 laptopId=%s reason=%s\n", lid, reason)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":  "missing X-Laptop-Id or X-Laptop-Sig header",
				"reason": reason,
			})
			return
		}

		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1<<20)
		body, err := io.ReadAll(c.Request.Body)
		if err != nil {
			reason := "failed to read body"
			log.Printf("session auth failed: status=400 laptopId=%s reason=%s\n", laptopID, reason)
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error":  "failed to read body or body exceeded 1MB limit",
				"reason": reason,
			})
			return
		}
		c.Request.Body = io.NopCloser(bytes.NewReader(body))

		laptop, err := laptopRepo.GetByID(c.Request.Context(), laptopID)
		if err != nil {
			reason := "laptop not found"
			log.Printf("session auth failed: status=401 laptopId=%s reason=%s\n", laptopID, reason)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":  "unknown laptop",
				"reason": reason,
			})
			return
		}

		sig, err := base64.StdEncoding.DecodeString(sigB64)
		if err != nil {
			reason := "bad signature"
			log.Printf("session auth failed: status=401 laptopId=%s reason=%s\n", laptopID, reason)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":  "malformed signature",
				"reason": reason,
			})
			return
		}

		if err := crypto.VerifyRequestSignature(laptop.PublicKeyPEM, body, sig); err != nil {
			reason := "bad signature"
			log.Printf("session auth failed: status=401 laptopId=%s reason=%s\n", laptopID, reason)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":  "signature verification failed",
				"reason": reason,
			})
			return
		}

		c.Set("laptopID", laptop.ID)
		c.Set("laptop", laptop)
		c.Next()
	}
}
