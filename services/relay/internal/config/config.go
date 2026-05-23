package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port             string
	RedisURL         string
	AuthPublicKeyPEM string
	JWTIssuer        string
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:             getEnv("RELAY_PORT", "8082"),
		RedisURL:         os.Getenv("REDIS_URL"),
		AuthPublicKeyPEM: os.Getenv("AUTH_PUBLIC_KEY_PEM"),
		JWTIssuer:        getEnv("AUTH_JWT_ISSUER", "auth.codelink.io"),
	}
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (c *Config) validate() error {
	required := map[string]string{
		"REDIS_URL":           c.RedisURL,
		"AUTH_PUBLIC_KEY_PEM": c.AuthPublicKeyPEM,
	}
	for name, val := range required {
		if val == "" {
			return fmt.Errorf("config: required env var %s is not set", name)
		}
	}
	return nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
