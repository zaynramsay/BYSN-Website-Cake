#!/usr/bin/env node
//
// Converts the Apple offer-code CSV into SQL INSERT statements.
//
// Usage:
//   node seed.js /path/to/OfferCodeOneTimeUseCodes_*.csv > seed.sql
//   wrangler d1 execute cake-promo --file=seed.sql
//

const fs = require('fs');

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: node seed.js <path-to-csv>');
  process.exit(1);
}

const raw = fs.readFileSync(csvPath, 'utf8').trim();
const lines = raw.split('\n').filter(Boolean);

console.log('-- Auto-generated from offer code CSV');
console.log('-- Codes: ' + lines.length);
console.log('');
console.log('DELETE FROM promo_codes;');
console.log('');

for (const line of lines) {
  // Each line: CODE,https://apps.apple.com/redeem?...
  const code = line.split(',')[0].trim();
  if (!code) continue;
  // Escape single quotes (unlikely in codes, but safe)
  const safe = code.replace(/'/g, "''");
  console.log(`INSERT INTO promo_codes (code) VALUES ('${safe}');`);
}

console.log('');
console.log('-- Done. ' + lines.length + ' codes inserted.');
