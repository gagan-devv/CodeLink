package auth

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
)

type Role string

const (
	RoleHost   Role = "host"
	RoleClient Role = "client"
)

type Claims struct {
	jwt.RegisteredClaims
	Role      Role   `json:"role"`
	SessionID string `json:"session_id"`
}

type Validator struct {
	publicKey *rsa.PublicKey
	issuer    string
}

func NewValidator(publicKeyPEM, issuer string) (*Validator, error) {
	block, _ := pem.Decode([]byte(publicKeyPEM))
	if block == nil {
		return nil, errors.New("auth: invalid public key PEM")
	}
	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("auth: parse public key: %w", err)
	}
	rsaPub, ok := pub.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("auth: nt an RSA public key")
	}
	return &Validator{publicKey: rsaPub, issuer: issuer}, nil
}

func (v *Validator) Validate(tokenStr string) (*Claims, error) {
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
		return nil, errors.New("invalid token")
	}
	return claims, nil
}
