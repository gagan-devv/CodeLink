package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
)

type Config struct {
	Port             string
	RedisURL         string
	AuthPublicKeyPEM string
	JWTIssuer        string
	AllowedOrigins   []string
}

func Load() (*Config, error) {
	allowedOrigins, err := ParseAllowedOrigins(os.Getenv("RELAY_ALLOWED_ORIGINS"))
	if err != nil {
		return nil, fmt.Errorf("config: %w", err)
	}

	cfg := &Config{
		Port:             getEnv("RELAY_PORT", "8082"),
		RedisURL:         os.Getenv("REDIS_URL"),
		AuthPublicKeyPEM: os.Getenv("AUTH_PUBLIC_KEY_PEM"),
		JWTIssuer:        getEnv("AUTH_JWT_ISSUER", "auth.codelink.io"),
		AllowedOrigins:   allowedOrigins,
	}
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

// ParseAllowedOrigins parses a comma-separated list of origins, trimming whitespace
// and dropping empty entries.
func ParseAllowedOrigins(raw string) ([]string, error) {
	if strings.TrimSpace(raw) == "" {
		return []string{}, nil
	}
	parts := strings.Split(raw, ",")
	var origins []string
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed == "" {
			continue
		}
		origins = append(origins, trimmed)
	}
	return origins, nil
}

func (c *Config) Validate() error {
	required := map[string]string{
		"REDIS_URL":           c.RedisURL,
		"AUTH_PUBLIC_KEY_PEM": c.AuthPublicKeyPEM,
	}
	for name, val := range required {
		if val == "" {
			return fmt.Errorf("config: required env var %s is not set", name)
		}
	}
	for _, o := range c.AllowedOrigins {
		if o == "*" || strings.Contains(o, "*") {
			return fmt.Errorf("config: wildcard origin '*' is not allowed")
		}
		if strings.HasSuffix(o, "/") {
			return fmt.Errorf("config: origin '%s' must not have a trailing slash", o)
		}
		u, err := url.Parse(o)
		if err != nil || u.Scheme == "" || u.Host == "" || u.Path != "" || u.RawQuery != "" {
			return fmt.Errorf("config: invalid origin '%s'", o)
		}
	}
	return nil
}

func (c *Config) validate() error {
	return c.Validate()
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
