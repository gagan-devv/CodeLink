package handlers

import (
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gagan-devv/codelink/services/auth/internal/config"
	authcrypto "github.com/gagan-devv/codelink/services/auth/internal/crypto"
	"github.com/gagan-devv/codelink/services/auth/internal/domain"
	"github.com/gagan-devv/codelink/services/auth/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SessionHandler struct {
	sessionRepo *repository.SessionRepository
	signer      *authcrypto.JWTSigner
	cfg         *config.Config
}

func NewSessionHandler(
	sessionRepo *repository.SessionRepository,
	signer *authcrypto.JWTSigner,
	cfg *config.Config,
) *SessionHandler {
	return &SessionHandler{sessionRepo: sessionRepo, signer: signer, cfg: cfg}
}

type qrData struct {
	SessionID string `json:"sessionId"`
	Challenge string `json:"challenge"`
	RelayWSS  string `json:"relayWSS"`
}

func (h *SessionHandler) Create(c *gin.Context) {
	laptopID := c.GetString("laptopID")

	var req struct {
		LaptopID    string `json:"laptopId" binding:"required"`
		RequestedAt int64  `json:"requestedAt" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.LaptopID != laptopID {
		c.JSON(http.StatusForbidden, gin.H{"error": "laptopId does not match authenticated laptop"})
		return
	}

	sessionID := "sess_" + uuid.New().String()
	challenge := authcrypto.GenerateChallenge(sessionID, req.RequestedAt, h.cfg.HMACSecret)
	now := time.Now().UTC()
	expiresAt := now.Add(90 * time.Second)

	session := &domain.Session{
		ID: sessionID,
		LaptopID: laptopID,
		State: domain.SessionPending,
		CreatedAt: now,
		ExpiresAt: expiresAt,
	}
	if err := h.sessionRepo.Create(c.Request.Context(), session, challenge); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create session"})
		return
	}

	qr, _ := json.Marshal(qrData{
		SessionID: sessionID,
		Challenge: challenge,
		RelayWSS: h.cfg.RelayWSS,
	})

	c.JSON(http.StatusCreated, gin.H{
		"sessionId": sessionID,
		"qrPayload": base64.URLEncoding.EncodeToString(qr),
		"expiresAt": expiresAt.UnixMilli(),
	})
}

func (h *SessionHandler) Status(c *gin.Context) {
	sessionID := c.Param("id")
	laptopID := c.GetString("laptopID")

	data, err := h.sessionRepo.GetRedisSession(c.Request.Context(), sessionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found or expired"})
		return
	}
	if data.LaptopID != laptopID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	if data.State == string(domain.SessionActive) {
		c.JSON(http.StatusOK, gin.H{
			"state": "active",
			"mobileDeviceId": data.MobileDeviceID,
			"laptopToken": data.LaptopToken,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"state": data.State,
		"mobileDeviceId": nil,
		"laptopToken": nil,
	})
}

func (h *SessionHandler) Join(c *gin.Context) {
	sessionID := c.Param("id")

	var req struct {
		Challenge string `json:"challenge" binding:"required"`
		MobileDeviceID string `json:"mobileDeviceId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	data, err := h.sessionRepo.GetRedisSession(c.Request.Context(), sessionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found or expired"})
		return
	}

	switch domain.SessionState(data.State) {
	case domain.SessionRevoked:
		c.JSON(http.StatusGone, gin.H{"error": "session has been revoked"})
		return
	case domain.SessionActive:
		c.JSON(http.StatusConflict, gin.H{"error": "session already active"})
		return
	case domain.SessionPending:
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "session not joinable"})
	}

	if subtle.ConstantTimeCompare([]byte(req.Challenge), []byte(data.Challenge)) != 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid challenge"})
		return
	}

	ttl := 8 * time.Hour
	laptopToken, err := h.signer.Issue(authcrypto.Claims{
		Role: authcrypto.RoleHost,
		SessionID: sessionID,
		LaptopID: data.LaptopID,
	}, ttl)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to issue laptop token"})
		return
	}

	mobileToken, err := h.signer.Issue(authcrypto.Claims{
		Role:           authcrypto.RoleClient,
		SessionID:      sessionID,
		MobileDeviceID: req.MobileDeviceID,
	}, ttl)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to issue mobile token"})
		return
	}

	if err := h.sessionRepo.Activate(
		c.Request.Context(),
		sessionID, req.MobileDeviceID, data.LaptopID, laptopToken, mobileToken,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to activate session"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"mobileToken": mobileToken,
		"relayWss": h.cfg.RelayWSS,
		"sessionId": sessionID,
		"expiresAt": time.Now().Add(ttl).UnixMilli(),
	})
}

func (h *SessionHandler) Revoke(c *gin.Context) {
	sessionID := c.Param("id")
	laptopID := c.GetString("laptopID")

	data, err := h.sessionRepo.GetRedisSession(c.Request.Context(), sessionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}
	if data.LaptopID != laptopID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	if err := h.sessionRepo.Revoke(c.Request.Context(), sessionID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to revoke session"})
		return
	}

	c.Status(http.StatusNoContent)
} 