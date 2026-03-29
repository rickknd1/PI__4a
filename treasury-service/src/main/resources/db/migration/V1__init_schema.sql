-- ================================================
-- ClubHub - Treasury Service - Schema Initial
-- ================================================

CREATE TABLE cotisation_rules (
    id                  BIGSERIAL PRIMARY KEY,
    club_id             BIGINT NOT NULL,
    name                VARCHAR(255) NOT NULL,
    amount              NUMERIC(10, 3) NOT NULL,
    frequency           VARCHAR(20) NOT NULL CHECK (frequency IN ('MONTHLY', 'QUARTERLY', 'ANNUAL')),
    start_date          DATE NOT NULL,
    end_date            DATE,
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    allow_exemption     BOOLEAN NOT NULL DEFAULT FALSE,
    allow_installments  BOOLEAN NOT NULL DEFAULT FALSE,
    max_installments    INTEGER,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
    id                        BIGSERIAL PRIMARY KEY,
    member_id                 BIGINT NOT NULL,
    club_id                   BIGINT NOT NULL,
    cotisation_rule_id        BIGINT REFERENCES cotisation_rules(id),
    amount                    NUMERIC(10, 3) NOT NULL,
    status                    VARCHAR(30) NOT NULL DEFAULT 'PENDING'
                              CHECK (status IN ('PENDING','PAID','LATE','REFUNDED','PARTIALLY_REFUNDED','FAILED','EXEMPT')),
    due_date                  DATE NOT NULL,
    paid_at                   TIMESTAMP,
    stripe_payment_intent_id  VARCHAR(255),
    stripe_receipt_url        VARCHAR(500),
    installment_number        INTEGER,
    total_installments        INTEGER,
    created_at                TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE expenses (
    id                              BIGSERIAL PRIMARY KEY,
    club_id                         BIGINT NOT NULL,
    submitted_by_member_id          BIGINT NOT NULL,
    validated_by_treasurer_id       BIGINT,
    approved_by_president_id        BIGINT,
    title                           VARCHAR(255) NOT NULL,
    description                     TEXT,
    amount                          NUMERIC(10, 3) NOT NULL,
    status                          VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED'
                                    CHECK (status IN ('SUBMITTED','VALIDATED','APPROVED','REJECTED','CANCELLED')),
    category                        VARCHAR(50),
    category_confidence_score       INTEGER CHECK (category_confidence_score BETWEEN 0 AND 100),
    category_validated_by_treasurer BOOLEAN NOT NULL DEFAULT FALSE,
    justificatif_url                VARCHAR(500),
    submitted_at                    TIMESTAMP,
    validated_at                    TIMESTAMP,
    approved_at                     TIMESTAMP,
    rejection_reason                VARCHAR(500),
    created_at                      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE budgets (
    id               BIGSERIAL PRIMARY KEY,
    club_id          BIGINT NOT NULL,
    label            VARCHAR(255) NOT NULL,
    total_amount     NUMERIC(10, 3) NOT NULL,
    consumed_amount  NUMERIC(10, 3) NOT NULL DEFAULT 0,
    period_start     DATE NOT NULL,
    period_end       DATE NOT NULL,
    alert_50_sent    BOOLEAN NOT NULL DEFAULT FALSE,
    alert_75_sent    BOOLEAN NOT NULL DEFAULT FALSE,
    alert_90_sent    BOOLEAN NOT NULL DEFAULT FALSE,
    alert_100_sent   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE receipts (
    id             BIGSERIAL PRIMARY KEY,
    payment_id     BIGINT NOT NULL REFERENCES payments(id),
    receipt_number VARCHAR(50) NOT NULL UNIQUE,
    file_path      VARCHAR(500) NOT NULL,
    member_name    VARCHAR(255) NOT NULL,
    club_name      VARCHAR(255) NOT NULL,
    generated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Audit log : IMMUABLE (pas de UPDATE, pas de DELETE via app)
CREATE TABLE audit_logs (
    id            BIGSERIAL PRIMARY KEY,
    actor_id      BIGINT NOT NULL,
    actor_email   VARCHAR(255) NOT NULL,
    club_id       BIGINT NOT NULL,
    action        VARCHAR(50) NOT NULL,
    entity_type   VARCHAR(50) NOT NULL,
    entity_id     BIGINT NOT NULL,
    values_before TEXT,
    values_after  TEXT,
    amount        NUMERIC(10, 3),
    ip_address    VARCHAR(45),
    timestamp     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index pour les requetes frequentes
CREATE INDEX idx_payments_member_id     ON payments(member_id);
CREATE INDEX idx_payments_club_id       ON payments(club_id);
CREATE INDEX idx_payments_status        ON payments(status);
CREATE INDEX idx_payments_due_date      ON payments(due_date);
CREATE INDEX idx_expenses_club_id       ON expenses(club_id);
CREATE INDEX idx_expenses_status        ON expenses(status);
CREATE INDEX idx_budgets_club_id        ON budgets(club_id);
CREATE INDEX idx_audit_logs_club_id     ON audit_logs(club_id);
CREATE INDEX idx_audit_logs_entity      ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_timestamp   ON audit_logs(timestamp);
