-- biznes_analitica: PostgreSQL sxema (server ishga tushganda avtomatik bajariladi)
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO meta (key, value) VALUES ('ver', '1') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, seq BIGSERIAL,
  type TEXT, model TEXT, color TEXT,
  size NUMERIC(16,4), wt NUMERIC(16,4), qty NUMERIC(16,4),
  cost NUMERIC(16,4), price NUMERIC(16,4), joy TEXT,
  img TEXT NOT NULL DEFAULT '', img_v BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY, seq BIGSERIAL,
  name TEXT, phone TEXT, tg TEXT
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, cid TEXT, pid TEXT,
  qty NUMERIC(16,4), price NUMERIC(16,4), cost NUMERIC(16,4),
  total NUMERIC(16,4), paid NUMERIC(16,4),
  st INTEGER, at BIGINT
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY, at BIGINT, cid TEXT, oid TEXT, amt NUMERIC(16,4), note TEXT
);
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY, at BIGINT, cat TEXT, amt NUMERIC(16,4), note TEXT
);
CREATE TABLE IF NOT EXISTS ins (
  id TEXT PRIMARY KEY, at BIGINT, pid TEXT, qty NUMERIC(16,4), cost NUMERIC(16,4)
);
CREATE TABLE IF NOT EXISTS msgs (
  id TEXT PRIMARY KEY, oid TEXT, at BIGINT, txt TEXT, auto BOOLEAN
);
CREATE INDEX IF NOT EXISTS orders_cid_idx ON orders (cid);
CREATE INDEX IF NOT EXISTS orders_at_idx ON orders (at);
CREATE INDEX IF NOT EXISTS payments_cid_idx ON payments (cid);
CREATE INDEX IF NOT EXISTS payments_at_idx ON payments (at);
CREATE INDEX IF NOT EXISTS expenses_at_idx ON expenses (at);
