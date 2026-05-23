package crypto

import (
	"crypto/rsa"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Role string

const (
	RoleHost   Role = "host"
	RoleClient Role = "client"
)

type Claims struct {
	jwt.RegisteredClaims
	Role           Role   `json:"role"`
	SessionID      string `json:"session_id"`
	LaptopID       string `json:"laptop_id,omitempty"`
	MobileDeviceID string `json:"mobile_device_id,omitempty"`

	// Permissions []string `json:"permissions,omitempty"`
}

type JWTSigner struct {
	privateKey *rsa.PrivateKey
	issuer     string
}

type JWTValidator struct {
	publicKey *rsa.PublicKey
	issuer    string
}

func NewJWTSigner(privateKeyPEM, issuer string) (*JWTSigner, error) {
	key, err := ParseRSAPrivateKey(privateKeyPEM)
	if err != nil {
		return nil, fmt.Errorf("jwt signer: %w", err)
	}
	return &JWTSigner{privateKey: key, issuer: issuer}, nil
}

func NewJWTValidator(publicKeyPEM, issuer string) (*JWTValidator, error) {
	key, err := ParseRSAPublicKey(publicKeyPEM)
	if err != nil {
		return nil, fmt.Errorf("jwt validator: %w", err)
	}
	return &JWTValidator{publicKey: key, issuer: issuer}, nil
}

func (s *JWTSigner) Issue(claims Claims, ttl time.Duration) (string, error) {
	now := time.Now()
	claims.RegisteredClaims = jwt.RegisteredClaims{
		Issuer: s.issuer,
		Subject: claims.SessionID,
		IssuedAt: jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	return token.SignedString(s.privateKey)
}

func (v *JWTValidator) Validate(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(
		tokenStr,
		&Claims{},
		func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
				return nil, errors.New("unexpected signing method")
			}
			return v.publicKey, nil
		},
		jwt.WithIssuer(v.issuer),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}
	return claims, nil
}