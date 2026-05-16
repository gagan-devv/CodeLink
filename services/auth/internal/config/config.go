package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port             string
	PostgresURL      string
	RedisURL         string
	HMACSecret       string
	JWTPrivateKeyPEM string
	JWTIssuer        string
}

func Load() (*Config, error) {
	cfg := &Config{
		Port: getEnv("AUTH_PORT", "8081"),
		PostgresURL: os.Getenv("POSTGRES_URL"),
		RedisURL: os.Getenv("REDIS_URL"),
		HMACSecret: os.Getenv("AUTH_HMAC_SECRET"),
		JWTPrivateKeyPEM: os.Getenv("AUTH_PRIVATE_KEY_PEM"),
		JWTIssuer: getEnv("AUTH_JWT_ISSUER", "auth.codelink.io"),
	}
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (c *Config) validate() error {
	required := map[string]string{
		"POSTGRES_URL":         c.PostgresURL,
		"REDIS_URL":            c.RedisURL,
		"AUTH_HMAC_SECRET":     c.HMACSecret,
		"AUTH_PRIVATE_KEY_PEM": c.JWTPrivateKeyPEM,
	}
	for name, val := range required {
		if val == "" {
			return fmt.Errorf("config: required env var %s is not set", name)
		}
	}
	if len(c.HMACSecret) < 32 {
		return fmt.Errorf("config: AUTH_HMAC_SECRET must be at least 32 bytes")
	}
	return nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}