/**
 * /api/env.js — Vercel Serverless Function
 *
 * FIXES vs versão anterior:
 *  - Adicionado CORS header para evitar bloqueio em dev local
 *  - Adicionado Pragma: no-cache para proxies intermediários
 *  - Validação mais robusta das env vars (trim + length check)
 *  - Comentário explícito: NUNCA expor SUPABASE_SERVICE_ROLE_KEY aqui
 */
export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).end('Method Not Allowed');
  }

  // Headers de segurança e cache
  res.setHeader('Content-Type',  'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma',        'no-cache');
  res.setHeader('Expires',       '0');
  // Permite que o browser da Vercel faça a requisição (mesmo origin na prod)
  res.setHeader('Access-Control-Allow-Origin', '*');

  const url  = (process.env.SUPABASE_URL     || '').trim();
  const key  = (process.env.SUPABASE_ANON_KEY || '').trim();

  // Validação: URL deve começar com https e key deve ter comprimento razoável
  const valid = url.startsWith('https://') && key.length > 20;

  if (!valid) {
    // Retorna objeto vazio — supabase.js detecta e ativa modo offline
    return res.status(200).send('window.__ENV = {};');
  }

  const payload = JSON.stringify({
    SUPABASE_URL:      url,
    SUPABASE_ANON_KEY: key
    // NUNCA adicionar SUPABASE_SERVICE_ROLE_KEY aqui
  });

  return res.status(200).send(`window.__ENV = ${payload};`);
}
