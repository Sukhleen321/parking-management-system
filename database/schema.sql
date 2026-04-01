-- ============================================================
--  ParkSmart – PostgreSQL Schema
--  Run against your Supabase / PostgreSQL database
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── vehicle_types ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_types (
    id             SERIAL PRIMARY KEY,
    type_name      VARCHAR(50)    NOT NULL UNIQUE,   -- bike | car | truck
    price_per_hour NUMERIC(10, 2) NOT NULL,
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ─── vehicles ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
    id               SERIAL PRIMARY KEY,
    vehicle_number   VARCHAR(20)  NOT NULL UNIQUE,
    vehicle_type_id  INTEGER      NOT NULL REFERENCES vehicle_types(id),
    owner_name       VARCHAR(100),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_number ON vehicles(vehicle_number);

-- ─── parking_slots ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parking_slots (
    id           SERIAL PRIMARY KEY,
    slot_number  VARCHAR(20) NOT NULL UNIQUE,
    slot_type    VARCHAR(20) NOT NULL,   -- bike | car | truck
    is_occupied  BOOLEAN     NOT NULL DEFAULT FALSE,
    floor_number INTEGER     NOT NULL DEFAULT 1
);

-- ─── parking_records ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parking_records (
    id         SERIAL PRIMARY KEY,
    vehicle_id INTEGER        NOT NULL REFERENCES vehicles(id),
    slot_id    INTEGER        NOT NULL REFERENCES parking_slots(id),
    entry_time TIMESTAMPTZ    NOT NULL,
    exit_time  TIMESTAMPTZ,
    total_hours FLOAT,
    fee         NUMERIC(10, 2),
    status      VARCHAR(20)   NOT NULL DEFAULT 'active'   -- active | completed
);

CREATE INDEX IF NOT EXISTS idx_records_vehicle  ON parking_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_records_slot     ON parking_records(slot_id);
CREATE INDEX IF NOT EXISTS idx_records_status   ON parking_records(status);
CREATE INDEX IF NOT EXISTS idx_records_entry    ON parking_records(entry_time);

-- ─── payments ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
    id                SERIAL PRIMARY KEY,
    parking_record_id INTEGER        NOT NULL REFERENCES parking_records(id),
    amount            NUMERIC(10, 2) NOT NULL,
    payment_method    VARCHAR(20)    NOT NULL,  -- cash | upi | card
    payment_time      TIMESTAMPTZ    NOT NULL,
    status            VARCHAR(20)    NOT NULL DEFAULT 'completed'
);

-- ─── users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(200) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'staff',   -- admin | staff
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Seed Data ────────────────────────────────────────────────
INSERT INTO vehicle_types (type_name, price_per_hour) VALUES
    ('bike',  20.00),
    ('car',   50.00),
    ('truck', 100.00)
ON CONFLICT (type_name) DO NOTHING;

-- Floor 1: Bikes B01-B10
INSERT INTO parking_slots (slot_number, slot_type, floor_number)
SELECT 'B' || LPAD(n::TEXT, 2, '0'), 'bike', 1
FROM generate_series(1, 10) AS n
ON CONFLICT (slot_number) DO NOTHING;

-- Floor 1: Cars C01-C10
INSERT INTO parking_slots (slot_number, slot_type, floor_number)
SELECT 'C' || LPAD(n::TEXT, 2, '0'), 'car', 1
FROM generate_series(1, 10) AS n
ON CONFLICT (slot_number) DO NOTHING;

-- Floor 2: Cars C11-C20
INSERT INTO parking_slots (slot_number, slot_type, floor_number)
SELECT 'C' || LPAD(n::TEXT, 2, '0'), 'car', 2
FROM generate_series(11, 20) AS n
ON CONFLICT (slot_number) DO NOTHING;

-- Floor 2: Trucks T01-T05
INSERT INTO parking_slots (slot_number, slot_type, floor_number)
SELECT 'T' || LPAD(n::TEXT, 2, '0'), 'truck', 2
FROM generate_series(1, 5) AS n
ON CONFLICT (slot_number) DO NOTHING;
