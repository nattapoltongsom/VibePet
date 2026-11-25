const http = require('http');

const HOST = '127.0.0.1';
const PORT = 4567;
const MAX_BODY_BYTES = 16384;
const VALID_STATES = new Set(['idle', 'thinking', 'coding', 'waiting', 'success']);

/**
 * Starts the localhost-only HTTP server that receives status updates from MCP & IDE hooks.
 */
function createHttpServer({ getStatus, onStatusUpdate }) {
  const server = http.createServer((req, res) => {
    const urlPath = (req.url || '/').split('?')[0];
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (req.method === 'GET' && (urlPath === '/health' || urlPath === '/status')) {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, status: getStatus() }));
      return;
    }

    if (req.method === 'POST' && urlPath === '/status') {
      let body = '';
      let aborted = false;

      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > MAX_BODY_BYTES) {
          aborted = true;
          res.writeHead(413);
          res.end(JSON.stringify({ ok: false, error: 'Payload too large' }));
          req.destroy();
        }
      });

      req.on('end', () => {
        if (aborted) return;

        try {
          const parsed = JSON.parse(body || '{}');
          if (!parsed || typeof parsed !== 'object') {
            res.writeHead(400);
            res.end(JSON.stringify({ ok: false, error: 'Invalid JSON object' }));
            return;
          }

          if (parsed.state && !VALID_STATES.has(parsed.state)) {
            res.writeHead(400);
            res.end(
              JSON.stringify({
                ok: false,
                error: `Invalid state "${parsed.state}". Expected: ${Array.from(VALID_STATES).join(', ')}`,
              })
            );
            return;
          }

          const updated = onStatusUpdate({
            state: parsed.state || 'idle',
            message: parsed.message || '',
            detail: parsed.detail || parsed.thought || '',
            project: parsed.project || '',
            model: parsed.model || parsed.modelName || '',
            source: parsed.source || '',
          });

          res.writeHead(200);
          res.end(JSON.stringify({ ok: true, status: updated }));
        } catch {
          res.writeHead(400);
          res.end(JSON.stringify({ ok: false, error: 'Invalid JSON payload' }));
        }
      });

      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ ok: false, error: 'Not found' }));
  });

  server.on('error', (err) => {
    console.error(`[AI Pet HTTP] Error on ${HOST}:${PORT}:`, err.message);
  });

  server.listen(PORT, HOST, () => {
    console.log(`[AI Pet HTTP] Listening at http://${HOST}:${PORT}/status`);
  });

  return server;
}

module.exports = {
  HOST,
  PORT,
  VALID_STATES,
  createHttpServer,
};
