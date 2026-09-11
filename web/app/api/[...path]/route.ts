import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const API = process.env.API_INTERNAL_URL || 'http://localhost:4000';

async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/');
  const search = new URL(req.url).search;
  const url = `${API}/api/${path}${search}`;
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!['host', 'connection', 'content-length'].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  let body: string | undefined;
  if (!['GET', 'HEAD'].includes(req.method)) {
    body = await req.text();
  }
  const res = await fetch(url, { method: req.method, headers, body, cache: 'no-store' });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') || 'application/json; charset=utf-8' },
  });
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
