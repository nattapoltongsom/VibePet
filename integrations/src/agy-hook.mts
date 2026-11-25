#!/usr/bin/env node
/**
 * Antigravity Lifecycle Hook for AI Desktop Pet.
 * Reads camelCase hook payloads from stdin, forwards live thoughts/model/approval status
 * to AI Pet over localhost HTTP, and outputs the required JSON hook decision to stdout.
 */

import fs from 'fs';
import path from 'path';

const PET_STATUS_URL = process.env.PET_STATUS_URL || 'http://127.0.0.1:4567/status';
const DEFAULT_SOURCE = process.env.PET_SOURCE || 'antigravity';
const TIMEOUT_MS = 1200;

interface HookPayload {
  hookEventName?: string;
  invocationNum?: number;
  lastUserInput?: string;
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
  detail: string;
  project: string;
}

interface HookResult {
  status: MappedStatus | null;
  output: Record<string, unknown>;
}

function compact(str: unknown, maxLen = 140): string {
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
  return compact(firstLine, 96);
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

function readLatestTranscriptSnippet(transcriptPath: string | undefined, mode: 'thought' | 'response' = 'thought'): string {
  if (!transcriptPath) return '';
  try {
    const stat = fs.statSync(transcriptPath);
    const readSize = Math.min(stat.size, 32768);
    if (readSize <= 0) return '';
    const fd = fs.openSync(transcriptPath, 'r');
    const buf = Buffer.alloc(readSize);
    fs.readSync(fd, buf, 0, readSize, stat.size - readSize);
    fs.closeSync(fd);

    const lines = buf.toString('utf8').split(/\r?\n/).filter(Boolean).reverse();
    for (const line of lines.slice(0, 30)) {
      let entry: Record<string, unknown>;
      try {
        entry = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }

      const planner = entry.plannerResponse as Record<string, unknown> | undefined;
      const meta = entry.metadata as Record<string, unknown> | undefined;

      if (mode === 'thought') {
        const thoughtText = entry.thought || entry.thinking || planner?.thinking || meta?.thought || '';
        if (typeof thoughtText === 'string' && thoughtText.trim()) {
          const firstSentence = thoughtText
            .replace(/[#*`>_]+/g, ' ')
            .split(/\n+/)
            .map((s) => s.trim())
            .find((s) => s.length >= 6);
          if (firstSentence) return compact(firstSentence, 150);
        }
      }

      if (mode === 'response') {
        const respText = entry.response || entry.text || planner?.response || entry.content || '';
        if (typeof respText === 'string' && respText.trim()) {
          const clean = respText.replace(/[#*`>_]+/g, ' ').trim();
          if (clean.length >= 4) return compact(clean, 140);
        }
      }
    }
  } catch {
    // Ignore unreadable transcript
  }
  return '';
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
    const userInput = compact(payload.lastUserInput || '', 130);

    if (invNum <= 1) {
      return {
        status: {
          state: 'thinking',
          message: 'Analyzing your request...',
          detail: userInput ? `Task: ${userInput}` : 'Planning next steps...',
          project,
        },
        output: {},
      };
    }

    const latestThought = readLatestTranscriptSnippet(payload.transcriptPath, 'thought');
    if (latestThought) {
      return {
        status: {
          state: 'thinking',
          message: 'Thinking through next step...',
          detail: latestThought,
          project,
        },
        output: {},
      };
    }
    return { status: null, output: {} };
  }

  if (event === 'PreToolUse') {
    const latestThought = readLatestTranscriptSnippet(payload.transcriptPath, 'thought');

    if (toolLower === 'ask_question') {
      const questions = Array.isArray(args.questions) ? (args.questions as Array<{ question?: string }>) : [];
      const firstQ = questions[0]?.question || '';
      return {
        status: {
          state: 'waiting',
          message: 'Question waiting for your input!',
          detail: firstQ ? compact(firstQ, 150) : 'Please check Antigravity to answer.',
          project,
        },
        output: { decision: 'allow' },
      };
    }

    if (toolLower === 'run_command') {
      const cmd = extractCommand(args);
      const summary = compact(args.toolSummary || '', 50);

      if (args.BypassSandbox === true) {
        return {
          status: {
            state: 'waiting',
            message: 'Approval needed in Antigravity!',
            detail: summary && cmd ? `${summary} -> ${cmd}` : cmd || summary || 'Command waiting for approval',
            project,
          },
          output: { decision: 'ask' },
        };
      }

      return {
        status: {
          state: 'coding',
          message: summary || (cmd ? `Running: ${compact(cmd, 28)}` : 'Running command...'),
          detail: cmd ? `Command: ${cmd}` : latestThought,
          project,
        },
        output: { decision: 'allow' },
      };
    }

    if (toolLower === 'write_file' || toolLower === 'edit_file') {
      const targetPath = args.Path || args.path || '';
      const rel = extractRelativePath(targetPath, cwd);
      const base = rel ? path.basename(rel) : '';
      const artifactMeta = args.ArtifactMetadata as { RequestFeedback?: boolean; Summary?: string } | undefined;

      if (artifactMeta?.RequestFeedback === true) {
        const planSummary = compact(artifactMeta.Summary || '', 140);
        return {
          status: {
            state: 'waiting',
            message: 'Plan ready — click Proceed!',
            detail: planSummary || `Review: ${base || String(targetPath)}`,
            project,
          },
          output: { decision: 'allow' },
        };
      }

      if (isOutsideWorkspace(targetPath, payload)) {
        return {
          status: {
            state: 'waiting',
            message: 'Approval needed to edit file!',
            detail: `Outside workspace: ${compact(targetPath, 120)}`,
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
          detail: latestThought || (rel ? `File: ${rel}` : 'Applying code changes'),
          project,
        },
        output: { decision: 'allow' },
      };
    }

    return { status: null, output: { decision: 'allow' } };
  }

  if (event === 'PostToolUse') {
    const latestThought = readLatestTranscriptSnippet(payload.transcriptPath, 'thought');

    if (toolLower === 'update_focus') {
      const focus = compact(args.focus || '', 140);
      if (focus) {
        return {
          status: {
            state: 'thinking',
            message: compact(focus, 48),
            detail: latestThought || focus,
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
      const doneCount = steps.filter((s) => s?.status === 'done').length;
      if (active?.title) {
        return {
          status: {
            state: 'coding',
            message: compact(active.title, 48),
            detail: `Step ${doneCount + 1}/${steps.length}${latestThought ? ` - ${latestThought}` : ''}`,
            project,
          },
          output: {},
        };
      }
      return { status: null, output: {} };
    }

    if (toolLower === 'run_command') {
      const cmd = extractCommand(args);
      const summary = compact(args.toolSummary || '', 50);
      if (payload.error) {
        return {
          status: {
            state: 'thinking',
            message: summary ? `Debugging: ${summary}` : 'Checking command error...',
            detail: cmd ? `${cmd} (${compact(payload.error, 60)})` : compact(payload.error, 140),
            project,
          },
          output: {},
        };
      }
      return {
        status: {
          state: 'coding',
          message: summary || (cmd ? `Ran: ${compact(cmd, 28)}` : 'Command finished'),
          detail: cmd ? `Command: ${cmd}` : latestThought,
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
          detail: latestThought || (rel ? `File: ${rel}` : ''),
          project,
        },
        output: {},
      };
    }

    if (toolLower === 'read_file') {
      const rel = extractRelativePath(args.Path || args.path, cwd);
      const base = rel ? path.basename(rel) : '';
      const range = args.StartLine ? ` (L${String(args.StartLine)}${args.EndLine ? `-${String(args.EndLine)}` : '+'})` : '';
      return {
        status: {
          state: 'thinking',
          message: base ? `Reading ${base}` : 'Reading files...',
          detail: latestThought || (rel ? `Inspecting: ${rel}${range}` : ''),
          project,
        },
        output: {},
      };
    }

    if (toolLower === 'search_web' || toolLower.includes('search') || toolLower.includes('find') || toolLower.includes('grep')) {
      const query = compact(args.query || args.Query || args.Pattern || args.pattern || '', 120);
      return {
        status: {
          state: 'thinking',
          message: toolLower === 'search_web' ? 'Searching the web...' : 'Searching codebase...',
          detail: query ? `Query: "${query}"` : latestThought,
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
      return { status: { state: 'idle', message: '', detail: '', project }, output: {} };
    }
    if (reason === 'ERROR') {
      return {
        status: {
          state: 'waiting',
          message: 'Stopped with an error!',
          detail: compact(payload.error || '', 150),
          project,
        },
        output: {},
      };
    }
    const respPreview = readLatestTranscriptSnippet(payload.transcriptPath, 'response');
    const fallbackTask = compact(payload.lastUserInput || '', 120);
    return {
      status: {
        state: 'success',
        message: 'All done!',
        detail: respPreview || (fallbackTask ? `Completed: ${fallbackTask}` : ''),
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
          detail: status.detail || '',
          project: status.project || '',
          model: formatModelName(payload.modelName || payload.model),
          source: DEFAULT_SOURCE,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      // Silent fallback if AI Pet app is closed
    }
  }

  process.stdout.write(`${JSON.stringify(output || {})}\n`);
  process.exit(0);
}

main();
