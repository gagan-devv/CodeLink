package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/gagan-devv/codelink/services/auth/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

var ErrSessionNotFound = errors.New("sessoin not found")

const (
	pendingTTL = 90 * time.Second
	activeTTL  = 8 * time.Hour
	revokedTTL = 30 * time.Second
)

type redisSession struct {
	State          string `json:"state"`
	LaptopID       string `json:"laptop_id"`
	MobileDeviceID string `json:"mobile_device_id,omitempty"`
	Challenge      string `json:"challenge,omitempty"`
	LaptopToken    string `json:"laptop_token,omitempty"`
	MobileToken    string `json:"mobile_token,omitempty"`
}

type SessionRepository struct {
	db *pgxpool.Pool
	redis *redis.Client
}

func NewSessionRepository(db *pgxpool.Pool, rdb *redis.Client) *SessionRepository {
	return &SessionRepository{db: db, redis: rdb}
}

func (r *SessionRepository) Create(ctx context.Context, s *domain.Session, challenge string) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO sessions (id, laptop_id, state, created_at, expires_at)
		VALUES ($1, $2, $3, $4, $5)
	`, s.ID, s.LaptopID, string(s.State), s.CreatedAt, s.ExpiresAt)
	if err != nil {
		return fmt.Errorf("session repo: create postgres: %w", err)
	}

	data := redisSession{
		State: string(domain.SessionPending),
		LaptopID: s.LaptopID,
		Challenge: challenge,
	}
	if err := r.setRedis(ctx, s.ID, data, pendingTTL); err != nil {
		return fmt.Errorf("session repo: create redis: %w", err)
	}
	return nil
}

func (r *SessionRepository) GetRedisSession(ctx context.Context, sessionID string) (*redisSession, error) {
	b, err := r.redis.Get(ctx, redisKey(sessionID)).Bytes()
	if errors.Is(err, redis.Nil) {
		return nil, ErrSessionNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("session repo: redis get: %w", err)
	}
	var data redisSession
	if err := json.Unmarshal(b, &data); err != nil {
		return nil, fmt.Errorf("session repo: unmarshal: %w", err)
	}
	return &data, nil
}

func (r *SessionRepository) Activate(
	ctx context.Context,
	sessionID, mobileDeviceID, laptopID, laptopToken, mobileToken string,
) error {
	now := time.Now()
	_, err := r.db.Exec(ctx, `
		UPDATE sessions
		SET state = 'active', mobile_device_id = $1, approved_at = $2
		WHERE id = $3
	`, mobileDeviceID, now, sessionID)
	if err != nil {
		return fmt.Errorf("session repo: activate postgres: %w", err)
	}

	data := redisSession{
		State: string(domain.SessionActive),
		LaptopID: laptopID,
		MobileDeviceID: mobileDeviceID,
		LaptopToken: laptopToken,
		MobileToken: mobileToken,
	}
	if err := r.setRedis(ctx, sessionID, data, activeTTL); err != nil {
		return fmt.Errorf("session repo: activate redis: %w", err)
	}
	return nil
}

func (r *SessionRepository) Revoke(ctx context.Context, sessionID string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE sessions SET state = 'revoked', revoked_at = $1 WHERE id = $2
	`, time.Now(), sessionID)
	if err != nil {
		return fmt.Errorf("session repo: revoke postgres: %w", err)
	}

	data := redisSession{State: string(domain.SessionRevoked)}
	if err := r.setRedis(ctx, sessionID, data, revokedTTL); err != nil {
		return fmt.Errorf("session repo: revoke redis: %w", err)
	}
	return nil
}

func (r *SessionRepository) GetByID(ctx context.Context, sessionID string) (*domain.Session, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, laptop_id, mobile_device_id, state,
		       created_at, approved_at, revoked_at, expires_at
		FROM sessions WHERE id = $1
	`, sessionID)

	s := &domain.Session{}
	var state string
	err := row.Scan(
		&s.ID, &s.LaptopID, &s.MobileDeviceID, &state,
		&s.CreatedAt, &s.ApprovedAt, &s.RevokedAt, &s.ExpiresAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrSessionNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("session repo: get by id: %w", err)
	}
	s.State = domain.SessionState(state)
	return s, nil
}

func (r *SessionRepository) setRedis(ctx context.Context, sessionID string, data redisSession, ttl time.Duration) error {
	b, err := json.Marshal(data)
	if err != nil {
		return err
	}
	return r.redis.Set(ctx, redisKey(sessionID), b, ttl).Err()
}

func redisKey(sessionID string) string {
	return "session:" + sessionID
}