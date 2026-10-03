package relay

import (
	"sync"
	"time"

	"github.com/gagan-devv/codelink/services/relay/internal/session"
)

const MaxTerminalFrameSize = 32 * 1024 // 32 KB

// IsOversizedTerminalFrame checks if a frame is a terminal message exceeding 32 KB.
// Parses the message type properly from JSON rather than relying on substring matching.
func IsOversizedTerminalFrame(data []byte) bool {
	if len(data) <= MaxTerminalFrameSize {
		return false
	}
	msgType, err := session.ParseMessageType(data)
	if err != nil {
		return false
	}
	return session.IsTerminalMessageType(msgType)
}

// RateLimiter is a thread-safe token-bucket rate limiter.
type RateLimiter struct {
	mu         sync.Mutex
	rate       float64 // tokens per second
	burst      float64 // maximum tokens
	tokens     float64
	lastUpdate time.Time
}

// NewRateLimiter creates a new token bucket limiter with specified fill rate and burst limit.
func NewRateLimiter(rate float64, burst int) *RateLimiter {
	return &RateLimiter{
		rate:       rate,
		burst:      float64(burst),
		tokens:     float64(burst),
		lastUpdate: time.Now(),
	}
}

// Allow attempts to consume one token. Returns true if permitted, false if rate limited.
func (r *RateLimiter) Allow() bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(r.lastUpdate).Seconds()
	r.lastUpdate = now

	// Replenish tokens based on elapsed time
	r.tokens += elapsed * r.rate
	if r.tokens > r.burst {
		r.tokens = r.burst
	}

	if r.tokens >= 1.0 {
		r.tokens -= 1.0
		return true
	}

	return false
}
