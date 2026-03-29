CREATE TABLE IF NOT EXISTS promo_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  redeemed INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_unclaimed ON promo_codes(redeemed) WHERE redeemed = 0;
