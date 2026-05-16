package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/gagan-devv/codelink/services/auth/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrLaptopNotFound = errors.New("laptop not found")

type LaptopRepository struct {
	db *pgxpool.Pool
}

func NewLaptopRepository(db *pgxpool.Pool) *LaptopRepository {
	return &LaptopRepository{db: db}
}

func (r *LaptopRepository) Create(ctx context.Context, laptop *domain.Laptop) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO laptops (id, public_key_pem, registered_at, last_seen_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (id) DO NOTHING
	`, laptop.ID, laptop.PublicKeyPEM, laptop.RegisteredAt, laptop.LastSeenAt)
	if err != nil {
		return fmt.Errorf("laptop repo: create: %w", err)
	}
	return nil
}

func (r *LaptopRepository) GetByID(ctx context.Context, id string) (*domain.Laptop, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, public_key_pem, registered_at, last_seen_at
		FROM laptops WHERE id = $1
	`, id)

	l := &domain.Laptop{}
	err := row.Scan(&l.ID, &l.PublicKeyPEM, &l.RegisteredAt, &l.LastSeenAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrLaptopNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("laptop repo: get by id: %w", err)
	}
	return l, nil
}

func (r *LaptopRepository) GetByPublicKey(ctx context.Context, pubKeyPEM string) (*domain.Laptop, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, public_key_pem, registered_at, last_seen_at
		FROM laptops WHERE public_key_pem = $1	
	`, pubKeyPEM)

	l := &domain.Laptop{}
	err := row.Scan(&l.ID, &l.PublicKeyPEM, &l.RegisteredAt, &l.LastSeenAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrLaptopNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("laptop repo: get by public key: %w", err)
	}
	return l, nil
}

func (r *LaptopRepository) UpdateLastSeen(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, 
		`UPDATE laptops SET last_seen_at = $1 WHERE id = $2`,
		time.Now(), id,
	)
	return err
}