package repository_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/gagan-devv/codelink/services/auth/internal/domain"
	"github.com/gagan-devv/codelink/services/auth/internal/repository"
)

func TestLaptopRepository(t *testing.T) {
	pool := testDB(t)
	repo := repository.NewLaptopRepository(pool)
	ctx  := context.Background()

	laptop := &domain.Laptop{
		ID:           "lap_" + uuid.New().String(),
		PublicKeyPEM: "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq" + uuid.New().String() + "\n-----END PUBLIC KEY-----",
		RegisteredAt: time.Now().UTC(),
		LastSeenAt:   time.Now().UTC(),
	}

	t.Run("Create succeeds", func(t *testing.T) {
		if err := repo.Create(ctx, laptop); err != nil {
			t.Fatalf("Create: %v", err)
		}
	})

	t.Run("Create is idempotent", func(t *testing.T) {
		if err := repo.Create(ctx, laptop); err != nil {
			t.Fatalf("second Create should not fail: %v", err)
		}
	})

	t.Run("GetByID returns the laptop", func(t *testing.T) {
		got, err := repo.GetByID(ctx, laptop.ID)
		if err != nil {
			t.Fatalf("GetByID: %v", err)
		}
		if got.ID != laptop.ID {
			t.Errorf("id: want %s, got %s", laptop.ID, got.ID)
		}
	})

	t.Run("GetByID unknown returns ErrLaptopNotFound", func(t *testing.T) {
		_, err := repo.GetByID(ctx, "lap_doesnotexist")
		if err != repository.ErrLaptopNotFound {
			t.Errorf("want ErrLaptopNotFound, got %v", err)
		}
	})

	t.Run("UpdateLastSeen does not error", func(t *testing.T) {
		if err := repo.UpdateLastSeen(ctx, laptop.ID); err != nil {
			t.Errorf("UpdateLastSeen: %v", err)
		}
	})
}