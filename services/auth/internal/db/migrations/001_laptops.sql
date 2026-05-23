-- +goose Up
CREATE TABLE laptops (
    id              TEXT PRIMARY KEY,
    public_key_pem  TEXT        NOT NULL UNIQUE,
    registered_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_seen_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE laptops;