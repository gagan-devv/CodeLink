package handlers

import (
	"net/http"
	"time"

	"github.com/gagan-devv/codelink/services/auth/internal/crypto"
	"github.com/gagan-devv/codelink/services/auth/internal/domain"
	"github.com/gagan-devv/codelink/services/auth/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type LaptopHandler struct {
	laptopRepo *repository.LaptopRepository
}

func NewLaptopHandler(repo *repository.LaptopRepository) *LaptopHandler {
	return &LaptopHandler{laptopRepo: repo}
}

type registerRequest struct {
	PublicKeyPEM string `json:"publicKeyPem" binding:"required"`
}

func (h *LaptopHandler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if _, err := crypto.ParseRSAPublicKey(req.PublicKeyPEM); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid RSA public key PEM"})
		return
	}

	existing, err := h.laptopRepo.GetByPublicKey(c.Request.Context(), req.PublicKeyPEM)
	if err == nil {
		c.JSON(http.StatusOK, gin.H{"laptopId": existing.ID})
		return
	}

	laptop := &domain.Laptop{
		ID:           "lap_" + uuid.New().String(),
		PublicKeyPEM: req.PublicKeyPEM,
		RegisteredAt: time.Now().UTC(),
		LastSeenAt:   time.Now().UTC(),
	}
	if err := h.laptopRepo.Create(c.Request.Context(), laptop); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to register"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"laptopId": laptop.ID})
}
