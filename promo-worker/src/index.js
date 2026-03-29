export default {
  async fetch(request, env) {
    const ALLOWED_ORIGIN = env.ALLOWED_ORIGIN || 'https://cake.bysnapps.com';
    const origin = request.headers.get('Origin') || '';

    // Only allow requests from the configured origin (or any origin in dev)
    const isAllowed = ALLOWED_ORIGIN === '*' || origin === ALLOWED_ORIGIN;
    const corsOrigin = isAllowed ? origin : ALLOWED_ORIGIN;

    const corsHeaders = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      // GET /status — how many codes remain (cached 30s)
      if (url.pathname === '/status' && request.method === 'GET') {
        const row = await env.DB.prepare(
          'SELECT COUNT(*) as remaining FROM promo_codes WHERE redeemed = 0'
        ).first();

        return Response.json(
          { remaining: row?.remaining ?? 0 },
          {
            headers: {
              ...corsHeaders,
              'Cache-Control': 'public, max-age=30',
            },
          }
        );
      }

      // POST /claim — claim one promo code
      if (url.pathname === '/claim' && request.method === 'POST') {
        // Reject if origin doesn't match (defense in depth beyond CORS)
        if (!isAllowed) {
          return Response.json(
            { error: 'forbidden' },
            { status: 403, headers: corsHeaders }
          );
        }

        // Reject non-Apple devices (defense in depth — client checks too)
        const ua = request.headers.get('User-Agent') || '';
        const isAppleUA = /iPhone|iPad|iPod|Macintosh|Mac OS/i.test(ua);
        if (!isAppleUA) {
          return Response.json(
            { error: 'apple_device_required' },
            { status: 403, headers: corsHeaders }
          );
        }

        const body = await request.json().catch(() => ({}));

        // Verify Turnstile token (if configured)
        if (env.TURNSTILE_SECRET) {
          const token = body.token;
          if (!token) {
            return Response.json(
              { error: 'verification_required' },
              { status: 400, headers: corsHeaders }
            );
          }

          const formData = new FormData();
          formData.append('secret', env.TURNSTILE_SECRET);
          formData.append('response', token);

          const ip = request.headers.get('CF-Connecting-IP');
          if (ip) formData.append('remoteip', ip);

          const verifyRes = await fetch(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            { method: 'POST', body: formData }
          );
          const verify = await verifyRes.json();

          if (!verify.success) {
            return Response.json(
              { error: 'verification_failed' },
              { status: 403, headers: corsHeaders }
            );
          }
        }

        // Atomically claim the next available code (random order)
        const result = await env.DB.prepare(`
          UPDATE promo_codes SET redeemed = 1
          WHERE id = (
            SELECT id FROM promo_codes WHERE redeemed = 0 ORDER BY RANDOM() LIMIT 1
          )
          RETURNING code
        `).first();

        if (!result) {
          return Response.json({ exhausted: true }, { headers: corsHeaders });
        }

        const redemptionUrl =
          `https://apps.apple.com/redeem?ctx=offercodes&id=6743376594&code=${result.code}`;

        return Response.json(
          { url: redemptionUrl },
          { headers: corsHeaders }
        );
      }

      // Fallback
      return Response.json(
        { error: 'not_found' },
        { status: 404, headers: corsHeaders }
      );
    } catch (err) {
      console.error('Worker error:', err);
      return Response.json(
        { error: 'internal_error' },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
