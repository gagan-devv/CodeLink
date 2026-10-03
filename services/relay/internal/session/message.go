package session

import (
	"encoding/json"
	"strings"
)

type messageProbe struct {
	Type string `json:"type"`
}

// ParseMessageType extracts the "type" field from a JSON envelope without
// having to unmarshal large payload fields.
func ParseMessageType(data []byte) (string, error) {
	var p messageProbe
	if err := json.Unmarshal(data, &p); err != nil {
		return "", err
	}
	return p.Type, nil
}

// IsTerminalMessageType checks if the message type is a terminal frame (prefixed with "TERM_").
func IsTerminalMessageType(msgType string) bool {
	return strings.HasPrefix(msgType, "TERM_")
}

// BuildCompanionNotConnectedError returns a JSON error frame indicating that
// no terminal companion daemon is connected to the session.
func BuildCompanionNotConnectedError() []byte {
	b, _ := json.Marshal(map[string]interface{}{
		"v":    1,
		"type": "TERM_ERROR",
		"payload": map[string]string{
			"code":  "COMPANION_NOT_CONNECTED",
			"error": "Terminal companion daemon is not connected to this session",
		},
	})
	return b
}
