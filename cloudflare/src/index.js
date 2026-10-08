/**
 * Cloudflare Worker API for Tabien-Khum Registry System
 * Powered by Cloudflare Workers KV (Ultra-fast distributed storage)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Helper to get all data
      async function getData() {
        const raw = await env.TABIEN_KHUM_KV.get('tabien_data');
        if (raw) {
          try { return JSON.parse(raw); } catch {}
        }
        return { records: [], categories: [] };
      }

      // Helper to save data
      async function setData(data) {
        await env.TABIEN_KHUM_KV.put('tabien_data', JSON.stringify(data));
      }

      // 1. GET /api/records
      if (path === '/api/records' && request.method === 'GET') {
        const data = await getData();
        return json(data);
      }

      // 2. POST /api/records (Add)
      if (path === '/api/records' && request.method === 'POST') {
        const body = await request.json();
        const data = await getData();
        const maxId = Math.max(0, ...data.records.map(r => Number(r.id) || 0));
        const newRecord = { ...body, id: maxId + 1 };
        data.records.unshift(newRecord);
        await setData(data);
        return json({ ok: true, id: newRecord.id }, 201);
      }

      // 3. PUT /api/records/:id (Update)
      const matchPut = path.match(/^\/api\/records\/(\d+)$/);
      if (matchPut && request.method === 'PUT') {
        const id = Number(matchPut[1]);
        const body = await request.json();
        const data = await getData();
        const idx = data.records.findIndex(r => Number(r.id) === id);
        if (idx < 0) {
          data.records.unshift({ ...body, id });
        } else {
          data.records[idx] = { ...body, id };
        }
        await setData(data);
        return json({ ok: true });
      }

      // 4. DELETE /api/records/:id (Delete)
      const matchDel = path.match(/^\/api\/records\/(\d+)$/);
      if (matchDel && request.method === 'DELETE') {
        const id = Number(matchDel[1]);
        const data = await getData();
        data.records = data.records.filter(r => Number(r.id) !== id);
        await setData(data);
        return json({ ok: true });
      }

      // 5. POST /api/restore (Batch upload / sync)
      if (path === '/api/restore' && request.method === 'POST') {
        const payload = await request.json();
        if (!Array.isArray(payload.records)) return json({ error: 'Invalid payload' }, 400);
        const data = {
          records: payload.records.map((r, i) => ({ ...r, id: Number(r.id) || (i + 1) })),
          categories: payload.categories || [],
        };
        await setData(data);
        return json({ ok: true, count: data.records.length });
      }

      // 6. Health check
      if (path === '/' || path === '/health') {
        return json({ service: 'tabien-khum-api', provider: 'Cloudflare Workers KV', status: 'online' });
      }

      return json({ error: 'Endpoint not found' }, 404);
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  },
};
