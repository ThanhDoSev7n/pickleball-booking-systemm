-- =====================================================================
-- HE THONG DAT SAN PICKLEBALL - DATABASE LEVEL PHYSICAL DESIGN (Muc 4.6)
-- Thanh vien 1: Identity + Booking Context (schema nen cho toan nhom)
-- MySQL 8.x / InnoDB / REPEATABLE READ (mac dinh) / utf8mb4
--
-- Quy tac dat ten (muc 2.2.4):
--   Bang            : danh tu so nhieu, snake_case
--   Cot             : snake_case
--   PK              : [ten_bang_so_it]_id
--   FK              : fk_[bang_nguon]_[bang_dich]
--   Unique          : uk_[bang]_[cot]
--   Index           : idx_[bang]_[cot]
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
    user_id             INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    full_name           VARCHAR(120)     NOT NULL,
    email               VARCHAR(160)     NOT NULL,
    phone_number        VARCHAR(15)      NOT NULL,
    password_hash       VARCHAR(100)     NOT NULL COMMENT 'bcrypt cost >= 10, NFR-03',
    role                ENUM('CUSTOMER','STAFF','OWNER','ADMIN') NOT NULL DEFAULT 'CUSTOMER',
    is_active           TINYINT(1)       NOT NULL DEFAULT 1,
    refresh_token_hash  CHAR(64)         NULL COMMENT 'SHA-256 cua refresh token dang luu',
    created_at          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT uk_users_email        UNIQUE (email),
    CONSTRAINT uk_users_phone_number UNIQUE (phone_number)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_users_role ON users (role);

