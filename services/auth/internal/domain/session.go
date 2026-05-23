package domain

import "time"

type SessionState string

const (
	SessionPending SessionState = "pending"
	SessionActive  SessionState = "active"
	SessionRevoked SessionState = "revoked"
	SessionExpired SessionState = "expired"
)

type Session struct {
	ID             string
	LaptopID       string
	MobileDeviceID string
	State          SessionState
	CreatedAt      time.Time
	ApprovedAt     time.Time
	RevokedAt      time.Time
	ExpiresAt      time.Time
}
