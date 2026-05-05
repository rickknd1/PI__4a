CREATE TABLE notifications (
    id              BIGSERIAL PRIMARY KEY,
    club_id         BIGINT NOT NULL,
    recipient_id    BIGINT NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    type            VARCHAR(50) NOT NULL,
    title           VARCHAR(255) NOT NULL,
    message         TEXT NOT NULL,
    read            BOOLEAN NOT NULL DEFAULT FALSE,
    email_sent      BOOLEAN NOT NULL DEFAULT FALSE,
    attachment_url  VARCHAR(500),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_club ON notifications(club_id);
CREATE INDEX idx_notifications_read ON notifications(read);
