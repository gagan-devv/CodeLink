package crypto_test

import (
	gocrypto "crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/pem"
	"testing"
	"time"

	"github.com/gagan-devv/codelink/services/auth/internal/crypto"
)

func generateTestKeyPair(t *testing.T) (privatePEM, publicPEM string) {
	t.Helper()
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate test keypair: %v", err)
	}
	privBytes, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		t.Fatalf("failed to marshal private key: %v", err)
	}
	pubBytes, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		t.Fatalf("failed to marshal public key: %v", err)
	}
	privatePEM = string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: privBytes}))
	publicPEM = string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubBytes}))
	return
}

func TestParseRSAPublicKey(t *testing.T) {
	_, pub := generateTestKeyPair(t)

	t.Run("valid key parses without error", func(t *testing.T) {
		if _, err := crypto.ParseRSAPublicKey(pub); err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})

	t.Run("empty returns ErrInvalidPEM", func(t *testing.T) {
		if _, err := crypto.ParseRSAPublicKey(""); err != crypto.ErrInvalidPEM {
			t.Errorf("expected ErrInvalidPEM, got %v", err)
		}
	})

	t.Run("garbage input return ErrInvalidPEM", func(t *testing.T) {
		if _, err := crypto.ParseRSAPublicKey("not-a-pem"); err != crypto.ErrInvalidPEM {
			t.Errorf("expected ErrInvalidPEM, got %v", err)
		}
	})
}

func TestVerifyRequestSignature(t *testing.T) {
	priv, pub := generateTestKeyPair(t)
	privKey, _ := crypto.ParseRSAPrivateKey(priv)

	message := []byte(`{"laptopId":"lap_abc","requestedAt":1718000000000}`)
	digest   := sha256.Sum256(message)
	sig, err := rsa.SignPKCS1v15(rand.Reader, privKey, gocrypto.SHA256, digest[:])
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	t.Run("valid signature verifies", func(t *testing.T) {
		if err := crypto.VerifyRequestSignature(pub, message, sig); err != nil {
			t.Errorf("valid signature failed: %v", err)
		}
	})
	t.Run("tampered message fails", func(t *testing.T) {
		tampered := []byte(`{"laptopId":"EVIL","requestedAt":1718000000000}`)
		if err := crypto.VerifyRequestSignature(pub, tampered, sig); err == nil {
			t.Error("expected failure for tampered message")
		}
	})
	t.Run("wrong public key fails", func(t *testing.T) {
		_, otherPub := generateTestKeyPair(t)
		if err := crypto.VerifyRequestSignature(otherPub, message, sig); err == nil {
			t.Error("expected failure for wrong public key")
		}
	})
}

func TestChallengeRoundTrip(t *testing.T) {
	secret := "test-secret-32-bytes-long-xxxxx"
	sessionID := "sess_abc123"
	requestAt := int64(1718000000000)

	challenge := crypto.GenerateChallenge(sessionID, requestAt, secret)

	t.Run("correct input verify", func(t *testing.T) {
		if !crypto.VerifyChallenge(sessionID, requestAt, secret, challenge) {
			t.Error("valid challenge should verify")
		}
	})

	t.Run("wrong sessionID fails", func(t *testing.T) {
		if crypto.VerifyChallenge("sess_EVIL", requestAt, secret, challenge) {
			t.Error("wrong sessionID should not verify")
		}
	})

	t.Run("wrong timestamp fails", func(t *testing.T) {
		if crypto.VerifyChallenge(sessionID, requestAt+1, secret, challenge) {
			t.Error("wrong timestamp should not verify")
		}
	})

	t.Run("wrong secret fails", func(t *testing.T) {
		if crypto.VerifyChallenge(sessionID, requestAt, "different-secret", challenge) {
			t.Error("wrong secret should not verify")
		}
	})

	t.Run("deterministic — same inputs produce same challenge", func(t *testing.T) {
		c2 := crypto.GenerateChallenge(sessionID, requestAt, secret)
		if challenge != c2 {
			t.Errorf("expected deterministic output: %s != %s", challenge, c2)
		}
	})
}

func TestJWTRoundTrip(t *testing.T) {
	priv, pub := generateTestKeyPair(t)
	issuer := "auth.codelink.io"

	signer, err := crypto.NewJWTSigner(priv, issuer)
	if err != nil {
		t.Fatalf("NewJWTSigner: %v", err)
	}
	validator, err := crypto.NewJWTValidator(pub, issuer)
	if err != nil {
		t.Fatalf("NewJWTValidator: %v", err)
	}

	t.Run("host token round-trips", func(t *testing.T) {
		claims := crypto.Claims{
			Role:      crypto.RoleHost,
			SessionID: "sess_xyz",
			LaptopID:  "lap_abc",
		}
		tokenStr, err := signer.Issue(claims, 8*time.Hour)
		if err != nil {
			t.Fatalf("Issue: %v", err)
		}
		got, err := validator.Validate(tokenStr)
		if err != nil {
			t.Fatalf("Validate: %v", err)
		}
		if got.Role != crypto.RoleHost {
			t.Errorf("role: wants %s, got %s", crypto.RoleHost, crypto.RoleClient)
		}
		if got.SessionID != "sess_xyz" {
			t.Errorf("session_id: want sess_xyz, got %s", got.SessionID)
		}
		if got.LaptopID != "lap_abc" {
			t.Errorf("laptop_id: want lap_abc, got %s", got.LaptopID)
		}
	})

	t.Run("client token round-trips", func(t *testing.T) {
		claims := crypto.Claims{
			Role:           crypto.RoleClient,
			SessionID:      "sess_xyz",
			MobileDeviceID: "mob_123",
		}
		tokenStr, _ := signer.Issue(claims, 8*time.Hour)
		got, err := validator.Validate(tokenStr)
		if err != nil {
			t.Fatalf("Validate: %v", err)
		}
		if got.MobileDeviceID != "mob_123" {
			t.Errorf("mobile_device_id: want mob_123, got %s", got.MobileDeviceID)
		}
	})

	t.Run("expired token is rejected", func(t *testing.T) {
		claims := crypto.Claims{Role: crypto.RoleHost, SessionID: "sess_exp"}
		tokenStr, _ := signer.Issue(claims, -1*time.Second) // already expired
		if _, err := validator.Validate(tokenStr); err == nil {
			t.Error("expired token should be rejected")
		}
	})

	t.Run("token signed with different key is rejected", func(t *testing.T) {
		otherPriv, _ := generateTestKeyPair(t)
		otherSigner, _ := crypto.NewJWTSigner(otherPriv, issuer)
		claims := crypto.Claims{Role: crypto.RoleHost, SessionID: "sess_other"}
		tokenStr, _ := otherSigner.Issue(claims, time.Hour)
		if _, err := validator.Validate(tokenStr); err == nil {
			t.Error("token signed with wrong key should be rejected")
		}
	})

	t.Run("wrong issuer is rejected", func(t *testing.T) {
		wrongIssuerValidator, _ := crypto.NewJWTValidator(pub, "evil.example.com")
		claims := crypto.Claims{Role: crypto.RoleHost, SessionID: "sess_iss"}
		tokenStr, _ := signer.Issue(claims, time.Hour)
		if _, err := wrongIssuerValidator.Validate(tokenStr); err == nil {
			t.Error("wrong issuer should be rejected")
		}
	})
}
