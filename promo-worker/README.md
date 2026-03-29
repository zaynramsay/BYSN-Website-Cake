# Cake Promo Code Worker

A Cloudflare Worker that securely distributes Apple App Store promo codes one at a time. Codes are stored server-side in a D1 (SQLite) database and are never exposed to the client.

## Security Model

- **Codes stay server-side** — the client never sees the full list, only one code per request
- **Cloudflare Turnstile** (optional) — free, privacy-respecting bot protection
- **CORS** — locked to `cake.bysnapps.com` so only your site can call the API
- **One-time use** — Apple enforces each code can only be redeemed once
- **No user data collected** — no accounts, no tracking, no cookies

## Prerequisites

- A free [Cloudflare account](https://dash.cloudflare.com/sign-up)
- Node.js 18+
- The promo code CSV from App Store Connect

## Setup (one-time, ~10 minutes)

### 1. Install Wrangler (Cloudflare CLI)

```bash
npm install
npx wrangler login
```

### 2. Create the D1 database

```bash
npx wrangler d1 create cake-promo
```

Copy the `database_id` from the output and paste it into `wrangler.toml`:

```toml
database_id = "paste-your-id-here"
```

### 3. Create the table

```bash
npx wrangler d1 execute cake-promo --file=schema.sql
```

### 4. Seed the codes

```bash
node seed.js /path/to/OfferCodeOneTimeUseCodes_*.csv > seed.sql
npx wrangler d1 execute cake-promo --file=seed.sql
```

### 5. Deploy the Worker

```bash
npx wrangler deploy
```

The output will show your worker URL, e.g. `https://cake-promo.YOUR_SUBDOMAIN.workers.dev`

### 6. Update the promo page

Open `../promo/index.html` and set `WORKER_URL` in the `CONFIG` object:

```js
const CONFIG = {
  WORKER_URL: 'https://cake-promo.YOUR_SUBDOMAIN.workers.dev',
  TURNSTILE_SITE_KEY: '', // see optional step below
};
```

Commit and push the updated `promo/index.html` to GitHub Pages.

## Optional: Add Turnstile (bot protection)

Turnstile is Cloudflare's free, privacy-first CAPTCHA alternative. It runs invisibly for most users.

1. Go to [Cloudflare Dashboard → Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile)
2. Add a site, set domain to `cake.bysnapps.com`
3. Choose **Managed** widget mode
4. Copy the **Site Key** into `CONFIG.TURNSTILE_SITE_KEY` in `promo/index.html`
5. Set the **Secret Key** as a Worker secret:

```bash
npx wrangler secret put TURNSTILE_SECRET
# Paste the secret key when prompted
```

## API Endpoints

| Method | Path      | Description                          |
|--------|-----------|--------------------------------------|
| GET    | `/status` | Returns `{ remaining: N }` (cached 30s) |
| POST   | `/claim`  | Claims one code. Body: `{ token?: string }` |

### Claim response shapes

**Success:**
```json
{ "url": "https://apps.apple.com/redeem?ctx=offercodes&id=...&code=..." }
```

**All codes claimed:**
```json
{ "exhausted": true }
```

**Error:**
```json
{ "error": "verification_failed" }
```

## Local Development

```bash
npx wrangler dev
```

Set `ALLOWED_ORIGIN` to `*` in `wrangler.toml` during development, and update `WORKER_URL` in the HTML to `http://localhost:8787`.

## Adding More Codes Later

1. Get a new CSV from App Store Connect
2. Run the seed script (it clears and re-inserts all codes):
   ```bash
   node seed.js /path/to/new-codes.csv > seed.sql
   npx wrangler d1 execute cake-promo --file=seed.sql
   ```

> **Note:** The seed script runs `DELETE FROM promo_codes` first. If you want to _append_ codes without clearing existing ones, remove that line from the generated SQL before executing.
