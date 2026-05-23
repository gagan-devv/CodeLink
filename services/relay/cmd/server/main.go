package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/gagan-devv/codelink/services/relay/internal/auth"
	"github.com/gagan-devv/codelink/services/relay/internal/config"
	"github.com/gagan-devv/codelink/services/relay/internal/relay"
	"github.com/gagan-devv/codelink/services/relay/internal/session"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

func main() {
	_ = godotenv.Load("../../infra/.env")

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	validator, err := auth.NewValidator(cfg.AuthPublicKeyPEM, cfg.JWTIssuer)
	if err != nil {
		log.Fatalf("jwt validator: %v", err)
	}

	opts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("redis URL: %v", err)
	}
	rdb := redis.NewClient(opts)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("redis ping: %v", err)
	}
	log.Println("relay: redis connected")

	manager := session.NewManager()
	go manager.WatchRevocations(ctx, rdb)

	wsHandler := relay.NewHandler(manager, validator)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.Handle("/ws", wsHandler)

	srv := &http.Server{
		Addr: ":" + cfg.Port,
		Handler: mux,
	}

	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		<-sig
		log.Println("relay: shutting down...")
		cancel()
		srv.Shutdown(context.Background())
	} ()

	log.Printf("relay service listening on :%s", cfg.Port)
	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("server: %v", err)
	}
}