-- +goose Up
CREATE TYPE session_state as ENUM ('pending', 'active', 'revoked', 'expired');

CREATE TABLE sessions (
    id                  TEXT        PRIMARY KEY,
    laptop_id           TEXT        NOT NULL REFERENCES laptops(id),
    mobile_device_id    TEXT,
    state               session_state   NOT NULL DEFAULT 'pending',
    created_at          TIMESTAMPTZ      NOT NULL DEFAULT now(),
    approved_at         TIMESTAMPTZ,
    revoked_at          TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ      NOT NULL
);

CREATE INDEX idx_sessions_laptop_id ON sessions(laptop_id);
CREATE INDEX idx_session_state      ON sessions(state);


-- +goose Down
DROP TABLE sessions;
DROP TYPE session_state;