import fs from 'fs';
import os from 'os';
import path from 'path';
import { app } from 'electron';
import type { IntegrationActionResult, IntegrationInfo } from '../shared/types';

const HOME = os.homedir();
const RUNTIME_ROOT = path.join(HOME, '.vibepet');
const SCRIPTS_DIR = path.join(RUNTIME_ROOT, 'scripts');
const BIN_DIR = path.join(RUNTIME_ROOT, 'bin');
const RUNNER_BIN = path.join(BIN_DIR, 'vibepet-node');

const MCP_SCRIPT = path.join(SCRIPTS_DIR, 'mcp-server.mjs');
const AGY_HOOK_SCRIPT = path.join(SCRIPTS_DIR, 'agy-hook.mjs');
const AGENT_HOOK_SCRIPT = path.join(SCRIPTS_DIR, 'agent-hook.mjs');

const HOOK_MARKER = '.vibepet/scripts/';
const LEGACY_HOOK_MARKER = '.ai-pet/scripts/';
const MD_START = '<!-- ai-desktop-pet:start -->';
const MD_END = '<!-- ai-desktop-pet:end -->';
const TOML_START = '# >>> ai-desktop-pet >>>';
const TOML_END = '# <<< ai-desktop-pet <<<';

interface HookCommand {
  type: 'command';
  command: string;
  timeout?: number;
}

interface HookGroup {
  matcher?: string;
  hooks: HookCommand[];
}

interface IntegrationAdapter {
  id: string;
  name: string;
  description: string;
  files: string[];
  detect: () => boolean;
  isConnected: () => boolean;
  connect: () => void;
  disconnect: () => void;
}

function getIntegrationsSourceDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'integrations');
  }
  return path.resolve(__dirname, '../../../integrations/dist');
}

function getBundledSkillPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'skills', 'pet-companion', 'SKILL.md');
  }
  return path.resolve(__dirname, '../../../skills/pet-companion/SKILL.md');
}

function exists(targetPath: string): boolean {
  try {
    fs.accessSync(targetPath);
    return true;
  } catch {
    return false;
  }
}

function readJsonSafe(filePath: string): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function writeJsonSafe(filePath: string, data: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function upsertFencedBlock(filePath: string, startMarker: string, endMarker: string, content: string): void {
  let existing = '';
  try {
    existing = fs.readFileSync(filePath, 'utf8');
  } catch {
    existing = '';
  }

  const block = `${startMarker}\n${content.trim()}\n${endMarker}`;
  const regex = new RegExp(`${escapeRegex(startMarker)}[\\s\\S]*?${escapeRegex(endMarker)}`, 'm');

  const next = regex.test(existing)
    ? existing.replace(regex, block)
    : existing.trim()
      ? `${existing.trimEnd()}\n\n${block}\n`
      : `${block}\n`;

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, next, 'utf8');
}

function removeFencedBlock(filePath: string, startMarker: string, endMarker: string): void {
  if (!exists(filePath)) return;
  const existing = fs.readFileSync(filePath, 'utf8');
  const regex = new RegExp(`\\n*${escapeRegex(startMarker)}[\\s\\S]*?${escapeRegex(endMarker)}\\n*`, 'gm');
  const next = existing.replace(regex, '\n').trim();
  fs.writeFileSync(filePath, next ? `${next}\n` : '', 'utf8');
}

function isAiPetHookCommand(cmd: unknown): boolean {
  if (typeof cmd !== 'string') return false;
  return (
    cmd.includes(HOOK_MARKER) ||
    cmd.includes(LEGACY_HOOK_MARKER) ||
    cmd.includes('agy-hook.mjs') ||
    cmd.includes('pet-hook.mjs') ||
    cmd.includes('agent-hook.mjs')
  );
}

/**
 * Stages bundled zero-dependency scripts and the portable Node launcher into ~/.ai-pet/.
 * Falls back to AI Pet.app's bundled Electron runtime when Node.js is not on PATH.
 */
