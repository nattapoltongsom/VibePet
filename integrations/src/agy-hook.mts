#!/usr/bin/env node
/**
 * Antigravity Lifecycle Hook for AI Desktop Pet.
 * Reads camelCase hook payloads from stdin, forwards live thoughts/model/approval status
 * to AI Pet over localhost HTTP, and outputs the required JSON hook decision to stdout.
 */

import path from 'path';

const PET_STATUS_URL = process.env.PET_STATUS_URL || 'http://127.0.0.1:4567/status';
const DEFAULT_SOURCE = process.env.PET_SOURCE || 'antigravity';
const TIMEOUT_MS = 1200;

interface HookPayload {
  hookEventName?: string;
  invocationNum?: number;
  cwd?: string;
  workspacePaths?: string[];
  transcriptPath?: string;
  artifactDirectoryPath?: string;
  modelName?: string;
  model?: string;
  error?: string;
  terminationReason?: string;
  toolCall?: {
    name?: string;
    args?: Record<string, unknown>;
  };
}

interface MappedStatus {
  state: 'idle' | 'thinking' | 'coding' | 'waiting' | 'success';
  message: string;
  project: string;
}

interface HookResult {
  status: MappedStatus | null;
  output: Record<string, unknown>;
}

function compact(str: unknown, maxLen = 100): string {
  const clean = String(str ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1)}…`;
}

function formatModelName(raw: unknown): string {
  const cleaned = String(raw ?? '').trim();
  if (!cleaned || cleaned.toLowerCase() === 'auto') return '';
  return compact(cleaned.replace(/^models\//i, ''), 36);
}

function extractProject(payload: HookPayload): string {
  const dir = payload.cwd || (Array.isArray(payload.workspacePaths) ? payload.workspacePaths[0] : '');
  if (!dir || typeof dir !== 'string') return '';
  return compact(path.basename(dir.replace(/\/+$/, '')), 32);
}

function extractSessionId(payload: HookPayload): string {
  if (payload.transcriptPath && typeof payload.transcriptPath === 'string') {
    const parts = payload.transcriptPath.split(path.sep).filter(Boolean);
    const tail = parts.slice(-3).join('/');
    if (tail) return `agy:${tail.slice(-64)}`;
  }
  const dir = payload.cwd || (Array.isArray(payload.workspacePaths) ? payload.workspacePaths[0] : '');
  if (dir && typeof dir === 'string') return `agy:${dir.slice(-64)}`;
  return 'agy:default';
}

function extractRelativePath(rawPath: unknown, cwd: string): string {
  if (!rawPath || typeof rawPath !== 'string') return '';
  const trimmed = rawPath.trim();
  if (cwd && trimmed.startsWith(cwd)) {
    const rel = path.relative(cwd, trimmed);
    if (rel && !rel.startsWith('..')) return compact(rel, 64);
  }
  return compact(path.basename(trimmed), 40);
}

function extractCommand(args: Record<string, unknown>): string {
  const raw = args.CommandLine || args.command || args.cmd || '';
  if (typeof raw !== 'string') return '';
  const firstLine = raw.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || '';
  return compact(firstLine, 48);
}

function isPathInside(targetPath: string, baseDir: string): boolean {
  if (!targetPath || !baseDir) return false;
  const resolvedTarget = path.resolve(targetPath);
  const resolvedBase = path.resolve(baseDir);
  return resolvedTarget === resolvedBase || resolvedTarget.startsWith(`${resolvedBase}${path.sep}`);
}

function isOutsideWorkspace(targetPath: unknown, payload: HookPayload): boolean {
  if (!targetPath || typeof targetPath !== 'string') return false;
  const allowedRoots: string[] = [];
  if (Array.isArray(payload.workspacePaths)) allowedRoots.push(...payload.workspacePaths);
  if (payload.cwd) allowedRoots.push(payload.cwd);
  if (payload.artifactDirectoryPath) allowedRoots.push(payload.artifactDirectoryPath);
  allowedRoots.push('/tmp', '/private/tmp');
  return !allowedRoots.some((root) => isPathInside(targetPath, root));
}

function mapEvent(payload: HookPayload): HookResult {
  const event = String(payload.hookEventName || '').trim();
  const toolName = String(payload.toolCall?.name || '').trim();
  const toolLower = toolName.toLowerCase();
  const args = payload.toolCall?.args || {};
  const cwd = payload.cwd || '';
  const project = extractProject(payload);

  if (toolLower.includes('update_pet_status') || toolLower.includes('ai-desktop-pet')) {
    return {
      status: null,
      output: event === 'PreToolUse' ? { decision: 'allow' } : {},
    };
  }

  if (event === 'PreInvocation') {
    const invNum = Number(payload.invocationNum || 1);
    return {
      status: {
        state: 'thinking',
        message: invNum <= 1 ? 'Analyzing request...' : 'Thinking...',
        project,
      },
      output: {},
    };
  }

  if (event === 'PreToolUse') {
    if (toolLower === 'ask_question') {
      return {
        status: {
          state: 'waiting',
          message: 'Question waiting for reply!',
          project,
        },
        output: { decision: 'allow' },
      };
    }

    if (toolLower === 'run_command') {
      const cmd = extractCommand(args);
      const summary = compact(args.toolSummary || '', 44);

      if (args.BypassSandbox === true) {
        return {
          status: {
            state: 'waiting',
            message: summary ? `Approve: ${summary}` : 'Approval needed!',
            project,
          },
          output: { decision: 'ask' },
        };
      }

      return {
        status: {
          state: 'coding',
          message: summary || (cmd ? `Running: ${compact(cmd, 30)}` : 'Running command...'),
          project,
        },
        output: { decision: 'allow' },
      };
    }

    if (toolLower === 'write_file' || toolLower === 'edit_file') {
      const targetPath = args.Path || args.path || '';
      const rel = extractRelativePath(targetPath, cwd);
      const base = rel ? path.basename(rel) : '';
      const artifactMeta = args.ArtifactMetadata as { RequestFeedback?: boolean } | undefined;

      if (artifactMeta?.RequestFeedback === true) {
        return {
          status: {
            state: 'waiting',
            message: 'Plan ready — click Proceed!',
            project,
          },
          output: { decision: 'allow' },
        };
      }

      if (isOutsideWorkspace(targetPath, payload)) {
        return {
          status: {
            state: 'waiting',
            message: base ? `Approve edit: ${base}` : 'Approval needed to edit file!',
            project,
          },
          output: { decision: 'ask' },
        };
      }

      const action = toolLower === 'write_file' ? 'Writing' : 'Editing';
      return {
        status: {
          state: 'coding',
          message: base ? `${action} ${base}` : 'Writing code...',
          project,
        },
        output: { decision: 'allow' },
      };
    }

    return { status: null, output: { decision: 'allow' } };
  }

  if (event === 'PostToolUse') {
    if (toolLower === 'update_focus') {
      const focus = compact(args.focus || '', 54);
      if (focus) {
        return {
          status: {
            state: 'thinking',
            message: focus,
            project,
          },
          output: {},
        };
      }
      return { status: null, output: {} };
    }

    if (toolLower === 'update_steps') {
      const steps = Array.isArray(args.steps) ? (args.steps as Array<{ status?: string; title?: string }>) : [];
      const active = steps.find((s) => s?.status === 'in_progress');
      if (active?.title) {
        return {
          status: {
            state: 'coding',
            message: compact(active.title, 54),
            project,
          },
          output: {},
        };
      }
      return { status: null, output: {} };
    }

    if (toolLower === 'run_command') {
      const cmd = extractCommand(args);
      const summary = compact(args.toolSummary || '', 44);
      if (payload.error) {
        return {
          status: {
            state: 'thinking',
            message: summary ? `Debugging: ${summary}` : 'Checking command error...',
            project,
          },
          output: {},
        };
      }
      return {
        status: {
          state: 'coding',
          message: summary || (cmd ? `Ran: ${compact(cmd, 30)}` : 'Command finished'),
          project,
        },
        output: {},
      };
    }

    if (toolLower === 'edit_file' || toolLower === 'write_file') {
      const rel = extractRelativePath(args.Path || args.path, cwd);
      const base = rel ? path.basename(rel) : '';
      return {
        status: {
          state: 'coding',
          message: base ? `Updated ${base}` : 'Writing code...',
          project,
        },
        output: {},
      };
    }

    if (toolLower === 'read_file') {
      const rel = extractRelativePath(args.Path || args.path, cwd);
      const base = rel ? path.basename(rel) : '';
      return {
        status: {
          state: 'thinking',
          message: base ? `Reading ${base}` : 'Reading files...',
          project,
        },
        output: {},
      };
    }

    if (toolLower === 'search_web' || toolLower.includes('search') || toolLower.includes('find') || toolLower.includes('grep')) {
      return {
        status: {
          state: 'thinking',
          message: toolLower === 'search_web' ? 'Searching the web...' : 'Searching codebase...',
          project,
        },
        output: {},
      };
    }

    return { status: null, output: {} };
  }

  if (event === 'Stop') {
    const reason = String(payload.terminationReason || '');
    if (reason === 'USER_CANCELED') {
      return { status: { state: 'idle', message: '', project }, output: {} };
    }
    if (reason === 'ERROR') {
      return {
        status: {
          state: 'waiting',
          message: 'Stopped with an error!',
          project,
        },
        output: {},
      };
    }
    return {
      status: {
        state: 'success',
        message: 'All done!',
        project,
      },
      output: {},
    };
  }

  return { status: null, output: {} };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString('utf8').trim();
}

async function main(): Promise<void> {
  let payload: HookPayload = {};
  try {
    const raw = await readStdin();
    if (raw) payload = JSON.parse(raw) as HookPayload;
  } catch {
    process.stdout.write('{}\n');
    process.exit(0);
  }

  const { status, output } = mapEvent(payload);

  if (status) {
    try {
      await fetch(PET_STATUS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: status.state,
          message: status.message,
          detail: '',
          project: status.project || '',
          model: formatModelName(payload.modelName || payload.model),
          source: DEFAULT_SOURCE,
          sessionId: extractSessionId(payload),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      // Silent fallback if VibePet app is closed
    }
  }

  process.stdout.write(`${JSON.stringify(output || {})}\n`);
  process.exit(0);
}

main();
