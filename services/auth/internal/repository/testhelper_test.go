package repository_test

import (
	"context"
	"os"
	"testing"

	"github.com/gagan-devv/codelink/services/auth/internal/db"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

func testDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("TEST_POSTGRES_URL")
	if dsn == "" {
		dsn = "postgres://codelink:devpassword@localhost:5432/codelink"
	}
	pool, err := db.NewPostgresPool(context.Background(), dsn)
	if err != nil {
		t.Skipf("postgres unavailable (run docker compose up): %v", err)
	}
	t.Cleanup(func() { pool.Close() })
	return pool
}

func testRedis(t *testing.T) *redis.Client {
	t.Helper()
	url := os.Getenv("TEST_REDIS_URL")
	if url == "" {
		url = "redis://localhost:6379"
	}
	client, err := db.NewRedisClient(context.Background(), url)
	if err != nil {
		t.Skipf("redis unavailable (run docker compose up): %v", err)
	}
	t.Cleanup(func() { client.Close() })
	return client
}