export function ensureRuntimeInstalled(): void {
  const srcIntegrations = getIntegrationsSourceDir();
  fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
  fs.mkdirSync(BIN_DIR, { recursive: true });

  for (const file of ['mcp-server.mjs', 'agy-hook.mjs', 'agent-hook.mjs']) {
    const src = path.join(srcIntegrations, file);
    const dst = path.join(SCRIPTS_DIR, file);
    if (exists(src)) {
      fs.copyFileSync(src, dst);
      fs.chmodSync(dst, 0o755);
    }
  }

  const execPathEscaped = process.execPath.replace(/"/g, '\\"');
  const runnerScript = `#!/usr/bin/env bash
set -e
if command -v node >/dev/null 2>&1; then
  exec node "$@"
fi
for candidate in /opt/homebrew/bin/node /usr/local/bin/node "$HOME"/.nvm/versions/node/*/bin/node; do
  if [ -x "$candidate" ]; then
    exec "$candidate" "$@"
  fi
done
APP_BIN="${execPathEscaped}"
if [ -x "$APP_BIN" ]; then
  exec env ELECTRON_RUN_AS_NODE=1 "$APP_BIN" "$@"
fi
if [ -x "/Applications/VibePet.app/Contents/MacOS/VibePet" ]; then
  exec env ELECTRON_RUN_AS_NODE=1 "/Applications/VibePet.app/Contents/MacOS/VibePet" "$@"
fi
if [ -x "/Applications/AI Pet.app/Contents/MacOS/AI Pet" ]; then
  exec env ELECTRON_RUN_AS_NODE=1 "/Applications/AI Pet.app/Contents/MacOS/AI Pet" "$@"
fi
exit 0
`;
  fs.writeFileSync(RUNNER_BIN, runnerScript, 'utf8');
  fs.chmodSync(RUNNER_BIN, 0o755);
}

function readBundledSkill(): string {
  try {
    return fs.readFileSync(getBundledSkillPath(), 'utf8');
  } catch {
    return `---\nname: pet-companion\ndescription: Controls AI Desktop Pet via update_pet_status.\n---\n\nUse update_pet_status(state, message, detail, project, model, source) to report agent progress.\n`;
  }
}

function mergeHookGroups(existingGroups: unknown, newGroup: HookGroup): HookGroup[] {
  const list = Array.isArray(existingGroups) ? (existingGroups as HookGroup[]) : [];
  const cleaned = list.filter((group) => {
    const hooks = Array.isArray(group?.hooks) ? group.hooks : [];
    return !hooks.some((h) => isAiPetHookCommand(h?.command));
  });
  cleaned.push(newGroup);
  return cleaned;
}

function removeAiPetHookGroups(existingGroups: unknown): HookGroup[] {
  if (!Array.isArray(existingGroups)) return [];
  return (existingGroups as HookGroup[]).filter((group) => {
    const hooks = Array.isArray(group?.hooks) ? group.hooks : [];
    return !hooks.some((h) => isAiPetHookCommand(h?.command));
  });
}

function hasAiPetHookInObj(hooksObj: unknown): boolean {
  if (!hooksObj || typeof hooksObj !== 'object') return false;
  const serialized = JSON.stringify(hooksObj);
  return serialized.includes('agent-hook.mjs') || serialized.includes('pet-hook.mjs');
}

const INTEGRATIONS: IntegrationAdapter[] = [
  {
    id: 'antigravity',
    name: 'Antigravity',
    description: 'Standalone Antigravity & VS Code extension — live thoughts, model badge, approval alerts & done chime.',
    files: ['~/.gemini/config/mcp_config.json', '~/.gemini/config/hooks.json', '~/.gemini/config/skills/'],
    detect: () =>
      exists(path.join(HOME, '.gemini', 'config')) || exists(path.join(HOME, '.gemini', 'antigravity')),
    isConnected: () => {
      const mcp = readJsonSafe(path.join(HOME, '.gemini', 'config', 'mcp_config.json'));
      const hooks = readJsonSafe(path.join(HOME, '.gemini', 'config', 'hooks.json'));
      const mcpServers = (mcp.mcpServers as Record<string, unknown> | undefined) || {};
      return Boolean(mcpServers['ai-desktop-pet'] || hooks['ai-desktop-pet']);
    },
    connect: () => {
      ensureRuntimeInstalled();
      const base = path.join(HOME, '.gemini', 'config');

      const mcpPath = path.join(base, 'mcp_config.json');
      const mcp = readJsonSafe(mcpPath);
      const mcpServers = (mcp.mcpServers as Record<string, unknown> | undefined) || {};
      mcpServers['ai-desktop-pet'] = {
        command: RUNNER_BIN,
        args: [MCP_SCRIPT],
        env: { PET_SOURCE: 'antigravity' },
      };
      mcp.mcpServers = mcpServers;
      writeJsonSafe(mcpPath, mcp);

      const hooksPath = path.join(base, 'hooks.json');
      const hooks = readJsonSafe(hooksPath);
      const hookCmd = `"${RUNNER_BIN}" "${AGY_HOOK_SCRIPT}"`;
      hooks['ai-desktop-pet'] = {
        enabled: true,
        PreInvocation: [{ type: 'command', command: hookCmd, timeout: 5 }],
        PreToolUse: [
          {
            matcher: 'run_command|write_file|edit_file|ask_question',
            hooks: [{ type: 'command', command: hookCmd, timeout: 5 }],
          },
        ],
        PostToolUse: [
          {
            matcher: '*',
            hooks: [{ type: 'command', command: hookCmd, timeout: 5 }],
          },
        ],
        Stop: [{ type: 'command', command: hookCmd, timeout: 5 }],
      };
      writeJsonSafe(hooksPath, hooks);

      const skillPath = path.join(base, 'skills', 'pet-companion', 'SKILL.md');
      fs.mkdirSync(path.dirname(skillPath), { recursive: true });
      fs.writeFileSync(skillPath, readBundledSkill(), 'utf8');

      upsertFencedBlock(
        path.join(base, 'GEMINI.md'),
        MD_START,
        MD_END,
        `## AI Desktop Pet\nWhen \`update_pet_status\` is available, call it with \`state: "waiting"\` and \`source: "antigravity"\` before actions requiring user approval, questions, or plan confirmation.`
      );
    },
    disconnect: () => {
      const base = path.join(HOME, '.gemini', 'config');
      const mcpPath = path.join(base, 'mcp_config.json');
      if (exists(mcpPath)) {
        const mcp = readJsonSafe(mcpPath);
        const mcpServers = mcp.mcpServers as Record<string, unknown> | undefined;
        if (mcpServers) delete mcpServers['ai-desktop-pet'];
        writeJsonSafe(mcpPath, mcp);
      }

      const hooksPath = path.join(base, 'hooks.json');
      if (exists(hooksPath)) {
        const hooks = readJsonSafe(hooksPath);
        delete hooks['ai-desktop-pet'];
        writeJsonSafe(hooksPath, hooks);
      }

      removeFencedBlock(path.join(base, 'GEMINI.md'), MD_START, MD_END);
    },
  },

  {
    id: 'vscode',
    name: 'VS Code (Copilot Chat)',
    description: 'Global VS Code User MCP server & Copilot Agent instructions across every workspace.',
    files: ['~/Library/Application Support/Code/User/mcp.json', 'User/prompts/pet-companion.instructions.md'],
    detect: () => exists(path.join(HOME, 'Library', 'Application Support', 'Code', 'User')),
    isConnected: () => {
      const mcp = readJsonSafe(path.join(HOME, 'Library', 'Application Support', 'Code', 'User', 'mcp.json'));
      const servers = (mcp.servers as Record<string, unknown> | undefined) || {};
      return Boolean(servers['ai-desktop-pet']);
    },
    connect: () => {
      ensureRuntimeInstalled();
      const userDir = path.join(HOME, 'Library', 'Application Support', 'Code', 'User');
      const mcpPath = path.join(userDir, 'mcp.json');
      const mcp = readJsonSafe(mcpPath);
      const servers = (mcp.servers as Record<string, unknown> | undefined) || {};
      servers['ai-desktop-pet'] = {
        type: 'stdio',
        command: RUNNER_BIN,
        args: [MCP_SCRIPT],
        env: { PET_SOURCE: 'vscode' },
      };
      mcp.servers = servers;
      writeJsonSafe(mcpPath, mcp);

      const promptPath = path.join(userDir, 'prompts', 'pet-companion.instructions.md');
      fs.mkdirSync(path.dirname(promptPath), { recursive: true });
      fs.writeFileSync(
        promptPath,
        `---\ndescription: "Report agent status, thoughts, and approval alerts to AI Desktop Pet via update_pet_status"\napplyTo: "**"\n---\n\n# AI Desktop Pet Companion\n\nWhen the \`update_pet_status\` MCP tool is available, call it at major workflow milestones (\`thinking\`, \`coding\`, \`waiting\`, \`success\`) with \`source: "vscode"\`, a short \`message\` (under 15 words), and a concise \`detail\` explaining what you are analyzing, editing, or waiting to approve.\n`,
        'utf8'
      );

      const copilotSkillPath = path.join(HOME, '.copilot', 'skills', 'pet-companion', 'SKILL.md');
      fs.mkdirSync(path.dirname(copilotSkillPath), { recursive: true });
      fs.writeFileSync(copilotSkillPath, readBundledSkill(), 'utf8');
    },
    disconnect: () => {
      const userDir = path.join(HOME, 'Library', 'Application Support', 'Code', 'User');
      const mcpPath = path.join(userDir, 'mcp.json');
      if (exists(mcpPath)) {
        const mcp = readJsonSafe(mcpPath);
        const servers = mcp.servers as Record<string, unknown> | undefined;
        if (servers) delete servers['ai-desktop-pet'];
        writeJsonSafe(mcpPath, mcp);
      }
      const promptPath = path.join(userDir, 'prompts', 'pet-companion.instructions.md');
      if (exists(promptPath)) fs.unlinkSync(promptPath);
    },
  },

  {
    id: 'codex',
    name: 'OpenAI Codex (VS Code & CLI)',
    description: 'Automatic lifecycle hooks (including approval chimes & model badge) + MCP server across all projects.',
    files: ['~/.codex/config.toml', '~/.codex/hooks.json', '~/.codex/skills/'],
    detect: () => exists(path.join(HOME, '.codex')),
    isConnected: () => {
      const hooks = readJsonSafe(path.join(HOME, '.codex', 'hooks.json'));
      const tomlPath = path.join(HOME, '.codex', 'config.toml');
      const tomlHasMcp = exists(tomlPath) && fs.readFileSync(tomlPath, 'utf8').includes('[mcp_servers.ai-desktop-pet]');
      return Boolean(tomlHasMcp || hasAiPetHookInObj(hooks.hooks));
    },
    connect: () => {
      ensureRuntimeInstalled();
      const codexDir = path.join(HOME, '.codex');
      const tomlPath = path.join(codexDir, 'config.toml');

      if (exists(tomlPath)) {
        const raw = fs.readFileSync(tomlPath, 'utf8');
        if (!raw.includes(TOML_START) && raw.includes('[mcp_servers.ai-desktop-pet]')) {
          const stripped = raw
            .replace(/\n*\[mcp_servers\.ai-desktop-pet\][\s\S]*?(?=\n\[[^\]]+\]|$)/m, '')
            .replace(/\n*\[mcp_servers\.ai-desktop-pet\.env\][\s\S]*?(?=\n\[[^\]]+\]|$)/m, '');
          fs.writeFileSync(tomlPath, `${stripped.trimEnd()}\n`, 'utf8');
        }
      }

      const tomlBlock = `[mcp_servers.ai-desktop-pet]
command = "${RUNNER_BIN}"
args = ["${MCP_SCRIPT}"]
startup_timeout_sec = 10
tool_timeout_sec = 10

[mcp_servers.ai-desktop-pet.env]
PET_SOURCE = "codex"`;
      upsertFencedBlock(tomlPath, TOML_START, TOML_END, tomlBlock);

      const hooksPath = path.join(codexDir, 'hooks.json');
      const data = readJsonSafe(hooksPath);
      const hooks = (data.hooks as Record<string, unknown> | undefined) || {};
      const hookCmd = `PET_SOURCE=codex "${RUNNER_BIN}" "${AGENT_HOOK_SCRIPT}"`;

      hooks.UserPromptSubmit = mergeHookGroups(hooks.UserPromptSubmit, {
        hooks: [{ type: 'command', command: hookCmd, timeout: 5 }],
      });
      hooks.PreToolUse = mergeHookGroups(hooks.PreToolUse, {
        matcher: '.*',
        hooks: [{ type: 'command', command: hookCmd, timeout: 5 }],
      });
      hooks.PermissionRequest = mergeHookGroups(hooks.PermissionRequest, {
        matcher: '.*',
        hooks: [{ type: 'command', command: hookCmd, timeout: 5 }],
      });
      hooks.Notification = mergeHookGroups(hooks.Notification, {
        hooks: [{ type: 'command', command: hookCmd, timeout: 5 }],
      });
      hooks.Stop = mergeHookGroups(hooks.Stop, {
        hooks: [{ type: 'command', command: hookCmd, timeout: 5 }],
      });
      data.hooks = hooks;
      writeJsonSafe(hooksPath, data);

      const skillPath = path.join(codexDir, 'skills', 'pet-companion', 'SKILL.md');
      fs.mkdirSync(path.dirname(skillPath), { recursive: true });
      fs.writeFileSync(skillPath, readBundledSkill(), 'utf8');
    },
    disconnect: () => {
      const codexDir = path.join(HOME, '.codex');
      removeFencedBlock(path.join(codexDir, 'config.toml'), TOML_START, TOML_END);
      const hooksPath = path.join(codexDir, 'hooks.json');
      if (exists(hooksPath)) {
        const data = readJsonSafe(hooksPath);
        const hooks = data.hooks as Record<string, unknown> | undefined;
        if (hooks) {
          for (const key of Object.keys(hooks)) {
            const next = removeAiPetHookGroups(hooks[key]);
            if (next.length === 0) delete hooks[key];
            else hooks[key] = next;
          }
        }
        writeJsonSafe(hooksPath, data);
      }
    },
  },

  {
    id: 'claude-code',
    name: 'Claude Code',
    description: 'Automatic Claude Code lifecycle hooks (thinking, tool use, permission prompts, done) & MCP server.',
    files: ['~/.claude/settings.json', '~/.claude.json'],
    detect: () => exists(path.join(HOME, '.claude')) || exists(path.join(HOME, '.claude.json')),
    isConnected: () => {
      const settings = readJsonSafe(path.join(HOME, '.claude', 'settings.json'));
      const claudeJson = readJsonSafe(path.join(HOME, '.claude.json'));
      const mcpServers = (claudeJson.mcpServers as Record<string, unknown> | undefined) || {};
      return Boolean(mcpServers['ai-desktop-pet'] || hasAiPetHookInObj(settings.hooks));
    },
    connect: () => {
      ensureRuntimeInstalled();
      const settingsPath = path.join(HOME, '.claude', 'settings.json');
      const settings = readJsonSafe(settingsPath);
      const hooks = (settings.hooks as Record<string, unknown> | undefined) || {};
      const hookCmd = `PET_SOURCE=claude-code "${RUNNER_BIN}" "${AGENT_HOOK_SCRIPT}"`;

      hooks.UserPromptSubmit = mergeHookGroups(hooks.UserPromptSubmit, {
        hooks: [{ type: 'command', command: hookCmd, timeout: 5 }],
      });
      hooks.PreToolUse = mergeHookGroups(hooks.PreToolUse, {
        matcher: '.*',
        hooks: [{ type: 'command', command: hookCmd, timeout: 5 }],
      });
      hooks.PermissionRequest = mergeHookGroups(hooks.PermissionRequest, {
        matcher: '.*',
        hooks: [{ type: 'command', command: hookCmd, timeout: 5 }],
      });
      hooks.Notification = mergeHookGroups(hooks.Notification, {
        hooks: [{ type: 'command', command: hookCmd, timeout: 5 }],
      });
      hooks.Stop = mergeHookGroups(hooks.Stop, {
        hooks: [{ type: 'command', command: hookCmd, timeout: 5 }],
      });
      settings.hooks = hooks;
      writeJsonSafe(settingsPath, settings);

      const claudeJsonPath = path.join(HOME, '.claude.json');
      const claudeJson = readJsonSafe(claudeJsonPath);
      const mcpServers = (claudeJson.mcpServers as Record<string, unknown> | undefined) || {};
      mcpServers['ai-desktop-pet'] = {
        command: RUNNER_BIN,
        args: [MCP_SCRIPT],
        env: { PET_SOURCE: 'claude-code' },
      };
      claudeJson.mcpServers = mcpServers;
      writeJsonSafe(claudeJsonPath, claudeJson);
    },
    disconnect: () => {
      const settingsPath = path.join(HOME, '.claude', 'settings.json');
      if (exists(settingsPath)) {
        const settings = readJsonSafe(settingsPath);
        const hooks = settings.hooks as Record<string, unknown> | undefined;
        if (hooks) {
          for (const key of Object.keys(hooks)) {
            const next = removeAiPetHookGroups(hooks[key]);
            if (next.length === 0) delete hooks[key];
            else hooks[key] = next;
          }
        }
        writeJsonSafe(settingsPath, settings);
      }

      const claudeJsonPath = path.join(HOME, '.claude.json');
      if (exists(claudeJsonPath)) {
        const claudeJson = readJsonSafe(claudeJsonPath);
        const mcpServers = claudeJson.mcpServers as Record<string, unknown> | undefined;
        if (mcpServers) delete mcpServers['ai-desktop-pet'];
        writeJsonSafe(claudeJsonPath, claudeJson);
      }
    },
  },
];

export function getIntegrationStatuses(): IntegrationInfo[] {
  return INTEGRATIONS.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    files: item.files,
    detected: item.detect(),
    connected: item.isConnected(),
  }));
}

export function connectIntegrations(ids: string[] = []): IntegrationActionResult[] {
  const results: IntegrationActionResult[] = [];
  for (const id of ids) {
    const target = INTEGRATIONS.find((i) => i.id === id);
    if (!target) continue;
    try {
      target.connect();
      results.push({ id, ok: true });
    } catch (err) {
      results.push({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}

export function disconnectIntegration(id: string): IntegrationActionResult {
  const target = INTEGRATIONS.find((i) => i.id === id);
  if (!target) return { id, ok: false, error: 'Unknown integration' };
  try {
    target.disconnect();
    return { id, ok: true };
  } catch (err) {
    return { id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
