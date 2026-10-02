package handlers

import (
	"encoding/base64"
	"encoding/json"
	"testing"
)

func TestQRData_MinimalPayload(t *testing.T) {
	data := qrData{
		SessionID: "sess_123",
		Challenge: "chal_456",
	}

	raw, err := json.Marshal(data)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	if parsed["sessionId"] != "sess_123" {
		t.Errorf("expected sessionId 'sess_123', got %v", parsed["sessionId"])
	}
	if parsed["challenge"] != "chal_456" {
		t.Errorf("expected challenge 'chal_456', got %v", parsed["challenge"])
	}
	if _, exists := parsed["relayWSS"]; exists {
		t.Errorf("relayWSS should NOT be present in qrData")
	}
	if _, exists := parsed["relayWss"]; exists {
		t.Errorf("relayWss should NOT be present in qrData")
	}

	b64 := base64.URLEncoding.EncodeToString(raw)
	decodedBytes, err := base64.URLEncoding.DecodeString(b64)
	if err != nil {
		t.Fatalf("base64 decode failed: %v", err)
	}

	var roundtrip map[string]interface{}
	if err := json.Unmarshal(decodedBytes, &roundtrip); err != nil {
		t.Fatalf("roundtrip unmarshal failed: %v", err)
	}
	if roundtrip["sessionId"] != "sess_123" || roundtrip["challenge"] != "chal_456" {
		t.Errorf("roundtrip mismatch: %v", roundtrip)
	}
}
