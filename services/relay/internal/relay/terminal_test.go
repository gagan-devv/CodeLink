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

	// Non-terminal message > 32 KB should NOT be classified as oversized terminal frame
	nonTermBytes := bytes.Repeat([]byte("b"), 35*1024)
	nonTermJSON, _ := json.Marshal(map[string]interface{}{
		"type":    "SNAPSHOT_RESPONSE",
		"payload": string(nonTermBytes),
	})
	if IsOversizedTerminalFrame(nonTermJSON) {
		t.Error("expected non-terminal message > 32KB to not be flagged as oversized terminal frame")
	}

	// Corrupted / non-JSON data > 32 KB should NOT be flagged as oversized terminal frame
	corruptBytes := bytes.Repeat([]byte("x"), 35*1024)
	if IsOversizedTerminalFrame(corruptBytes) {
		t.Error("expected non-JSON data to not be flagged as oversized terminal frame")
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
