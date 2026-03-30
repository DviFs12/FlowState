/**
 * /api/env.js — Vercel Serverless Function
 *
 * Exposes ONLY the public Supabase vars (URL + anon key) to the browser.
 * Returns a <script> that sets window.__ENV = {...}.
 *
 * WHY a serverless function instead of hardcoding in HTML?
 * - Keeps secrets out of the source code (public GitHub repo safe)
 * - Vercel injects process.env at runtime from Dashboard env vars
 * - The anon key IS safe to expose — Supabase RLS protects the data
 * - NEVER expose SUPABASE_SERVICE_ROLE_KEY here
 */
export default function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).end('Method Not Allowed');
  }

  const url     = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Return empty env — app falls back to localStorage-only mode
    return res
      .setHeader('Content-Type', 'application/javascript')
      .setHeader('Cache-Control', 'no-store')
      .status(200)
      .send('window.__ENV = {};');
  }

  const payload = JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey });

  return res
    .setHeader('Content-Type', 'application/javascript')
    .setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
    .status(200)
    .send(`window.__ENV = ${payload};`);
}
