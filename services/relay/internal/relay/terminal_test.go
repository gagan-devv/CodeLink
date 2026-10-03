package relay

import (
	"bytes"
	"encoding/json"
	"testing"
)

func TestTerminalMessage_SizeLimit(t *testing.T) {
	// Terminal messages have a strict 32 KB size cap
	oversizedBytes := bytes.Repeat([]byte("a"), 33*1024)
	oversizedJSON, _ := json.Marshal(map[string]interface{}{
		"type":    "TERM_OUTPUT",
		"payload": string(oversizedBytes),
	})

	if !IsOversizedTerminalFrame(oversizedJSON) {
		t.Errorf("expected frame of %d bytes to be recognized as oversized terminal frame", len(oversizedJSON))
	}

	validBytes := bytes.Repeat([]byte("a"), 16*1024)
	validJSON, _ := json.Marshal(map[string]interface{}{
		"type":    "TERM_OUTPUT",
		"payload": string(validBytes),
	})

	if IsOversizedTerminalFrame(validJSON) {
		t.Errorf("expected frame of %d bytes to be accepted under 32KB cap", len(validJSON))
	}
}

func TestTerminalRateLimiter(t *testing.T) {
	limiter := NewRateLimiter(50, 100) // 50 tokens/sec, burst 100

	// Consuming burst limit should succeed
	for i := 0; i < 100; i++ {
		if !limiter.Allow() {
			t.Fatalf("expected token %d to be allowed within burst capacity", i)
		}
	}

	// 101st token should exceed burst and be rate limited
	if limiter.Allow() {
		t.Error("expected rate limiter to reject token exceeding burst")
	}
}
