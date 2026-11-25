#!/usr/bin/env node
/**
 * Universal Hook Handler for OpenAI Codex & Claude Code.
 * Reads lifecycle events from stdin and forwards live status, thoughts, model,
 * and approval requests to AI Pet. Produces zero stdout and always exits 0.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

const PET_STATUS_URL = process.env.PET_STATUS_URL || 'http://127.0.0.1:4567/status';
const DEFAULT_SOURCE = process.env.PET_SOURCE || 'codex';
const TIMEOUT_MS = 1200;

interface AgentHookPayload {
  hook_event_name?: string;
  event?: string;
  session_id?: string;
  conversation_id?: string;
  tool_name?: string;
  tool?: string;
  tool_input?: Record<string, unknown>;
  input?: Record<string, unknown>;
  cwd?: string;
  model?: string;
  model_name?: string;
  modelName?: string;
  title?: string;
  message?: string;
  last_assistant_message?: string;
}

interface MappedStatus {
  state: 'idle' | 'thinking' | 'coding' | 'waiting' | 'success';
  message: string;
  project: string;
}

function compact(str: unknown, maxLen = 140): string {
  const clean = String(str ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1)}…`;
}

function extractModel(payload: AgentHookPayload): string {
  const direct = payload.model || payload.model_name || payload.modelName || '';
  if (typeof direct === 'string' && direct.trim()) {
    return compact(direct.trim(), 36);
  }
  if (DEFAULT_SOURCE === 'codex') {
    try {
      const toml = fs.readFileSync(path.join(os.homedir(), '.codex', 'config.toml'), 'utf8');
      const match = toml.match(/^\s*model\s*=\s*"([^"]+)"/m);
      if (match?.[1]) return compact(match[1], 36);
    } catch {
      // ignore
    }
  }
  return '';
}

function extractProject(payload: AgentHookPayload): string {
  const dir = payload.cwd || '';
  if (!dir || typeof dir !== 'string') return '';
  return compact(path.basename(dir.replace(/\/+$/, '')), 32);
}

function extractSessionId(payload: AgentHookPayload): string {
  const raw = payload.session_id || payload.conversation_id || payload.cwd || '';
  if (typeof raw === 'string' && raw.trim()) {
    return `${DEFAULT_SOURCE}:${raw.trim().slice(-64)}`;
  }
  return `${DEFAULT_SOURCE}:default`;
}

function extractCommand(input: Record<string, unknown>): string {
  const raw = input.command || input.cmd || input.script || '';
  if (typeof raw !== 'string') return '';
  const firstLine = raw.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || '';
  return compact(firstLine, 120);
}

function extractFileInfo(input: Record<string, unknown>, cwd: string): { base: string; rel: string } {
  const raw = input.file_path || input.path || input.target_file || input.filename || '';
  if (typeof raw !== 'string' || !raw.trim()) return { base: '', rel: '' };
  const trimmed = raw.trim();
  const base = compact(path.basename(trimmed), 28);
  let rel = base;
  if (cwd && trimmed.startsWith(cwd)) {
    const r = path.relative(cwd, trimmed);
    if (r && !r.startsWith('..')) rel = compact(r, 70);
  }
  return { base, rel };
}

function extractQuery(input: Record<string, unknown>): string {
  const raw = input.pattern || input.query || input.search || input.q || '';
  return typeof raw === 'string' ? compact(raw, 100) : '';
}

function looksLikeQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const tail = trimmed.slice(-140);
  if (tail.endsWith('?') || tail.endsWith('？')) return true;
  return /(ไหมครับ|ไหมคะ|มั้ย|หรือเปล่า|ดีไหม|ช่วยเลือก|ยืนยันไหม)\s*$/.test(tail);
}

function mapHookToStatus(payload: AgentHookPayload): MappedStatus | null {
  const event = String(payload.hook_event_name || payload.event || '').trim();
  const toolName = String(payload.tool_name || payload.tool || '').trim();
  const toolLower = toolName.toLowerCase();
  const toolInput = payload.tool_input || payload.input || {};
  const cwd = payload.cwd || '';
  const project = extractProject(payload);

  if (toolLower.includes('update_pet_status') || toolLower.includes('ai-desktop-pet')) {
    return null;
  }

  if (event === 'PermissionRequest') {
    const cmd = extractCommand(toolInput);
    const { base } = extractFileInfo(toolInput, cwd);

    if (cmd) {
      return {
        state: 'waiting',
        message: `Approve: ${compact(cmd, 28)}`,
        project,
      };
    }
    if (base) {
      return {
        state: 'waiting',
        message: `Approve edit: ${base}`,
        project,
      };
    }
    return {
      state: 'waiting',
      message: toolName ? `Approval needed (${compact(toolName, 20)})` : 'Approval needed!',
      project,
    };
  }

  if (event === 'UserPromptSubmit') {
    return {
      state: 'thinking',
      message: 'Analyzing request...',
      project,
    };
  }

  if (event === 'PreToolUse') {
    const cmd = extractCommand(toolInput);
    const { base } = extractFileInfo(toolInput, cwd);
    const query = extractQuery(toolInput);

    const isShell = /bash|shell|exec|command|terminal|run/.test(toolLower) || Boolean(cmd);
    if (isShell) {
      return {
        state: 'coding',
        message: cmd ? `Running: ${compact(cmd, 28)}` : 'Running command...',
        project,
      };
    }

    const isEdit = /edit|write|patch|create|delete|replace|notebook/.test(toolLower);
    if (isEdit) {
      return {
        state: 'coding',
        message: base ? `Editing ${base}` : 'Writing code...',
        project,
      };
    }

    return {
      state: 'thinking',
      message: base ? `Reading ${base}` : query ? 'Searching codebase...' : 'Inspecting codebase...',
      project,
    };
  }

  if (event === 'Notification') {
    const title = compact(payload.title || '', 44);
    return {
      state: 'waiting',
      message: title || 'Needs your attention!',
      project,
    };
  }

  if (event === 'Stop') {
    const lastMsg = String(payload.last_assistant_message || payload.message || '').trim();
    if (looksLikeQuestion(lastMsg)) {
      return {
        state: 'waiting',
        message: 'Question waiting for reply!',
        project,
      };
    }
    return {
      state: 'success',
      message: 'All done!',
      project,
    };
  }

  return null;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString('utf8').trim();
}

async function main(): Promise<void> {
  let raw = '';
  try {
    raw = await readStdin();
  } catch {
    process.exit(0);
  }

  let payload: AgentHookPayload = {};
  if (raw) {
    try {
      payload = JSON.parse(raw) as AgentHookPayload;
    } catch {
      process.exit(0);
    }
  }

  const mapped = mapHookToStatus(payload);
  if (!mapped) {
    process.exit(0);
    return;
  }

  try {
    await fetch(PET_STATUS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: mapped.state,
        message: mapped.message,
        detail: '',
        project: mapped.project || '',
        model: extractModel(payload),
        source: DEFAULT_SOURCE,
        sessionId: extractSessionId(payload),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Silent fallback when AI Pet app is not running
  }

  process.exit(0);
}

main();
