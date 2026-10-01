package handlers

import (
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"log"
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
		LaptopID    string `json:"laptopId"`
		RequestedAt int64  `json:"requestedAt"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		reason := "missing field"
		log.Printf("session create failed: status=400 laptopId=%s reason=%s\n", laptopID, reason)
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad request", "reason": reason})
		return
	}
	if req.LaptopID == "" || req.RequestedAt == 0 {
		reason := "missing field"
		log.Printf("session create failed: status=400 laptopId=%s reason=%s\n", laptopID, reason)
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad request", "reason": reason})
		return
	}
	if req.LaptopID != laptopID {
		reason := "laptopId mismatch"
		log.Printf("session create failed: status=403 laptopId=%s reason=%s\n", laptopID, reason)
		c.JSON(http.StatusForbidden, gin.H{"error": "laptopId does not match authenticated laptop", "reason": reason})
		return
	}

	const maxSkew = 5 * time.Minute
	now := time.Now().UTC()
	reqTime := time.UnixMilli(req.RequestedAt)
	diff := now.Sub(reqTime)
	if diff < -maxSkew || diff > maxSkew {
		reason := "expired timestamp"
		log.Printf("session create failed: status=401 laptopId=%s reason=%s\n", laptopID, reason)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "reason": reason})
		return
	}

	sessionID := "sess_" + uuid.New().String()
	challenge := authcrypto.GenerateChallenge(sessionID, req.RequestedAt, h.cfg.HMACSecret)
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
		reason := "missing field"
		log.Printf("session join failed: status=400 sessionID=%s reason=%s\n", sessionID, reason)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "reason": reason})
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
		reason := "session not joinable"
		log.Printf("session join failed: status=400 sessionID=%s reason=%s\n", sessionID, reason)
		c.JSON(http.StatusBadRequest, gin.H{"error": "session not joinable", "reason": reason})
	}

	if subtle.ConstantTimeCompare([]byte(req.Challenge), []byte(data.Challenge)) != 1 {
		reason := "invalid challenge"
		log.Printf("session join failed: status=400 sessionID=%s reason=%s\n", sessionID, reason)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid challenge", "reason": reason})
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