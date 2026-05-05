-- ================================================
-- ClubHub - Treasury Service - Users Table (temporaire en attendant module User)
-- ================================================

CREATE TABLE users (
    id          BIGSERIAL PRIMARY KEY,
    email       VARCHAR(255) NOT NULL UNIQUE,
    first_name  VARCHAR(100) NOT NULL,
    last_name   VARCHAR(100) NOT NULL,
    role        VARCHAR(30) NOT NULL CHECK (role IN ('PRESIDENT', 'TRESORIER', 'MEMBRE_BUREAU', 'MEMBRE')),
    club_id     BIGINT NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_club_id ON users(club_id);
CREATE INDEX idx_users_email ON users(email);
