import http from 'http';
import type { PetState, PetStatus, PetStatusInput } from '../shared/types';

export const HOST = '127.0.0.1';
export const PORT = 4567;
const MAX_BODY_BYTES = 16384;

export const VALID_STATES = new Set<PetState>(['idle', 'thinking', 'coding', 'waiting', 'success']);

export function isValidState(value: unknown): value is PetState {
  return typeof value === 'string' && VALID_STATES.has(value as PetState);
}

interface HttpServerDeps {
  getStatus: () => PetStatus;
  onStatusUpdate: (input: PetStatusInput) => PetStatus;
}

/**
 * Starts the localhost-only HTTP server that receives status updates from MCP & IDE hooks.
 */
export function createHttpServer({ getStatus, onStatusUpdate }: HttpServerDeps): http.Server {
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

      req.on('data', (chunk: Buffer) => {
        body += chunk.toString('utf8');
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
          const parsed = JSON.parse(body || '{}') as Record<string, unknown>;
          if (!parsed || typeof parsed !== 'object') {
            res.writeHead(400);
            res.end(JSON.stringify({ ok: false, error: 'Invalid JSON object' }));
            return;
          }

          if (parsed.state !== undefined && !isValidState(parsed.state)) {
            res.writeHead(400);
            res.end(
              JSON.stringify({
                ok: false,
                error: `Invalid state "${String(parsed.state)}". Expected: ${Array.from(VALID_STATES).join(', ')}`,
              })
            );
            return;
          }

          const updated = onStatusUpdate({
            state: isValidState(parsed.state) ? parsed.state : 'idle',
            message: typeof parsed.message === 'string' ? parsed.message : '',
            detail: typeof parsed.detail === 'string' ? parsed.detail : typeof parsed.thought === 'string' ? parsed.thought : '',
            project: typeof parsed.project === 'string' ? parsed.project : '',
            model: typeof parsed.model === 'string' ? parsed.model : typeof parsed.modelName === 'string' ? parsed.modelName : '',
            source: typeof parsed.source === 'string' ? parsed.source : '',
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
