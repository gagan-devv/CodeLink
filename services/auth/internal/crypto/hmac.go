package crypto

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

func GenerateChallenge(sessionID string, requestedAt int64, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(fmt.Sprintf("%s:%d", sessionID, requestedAt)))
	return hex.EncodeToString(mac.Sum(nil))
}

func VerifyChallenge(sessionID string, requestedAt int64, secret, provided string) bool {
	expected := GenerateChallenge(sessionID, requestedAt, secret)
	return hmac.Equal([]byte(expected), []byte(provided))
}