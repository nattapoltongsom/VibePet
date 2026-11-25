#!/usr/bin/env node
/**
 * Universal Hook Handler for OpenAI Codex & Claude Code.
 * Reads snake_case lifecycle hook events from stdin (UserPromptSubmit, PreToolUse,
 * PermissionRequest, Notification, Stop) and forwards live status updates to AI Pet.
 * Produces zero stdout and always exits 0 so it never interferes with the agent loop.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

const PET_STATUS_URL = process.env.PET_STATUS_URL || 'http://127.0.0.1:4567/status';
const DEFAULT_SOURCE = process.env.PET_SOURCE || 'codex';
const TIMEOUT_MS = 1200;

function extractModel(payload) {
  const direct = payload?.model || payload?.model_name || payload?.modelName || '';
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

function compact(str, maxLen = 140) {
  const clean = String(str || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1)}…`;
}

function extractProject(payload) {
  const dir = payload?.cwd || '';
  if (!dir || typeof dir !== 'string') return '';
  return compact(path.basename(dir.replace(/\/+$/, '')), 32);
}

function extractCommand(input) {
  if (!input || typeof input !== 'object') return '';
  const raw = input.command || input.cmd || input.script || '';
  if (typeof raw !== 'string') return '';
  const firstLine = raw.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || '';
  return compact(firstLine, 120);
}

function extractFileInfo(input, cwd) {
  if (!input || typeof input !== 'object') return { base: '', rel: '' };
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

function extractQuery(input) {
  if (!input || typeof input !== 'object') return '';
  const raw = input.pattern || input.query || input.search || input.q || '';
  return typeof raw === 'string' ? compact(raw, 100) : '';
}

function looksLikeQuestion(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return false;
  const tail = trimmed.slice(-140);
  if (tail.endsWith('?') || tail.endsWith('？')) return true;
  return /(ไหมครับ|ไหมคะ|มั้ย|หรือเปล่า|ดีไหม|ช่วยเลือก|ยืนยันไหม)\s*$/.test(tail);
}

function mapHookToStatus(payload) {
  const event = String(payload?.hook_event_name || payload?.event || '').trim();
  const toolName = String(payload?.tool_name || payload?.tool || '').trim();
  const toolLower = toolName.toLowerCase();
  const toolInput = payload?.tool_input || payload?.input || {};
  const cwd = payload?.cwd || '';
  const project = extractProject(payload);

  if (toolLower.includes('update_pet_status') || toolLower.includes('ai-desktop-pet')) {
    return null;
  }

  if (event === 'PermissionRequest') {
    const cmd = extractCommand(toolInput);
    const { base, rel } = extractFileInfo(toolInput, cwd);
    const reason = compact(toolInput?.description || payload?.reason || '', 80);

    if (cmd) {
      return {
        state: 'waiting',
        message: `Approve needed: ${compact(cmd, 28)}`,
        detail: reason ? `${reason} -> ${cmd}` : `Command: ${cmd}`,
        project,
      };
    }
    if (base) {
      return {
        state: 'waiting',
        message: `Approve edit: ${base}`,
        detail: reason ? `${reason} (${rel})` : `File: ${rel}`,
        project,
      };
    }
    return {
      state: 'waiting',
      message: toolName ? `Approval needed (${compact(toolName, 20)})` : 'Approval needed!',
      detail: reason || 'Waiting for your confirmation to continue.',
      project,
    };
  }

  if (event === 'UserPromptSubmit') {
    const promptText = compact(payload?.prompt || payload?.user_prompt || payload?.message || '', 130);
    return {
      state: 'thinking',
      message: 'Analyzing your request...',
      detail: promptText ? `Task: ${promptText}` : 'Planning next steps...',
      project,
    };
  }

  if (event === 'PreToolUse') {
    const cmd = extractCommand(toolInput);
    const { base, rel } = extractFileInfo(toolInput, cwd);
    const query = extractQuery(toolInput);
    const desc = compact(toolInput?.description || '', 80);

    const isShell = /bash|shell|exec|command|terminal|run/.test(toolLower) || Boolean(cmd);
    if (isShell) {
      return {
        state: 'coding',
        message: cmd ? `Running: ${compact(cmd, 26)}` : 'Running terminal command...',
        detail: desc ? `${desc} -> ${cmd}` : cmd ? `Command: ${cmd}` : 'Executing command',
        project,
      };
    }

    const isEdit = /edit|write|patch|create|delete|replace|notebook/.test(toolLower);
    if (isEdit) {
      return {
        state: 'coding',
        message: base ? `Editing ${base}` : 'Writing code...',
        detail: desc || (rel ? `File: ${rel}` : 'Updating project files'),
        project,
      };
    }

    return {
      state: 'thinking',
      message: base ? `Reading ${base}` : query ? `Searching: ${compact(query, 24)}` : 'Inspecting codebase...',
      detail: query ? `Query: "${query}"` : rel ? `File: ${rel}` : desc,
      project,
    };
  }

  if (event === 'Notification') {
    const title = compact(payload?.title || '', 44);
    const msg = compact(payload?.message || '', 140);
    return {
      state: 'waiting',
      message: title || 'Needs your attention!',
      detail: msg || 'Waiting for your response.',
      project,
    };
  }

  if (event === 'Stop') {
    const lastMsg = String(payload?.last_assistant_message || payload?.message || '').trim();
    const preview = compact(lastMsg.replace(/[#*`>_]+/g, ' '), 140);
    if (looksLikeQuestion(lastMsg)) {
      return {
        state: 'waiting',
        message: 'Question waiting for your reply!',
        detail: preview,
        project,
      };
    }
    return {
      state: 'success',
      message: 'All done!',
      detail: preview,
      project,
    };
  }

  return null;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').trim();
}

async function main() {
  let raw = '';
  try {
    raw = await readStdin();
  } catch {
    process.exit(0);
  }

  let payload = {};
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      process.exit(0);
    }
  }

  const mapped = mapHookToStatus(payload);
  if (!mapped) process.exit(0);

  try {
    await fetch(PET_STATUS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: mapped.state,
        message: mapped.message,
        detail: mapped.detail || '',
        project: mapped.project || '',
        model: extractModel(payload),
        source: DEFAULT_SOURCE,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Silent fallback when AI Pet app is not running
  }

  process.exit(0);
}

main();
