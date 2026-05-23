package domain

import "time"

type Laptop struct {
	ID           string
	PublicKeyPEM string
	RegisteredAt time.Time
	LastSeenAt   time.Time
}
