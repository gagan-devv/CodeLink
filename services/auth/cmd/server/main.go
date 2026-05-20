package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"

	"github.com/gagan-devv/codelink/services/auth/internal/config"
	authcrypto "github.com/gagan-devv/codelink/services/auth/internal/crypto"
	"github.com/gagan-devv/codelink/services/auth/internal/db"
	"github.com/gagan-devv/codelink/services/auth/internal/handlers"
	"github.com/gagan-devv/codelink/services/auth/internal/middleware"
	"github.com/gagan-devv/codelink/services/auth/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/pressly/goose/v3"
	_ "github.com/jackc/pgx/v5/stdlib"
)

func main() {
	ctx := context.Background()

	if err := godotenv.Load("../../infra/.env"); err != nil {
		log.Println("no .env file found, reading from environment")
	}
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	// Databases
	pgPool, err := db.NewPostgresPool(ctx, cfg.PostgresURL)
	if err != nil {
		log.Fatalf("postgres: %v", err)
	}
	defer pgPool.Close()

	redisClient, err := db.NewRedisClient(ctx, cfg.RedisURL)
	if err != nil {
		log.Fatalf("redis: %v", err)
	}
	defer redisClient.Close()

	// Migrations
	sqlDB, err := sql.Open("pgx", cfg.PostgresURL)
	if err != nil {
		log.Fatalf("sql.Opn: %v", err)
	}
	defer sqlDB.Close()

	goose.SetBaseFS(db.MigrationsFS)
	if err := goose.SetDialect("postgres"); err != nil {
		log.Fatalf("goose dialect: %v", err)
	}
	if err := goose.Up(sqlDB, "migrations"); err != nil {
		log.Fatalf("migrations: %v", err)
	}
	log.Println("migrations: up to date")

	// JWT Signer
	signer, err := authcrypto.NewJWTSigner(cfg.JWTPrivateKeyPEM, cfg.JWTIssuer)
	if err != nil {
		log.Fatalf("jwt signer: %v", err)
	}

	// Repositories
	laptopRepo := repository.NewLaptopRepository(pgPool)
	sessionRepo := repository.NewSessionRepository(pgPool, redisClient)

	// Handlers
	laptopHandler := handlers.NewLaptopHandler(laptopRepo)
	sessionHandler := handlers.NewSessionHandler(sessionRepo, signer, cfg)

	// Router
	r := gin.Default()
	r.Use(corsMiddleware())
	r.GET("/healthz", func(c *gin.Context) { c.Status(http.StatusOK)})

	v1 := r.Group("/v1")

	v1.POST("/laptops/register", laptopHandler.Register)

	sessions := v1.Group("/sessions")
	{
		sessions.POST("/:id/join", sessionHandler.Join)

		authed := sessions.Group("", middleware.LaptopAuth(laptopRepo))
		authed.POST("", sessionHandler.Create)
		authed.GET("/:id/status", sessionHandler.Status)
		authed.DELETE("/:id", sessionHandler.Revoke)
	}

	// Server
	addr := ":" + cfg.Port
	log.Printf("auth service listening on %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("server: %v", err)
	}
}

func corsMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Header("Access-Control-Allow-Origin",  "*")
        c.Header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        c.Header("Access-Control-Allow-Headers", "Content-Type, X-Laptop-Id, X-Laptop-Sig")

        if c.Request.Method == http.MethodOptions {
            c.AbortWithStatus(http.StatusNoContent)
            return
        }
        c.Next()
    }
}