#!/usr/bin/env node
/**
 * Zero-dependency Universal MCP Server (Stdio JSON-RPC 2.0) for AI Desktop Pet.
 * Compiled to standalone .mjs and bundled inside AI Pet.app.
 */

import readline from 'readline';

const PET_STATUS_URL = process.env.PET_STATUS_URL || 'http://127.0.0.1:4567/status';
const DEFAULT_SOURCE = process.env.PET_SOURCE || 'ai-agent';
const REQUEST_TIMEOUT_MS = 1500;

type PetState = 'idle' | 'thinking' | 'coding' | 'waiting' | 'success';

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

const SERVER_INFO = {
  name: 'ai-desktop-pet',
  version: '2.0.0',
};

const VALID_STATES = new Set<PetState>(['idle', 'thinking', 'coding', 'waiting', 'success']);

const TOOLS = [
  {
    name: 'update_pet_status',
    description:
      'Update the floating AI Desktop Pet mascot animation, speech bubble, detailed thought box, active model chip, macOS Menu Bar status, and Web Audio chime. Fails silently if the AI Pet app is not running.',
    inputSchema: {
      type: 'object',
      properties: {
        state: {
          type: 'string',
          enum: ['idle', 'thinking', 'coding', 'waiting', 'success'],
          description:
            'Visual state: idle (resting), thinking (analyzing), coding (editing/running), waiting (needs approval/answer, pins bubble + plays chime), success (task done + plays melody).',
        },
        message: {
          type: 'string',
          maxLength: 160,
          description: 'Short headline status displayed on the macOS Menu Bar and speech bubble (under 15 words).',
        },
        detail: {
          type: 'string',
          maxLength: 240,
          description: 'Optional deeper thought or step detail shown in the thought box beneath the headline.',
        },
        project: {
          type: 'string',
          maxLength: 40,
          description: 'Optional workspace or repository name shown as a compact pill badge.',
        },
        model: {
          type: 'string',
          maxLength: 48,
          description: 'Optional active AI model name (e.g. "gpt-5.5", "claude-sonnet-4", "gemini-3-pro").',
        },
        source: {
          type: 'string',
          maxLength: 32,
          description: 'Origin IDE/client badge (e.g. "antigravity", "vscode", "codex", "claude-code").',
        },
      },
      required: ['state', 'message'],
    },
  },
];

function sendMessage(msg: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}

function sendResult(id: string | number, result: Record<string, unknown>): void {
  sendMessage({ jsonrpc: '2.0', id, result });
}

function sendError(id: string | number | null, code: number, message: string): void {
  sendMessage({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handleUpdatePetStatus(args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const rawState = typeof args.state === 'string' ? args.state : 'idle';
  const state: PetState = VALID_STATES.has(rawState as PetState) ? (rawState as PetState) : 'idle';
  const message = typeof args.message === 'string' ? args.message.trim().slice(0, 160) : '';
  const detail = typeof args.detail === 'string' ? args.detail.trim().slice(0, 240) : '';
  const project = typeof args.project === 'string' ? args.project.trim().slice(0, 40) : '';
  const model = typeof args.model === 'string' ? args.model.trim().slice(0, 48) : '';
  const source =
    typeof args.source === 'string' && args.source.trim()
      ? args.source.trim().slice(0, 32)
      : DEFAULT_SOURCE;

  try {
    const res = await fetch(PET_STATUS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, message, detail, project, model, source }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      return {
        content: [{ type: 'text', text: `AI Pet app returned HTTP ${res.status} (skipped silently).` }],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Pet status updated: [${state}] (${source}) "${message}"${detail ? ` — ${detail}` : ''}`,
        },
      ],
    };
  } catch {
    return {
      content: [{ type: 'text', text: 'AI Pet app is not running (skipped silently).' }],
    };
  }
}

async function handleRequest(req: JsonRpcRequest): Promise<void> {
  const { id, method, params } = req;
  if (id === undefined || id === null) return;

  if (method === 'initialize') {
    const protocolVersion = typeof params?.protocolVersion === 'string' ? params.protocolVersion : '2024-11-05';
    sendResult(id, {
      protocolVersion,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    });
    return;
  }

  if (method === 'ping') {
    sendResult(id, {});
    return;
  }

  if (method === 'tools/list') {
    sendResult(id, { tools: TOOLS });
    return;
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    if (toolName !== 'update_pet_status') {
      sendError(id, -32601, `Unknown tool: ${String(toolName)}`);
      return;
    }
    const toolArgs = (params?.arguments as Record<string, unknown> | undefined) || {};
    const result = await handleUpdatePetStatus(toolArgs);
    sendResult(id, result);
    return;
  }

  if (method === 'resources/list') {
    sendResult(id, { resources: [] });
    return;
  }

  if (method === 'prompts/list') {
    sendResult(id, { prompts: [] });
    return;
  }

  sendError(id, -32601, `Method not found: ${String(method)}`);
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let parsed: JsonRpcRequest;
  try {
    parsed = JSON.parse(trimmed) as JsonRpcRequest;
  } catch {
    sendError(null, -32700, 'Parse error');
    return;
  }
  handleRequest(parsed).catch((err) => {
    if (parsed?.id !== undefined && parsed?.id !== null) {
      sendError(parsed.id, -32603, err instanceof Error ? err.message : 'Internal error');
    }
  });
});
