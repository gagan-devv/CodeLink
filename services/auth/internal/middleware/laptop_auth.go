package middleware

import (
	"bytes"
	"encoding/base64"
	"io"
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
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "missing X-Laptop-Id or X-Laptop-Sig header",
			})
			return
		}

		body, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
			return
		}
		c.Request.Body = io.NopCloser(bytes.NewReader(body))

		laptop, err := laptopRepo.GetByID(c.Request.Context(), laptopID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unknown lapotp"})
			return
		}

		sig, err := base64.StdEncoding.DecodeString(sigB64)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "malformed signature"})
			return
		}

		if err := crypto.VerifyRequestSignature(laptop.PublicKeyPEM, body, sig); err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "signature verification failed"})
			return
		}

		c.Set("laptopID", laptop.ID)
		c.Set("laptop", laptop)
		c.Next()
	}
}