CREATE TABLE IF NOT EXISTS court_clusters (
    cluster_id   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    name         VARCHAR(150)  NOT NULL,
    address      VARCHAR(255)  NOT NULL,
    city         VARCHAR(80)   NOT NULL,
    description  TEXT          NULL,
    owner_id     INT UNSIGNED  NOT NULL,
    status       ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING'
                 COMMENT 'Admin duyet cum san moi dang ky (FR-15)',
    is_active    TINYINT(1)    NOT NULL DEFAULT 1,
    created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (cluster_id),
    CONSTRAINT fk_court_clusters_users FOREIGN KEY (owner_id) REFERENCES users (user_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_court_clusters_city   ON court_clusters (city);
CREATE INDEX idx_court_clusters_status ON court_clusters (status);

CREATE TABLE IF NOT EXISTS courts (
    court_id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    cluster_id            INT UNSIGNED  NOT NULL,
    name                  VARCHAR(100)  NOT NULL,
    court_type            ENUM('OUTDOOR','INDOOR','COMPETITION') NOT NULL DEFAULT 'OUTDOOR'
                          COMMENT 'Loai san - dau vao cua Pricing Engine (Thanh vien 2)',
    surface               VARCHAR(80)   NULL,
    opening_time          TIME          NOT NULL DEFAULT '06:00',
    closing_time          TIME          NOT NULL DEFAULT '22:00',
    slot_duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 60 COMMENT '30/60/90 phut',
    is_active             TINYINT(1)    NOT NULL DEFAULT 1,
    created_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (court_id),
    CONSTRAINT fk_courts_court_clusters FOREIGN KEY (cluster_id) REFERENCES court_clusters (cluster_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uk_courts_cluster_name UNIQUE (cluster_id, name),
    CONSTRAINT chk_courts_hours CHECK (closing_time > opening_time)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_courts_type ON courts (court_type);

-- Don dat san. Duoc tao TRƯỚC booking_slots vi booking_slots.booking_id tro sang day.
CREATE TABLE IF NOT EXISTS bookings (
    booking_id    INT UNSIGNED   NOT NULL AUTO_INCREMENT,
    booking_code  VARCHAR(20)    NOT NULL COMMENT 'VD: PKL-20261104-A7F3',
    qr_code       VARCHAR(64)    NOT NULL COMMENT 'Payload in ma QR check-in (FR-07)',
    user_id       INT UNSIGNED   NOT NULL,
    court_id      INT UNSIGNED   NOT NULL,
    cluster_id    INT UNSIGNED   NOT NULL,
    start_time    DATETIME       NOT NULL,
    end_time      DATETIME       NOT NULL,
    status        ENUM('PENDING','CONFIRMED','PAID','CHECKED_IN','COMPLETED','CANCELLED','NO_SHOW')
                  NOT NULL DEFAULT 'PENDING',
    total_amount  DECIMAL(12,2)  NULL COMMENT 'Do Pricing Engine (Thanh vien 2) dien',
    currency      CHAR(3)        NOT NULL DEFAULT 'VND',
    note          VARCHAR(255)   NULL,
    cancelled_at  DATETIME       NULL,
    cancel_reason VARCHAR(255)   NULL,
    created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (booking_id),
    CONSTRAINT fk_bookings_users           FOREIGN KEY (user_id)    REFERENCES users (user_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_bookings_courts          FOREIGN KEY (court_id)   REFERENCES courts (court_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_bookings_court_clusters  FOREIGN KEY (cluster_id) REFERENCES court_clusters (cluster_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT uk_bookings_booking_code UNIQUE (booking_code),
    CONSTRAINT uk_bookings_qr_code      UNIQUE (qr_code),
    CONSTRAINT chk_bookings_period CHECK (end_time > start_time)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_bookings_user_status   ON bookings (user_id, status);
CREATE INDEX idx_bookings_court_start   ON bookings (court_id, start_time);
CREATE INDEX idx_bookings_cluster_start ON bookings (cluster_id, start_time);
CREATE INDEX idx_bookings_status        ON bookings (status);

-- =====================================================================
-- BANG NONG NHAT (muc 4.6.1): trang thai slot + khoa giu cho
-- status + lock_expires_at + locked_by hop thanh state machine cua slot.
-- =====================================================================
CREATE TABLE IF NOT EXISTS booking_slots (
    slot_id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    court_id        INT UNSIGNED  NOT NULL,
    slot_date       DATE          NOT NULL COMMENT 'Denormal tu start_time de loc theo ngay',
    start_time      DATETIME      NOT NULL,
    end_time        DATETIME      NOT NULL,
    status          ENUM('AVAILABLE','LOCKED','BOOKED','BLOCKED') NOT NULL DEFAULT 'AVAILABLE',
    locked_by       INT UNSIGNED  NULL COMMENT 'user dang giu cho',
    lock_expires_at DATETIME      NULL COMMENT 'MAC DINH 5 PHUT (LOCK_TTL_MINUTES)',
    booking_id      INT UNSIGNED  NULL,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (slot_id),
    CONSTRAINT fk_booking_slots_courts FOREIGN KEY (court_id) REFERENCES courts (court_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_booking_slots_users FOREIGN KEY (locked_by) REFERENCES users (user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_booking_slots_bookings FOREIGN KEY (booking_id) REFERENCES bookings (booking_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    -- Lop bao ve CUOI CUNG chong double-booking, du logic ung dung co sai sot.
    CONSTRAINT uk_booking_slots_court_start UNIQUE (court_id, start_time),
    CONSTRAINT chk_booking_slots_period CHECK (end_time > start_time)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Ho tro "tim slot trong cua san X trong khoang thoi gian Y"
CREATE INDEX idx_booking_slots_start_time     ON booking_slots (start_time);
-- Ho tro cron releaseExpiredLocks chay nhanh (muc 4.7.1)
CREATE INDEX idx_booking_slots_status_expires ON booking_slots (status, lock_expires_at);
-- Ho tro tra cuu FR-01
CREATE INDEX idx_booking_slots_court_date     ON booking_slots (court_id, slot_date);

SET FOREIGN_KEY_CHECKS = 1;
