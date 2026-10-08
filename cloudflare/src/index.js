/**
 * Cloudflare Worker API for Tabien-Khum Registry System
 * Powered by Cloudflare D1 Database (Free 5 GB)
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
      // 1. GET /api/records - Retrieve all records
      if (path === '/api/records' && request.method === 'GET') {
        const query = await env.DB.prepare('SELECT id, body FROM records ORDER BY id DESC').all();
        const records = (query.results || []).map(row => {
          try {
            const parsed = JSON.parse(row.body);
            return { ...parsed, id: row.id };
          } catch {
            return { id: row.id };
          }
        });
        return json({ records, categories: [] });
      }

      // 2. POST /api/records - Add new record
      if (path === '/api/records' && request.method === 'POST') {
        const body = await request.json();
        // find max id
        const maxQuery = await env.DB.prepare('SELECT MAX(id) as max_id FROM records').first();
        const nextId = (maxQuery?.max_id || 0) + 1;
        const record = { ...body, id: nextId };
        await env.DB.prepare('INSERT INTO records (id, body) VALUES (?, ?)')
          .bind(nextId, JSON.stringify(record))
          .run();
        return json({ ok: true, id: nextId }, 201);
      }

      // 3. PUT /api/records/:id - Update record
      const matchPut = path.match(/^\/api\/records\/(\d+)$/);
      if (matchPut && request.method === 'PUT') {
        const id = Number(matchPut[1]);
        const body = await request.json();
        const record = { ...body, id };
        await env.DB.prepare('INSERT OR REPLACE INTO records (id, body, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
          .bind(id, JSON.stringify(record))
          .run();
        return json({ ok: true });
      }

      // 4. DELETE /api/records/:id - Delete record
      const matchDel = path.match(/^\/api\/records\/(\d+)$/);
      if (matchDel && request.method === 'DELETE') {
        const id = Number(matchDel[1]);
        await env.DB.prepare('DELETE FROM records WHERE id = ?').bind(id).run();
        return json({ ok: true });
      }

      // 5. POST /api/restore - Batch upload / restore records
      if (path === '/api/restore' && request.method === 'POST') {
        const payload = await request.json();
        const records = payload.records || [];
        if (!Array.isArray(records)) return json({ error: 'Invalid payload' }, 400);

        // Batch insert in chunks of 50
        const batchSize = 50;
        for (let i = 0; i < records.length; i += batchSize) {
          const chunk = records.slice(i, i + batchSize);
          const stmts = chunk.map((r, idx) => {
            const id = Number(r.id) || (i + idx + 1);
            return env.DB.prepare('INSERT OR REPLACE INTO records (id, body) VALUES (?, ?)')
              .bind(id, JSON.stringify({ ...r, id }));
          });
          await env.DB.batch(stmts);
        }
        return json({ ok: true, count: records.length });
      }

      // 6. Health check
      if (path === '/' || path === '/health') {
        return json({ service: 'tabien-khum-api', provider: 'Cloudflare D1', status: 'online' });
      }

      return json({ error: 'Endpoint not found' }, 404);
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  },
};
