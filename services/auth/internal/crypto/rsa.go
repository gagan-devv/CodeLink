package crypto

import (
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/pem"
	"errors"
)

var (
	ErrInvalidPEM		= errors.New("crypto: invalid or empty PEM block")
	ErrNotRSAPublicKey	= errors.New("crypto: PEM block is not an RSA public key")
	ErrNotRSAPrivateKey	= errors.New("crypto: PEM block is not an RSA private key")
)

func ParseRSAPublicKey(pemStr string) (*rsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(pemStr))
	if block == nil {
		return nil, ErrInvalidPEM
	}
	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, ErrNotRSAPublicKey
	}
	rsaPub, ok := pub.(*rsa.PublicKey)
	if !ok {
		return nil, ErrNotRSAPublicKey
	}
	return rsaPub, nil
}

func ParseRSAPrivateKey(pemStr string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(pemStr))
	if block == nil {
		return nil, ErrInvalidPEM
	}
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err == nil {
		rsaKey, ok := key.(*rsa.PrivateKey)
		if !ok {
			return nil, ErrNotRSAPrivateKey
		}
		return rsaKey, nil
	}

	rsaKey, err := x509.ParsePKCS1PrivateKey(block.Bytes)
	if err != nil {
		return nil, ErrNotRSAPrivateKey
	}
	return rsaKey, nil
}

func VerifyRequestSignature(publicKeyPEM string, message, signature []byte) error {
	pub, err := ParseRSAPublicKey(publicKeyPEM)
	if err != nil {
		return err
	}
	digest := sha256.Sum256(message)
	return rsa.VerifyPKCS1v15(pub, crypto.SHA256, digest[:], signature)
}