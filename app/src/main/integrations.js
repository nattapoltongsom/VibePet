const fs = require('fs');
const os = require('os');
const path = require('path');
const { app } = require('electron');

const HOME = os.homedir();
const RUNTIME_ROOT = path.join(HOME, '.ai-pet');
const SCRIPTS_DIR = path.join(RUNTIME_ROOT, 'scripts');
const BIN_DIR = path.join(RUNTIME_ROOT, 'bin');
const RUNNER_BIN = path.join(BIN_DIR, 'ai-pet-node');

const MCP_SCRIPT = path.join(SCRIPTS_DIR, 'mcp-server.mjs');
const AGY_HOOK_SCRIPT = path.join(SCRIPTS_DIR, 'agy-hook.mjs');
const AGENT_HOOK_SCRIPT = path.join(SCRIPTS_DIR, 'agent-hook.mjs');

const HOOK_MARKER = '.ai-pet/scripts/';
const MD_START = '<!-- ai-desktop-pet:start -->';
const MD_END = '<!-- ai-desktop-pet:end -->';
const TOML_START = '# >>> ai-desktop-pet >>>';
const TOML_END = '# <<< ai-desktop-pet <<<';

function getBundledRoot() {
  return app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '../../../');
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function readJsonSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeJsonSafe(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function upsertFencedBlock(filePath, startMarker, endMarker, content) {
  let existing = '';
  try {
    existing = fs.readFileSync(filePath, 'utf8');
  } catch {
    existing = '';
  }

  const block = `${startMarker}\n${content.trim()}\n${endMarker}`;
  const regex = new RegExp(`${escapeRegex(startMarker)}[\\s\\S]*?${escapeRegex(endMarker)}`, 'm');

  let next;
  if (regex.test(existing)) {
    next = existing.replace(regex, block);
  } else {
    next = existing.trim() ? `${existing.trimEnd()}\n\n${block}\n` : `${block}\n`;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, next, 'utf8');
}

function removeFencedBlock(filePath, startMarker, endMarker) {
  if (!exists(filePath)) return;
  const existing = fs.readFileSync(filePath, 'utf8');
  const regex = new RegExp(`\\n*${escapeRegex(startMarker)}[\\s\\S]*?${escapeRegex(endMarker)}\\n*`, 'gm');
  const next = existing.replace(regex, '\n').trim();
  fs.writeFileSync(filePath, next ? `${next}\n` : '', 'utf8');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isAiPetHookCommand(cmd) {
  if (typeof cmd !== 'string') return false;
  return (
    cmd.includes(HOOK_MARKER) ||
    cmd.includes('agy-hook.mjs') ||
    cmd.includes('pet-hook.mjs') ||
    cmd.includes('agent-hook.mjs')
  );
}

/**
 * Stages bundled zero-dependency scripts and the portable Node launcher into ~/.ai-pet/.
 * Works even on Macs without Node.js on PATH by falling back to Electron's bundled runtime.
 */
function ensureRuntimeInstalled() {
  const bundledRoot = getBundledRoot();
  const srcIntegrations = path.join(bundledRoot, 'integrations');

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
if [ -x "/Applications/AI Pet.app/Contents/MacOS/AI Pet" ]; then
  exec env ELECTRON_RUN_AS_NODE=1 "/Applications/AI Pet.app/Contents/MacOS/AI Pet" "$@"
fi
exit 0
`;
  fs.writeFileSync(RUNNER_BIN, runnerScript, 'utf8');
  fs.chmodSync(RUNNER_BIN, 0o755);
}

function readBundledSkill() {
  const bundledRoot = getBundledRoot();
  const skillPath = path.join(bundledRoot, 'skills', 'pet-companion', 'SKILL.md');
  try {
    return fs.readFileSync(skillPath, 'utf8');
  } catch {
    return `---\nname: pet-companion\ndescription: Controls AI Desktop Pet via update_pet_status.\n---\n\nUse update_pet_status(state, message, detail, project, source) to report agent progress.\n`;
  }
}

function mergeHookGroups(existingGroups, newGroup) {
  const list = Array.isArray(existingGroups) ? existingGroups : [];
  const cleaned = list.filter((group) => {
    const hooks = Array.isArray(group?.hooks) ? group.hooks : [];
    return !hooks.some((h) => isAiPetHookCommand(h?.command));
  });
  cleaned.push(newGroup);
  return cleaned;
}

function removeAiPetHookGroups(existingGroups) {
  if (!Array.isArray(existingGroups)) return [];
  return existingGroups.filter((group) => {
    const hooks = Array.isArray(group?.hooks) ? group.hooks : [];
    return !hooks.some((h) => isAiPetHookCommand(h?.command));
  });
}

function hasAiPetHookInObj(hooksObj) {
  if (!hooksObj || typeof hooksObj !== 'object') return false;
  return JSON.stringify(hooksObj).includes('agent-hook.mjs') || JSON.stringify(hooksObj).includes('pet-hook.mjs');
}

// ================= Integration Definitions =================

const INTEGRATIONS = [
  {
    id: 'antigravity',
    name: 'Antigravity',
    description: 'Standalone Antigravity & VS Code extension — live thinking, coding, approval alerts & completion.',
    files: ['~/.gemini/config/mcp_config.json', '~/.gemini/config/hooks.json', '~/.gemini/config/skills/'],
    detect() {
      return exists(path.join(HOME, '.gemini', 'config')) || exists(path.join(HOME, '.gemini', 'antigravity'));
    },
    isConnected() {
      const mcp = readJsonSafe(path.join(HOME, '.gemini', 'config', 'mcp_config.json'));
      const hooks = readJsonSafe(path.join(HOME, '.gemini', 'config', 'hooks.json'));
      return Boolean(mcp?.mcpServers?.['ai-desktop-pet'] || hooks?.['ai-desktop-pet']);
    },
    connect() {
      ensureRuntimeInstalled();
      const base = path.join(HOME, '.gemini', 'config');

      const mcpPath = path.join(base, 'mcp_config.json');
      const mcp = readJsonSafe(mcpPath);
      mcp.mcpServers = mcp.mcpServers || {};
      mcp.mcpServers['ai-desktop-pet'] = {
        command: RUNNER_BIN,
        args: [MCP_SCRIPT],
        env: { PET_SOURCE: 'antigravity' },
      };
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
    disconnect() {
      const base = path.join(HOME, '.gemini', 'config');
      const mcpPath = path.join(base, 'mcp_config.json');
      if (exists(mcpPath)) {
        const mcp = readJsonSafe(mcpPath);
        if (mcp.mcpServers) delete mcp.mcpServers['ai-desktop-pet'];
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
    detect() {
      return exists(path.join(HOME, 'Library', 'Application Support', 'Code', 'User'));
    },
    isConnected() {
      const mcp = readJsonSafe(path.join(HOME, 'Library', 'Application Support', 'Code', 'User', 'mcp.json'));
      return Boolean(mcp?.servers?.['ai-desktop-pet']);
    },
    connect() {
      ensureRuntimeInstalled();
      const userDir = path.join(HOME, 'Library', 'Application Support', 'Code', 'User');
      const mcpPath = path.join(userDir, 'mcp.json');
      const mcp = readJsonSafe(mcpPath);
      mcp.servers = mcp.servers || {};
      mcp.servers['ai-desktop-pet'] = {
        type: 'stdio',
        command: RUNNER_BIN,
        args: [MCP_SCRIPT],
        env: { PET_SOURCE: 'vscode' },
      };
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
    disconnect() {
      const userDir = path.join(HOME, 'Library', 'Application Support', 'Code', 'User');
      const mcpPath = path.join(userDir, 'mcp.json');
      if (exists(mcpPath)) {
        const mcp = readJsonSafe(mcpPath);
        if (mcp.servers) delete mcp.servers['ai-desktop-pet'];
        writeJsonSafe(mcpPath, mcp);
      }
      const promptPath = path.join(userDir, 'prompts', 'pet-companion.instructions.md');
      if (exists(promptPath)) fs.unlinkSync(promptPath);
    },
  },

  {
    id: 'codex',
    name: 'OpenAI Codex (VS Code & CLI)',
    description: 'Automatic lifecycle hooks (including approval chimes) & MCP server across all Codex projects.',
    files: ['~/.codex/config.toml', '~/.codex/hooks.json', '~/.codex/skills/'],
    detect() {
      return exists(path.join(HOME, '.codex'));
    },
    isConnected() {
      const hooks = readJsonSafe(path.join(HOME, '.codex', 'hooks.json'));
      const tomlPath = path.join(HOME, '.codex', 'config.toml');
      const tomlHasMcp = exists(tomlPath) && fs.readFileSync(tomlPath, 'utf8').includes('[mcp_servers.ai-desktop-pet]');
      return Boolean(tomlHasMcp || hasAiPetHookInObj(hooks?.hooks));
    },
    connect() {
      ensureRuntimeInstalled();
      const codexDir = path.join(HOME, '.codex');
      const tomlPath = path.join(codexDir, 'config.toml');

      // Remove any prior unfenced [mcp_servers.ai-desktop-pet] block cleanly before upserting fenced block
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
      data.hooks = data.hooks || {};
      const hookCmd = `PET_SOURCE=codex "${RUNNER_BIN}" "${AGENT_HOOK_SCRIPT}"`;

      data.hooks.UserPromptSubmit = mergeHookGroups(data.hooks.UserPromptSubmit, {
        hooks: [{ type: 'command', command: hookCmd, timeout: 5 }],
      });
      data.hooks.PreToolUse = mergeHookGroups(data.hooks.PreToolUse, {
        matcher: '.*',
        hooks: [{ type: 'command', command: hookCmd, timeout: 5 }],
      });
      data.hooks.PermissionRequest = mergeHookGroups(data.hooks.PermissionRequest, {
        matcher: '.*',
        hooks: [{ type: 'command', command: hookCmd, timeout: 5 }],
      });
      data.hooks.Notification = mergeHookGroups(data.hooks.Notification, {
        hooks: [{ type: 'command', command: hookCmd, timeout: 5 }],
      });
      data.hooks.Stop = mergeHookGroups(data.hooks.Stop, {
        hooks: [{ type: 'command', command: hookCmd, timeout: 5 }],
      });
      writeJsonSafe(hooksPath, data);

      const skillPath = path.join(codexDir, 'skills', 'pet-companion', 'SKILL.md');
      fs.mkdirSync(path.dirname(skillPath), { recursive: true });
      fs.writeFileSync(skillPath, readBundledSkill(), 'utf8');
    },
    disconnect() {
      const codexDir = path.join(HOME, '.codex');
      removeFencedBlock(path.join(codexDir, 'config.toml'), TOML_START, TOML_END);
      const hooksPath = path.join(codexDir, 'hooks.json');
      if (exists(hooksPath)) {
        const data = readJsonSafe(hooksPath);
        if (data.hooks) {
          for (const key of Object.keys(data.hooks)) {
            data.hooks[key] = removeAiPetHookGroups(data.hooks[key]);
            if (data.hooks[key].length === 0) delete data.hooks[key];
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
    detect() {
      return exists(path.join(HOME, '.claude')) || exists(path.join(HOME, '.claude.json'));
    },
    isConnected() {
      const settings = readJsonSafe(path.join(HOME, '.claude', 'settings.json'));
      const claudeJson = readJsonSafe(path.join(HOME, '.claude.json'));
      return Boolean(claudeJson?.mcpServers?.['ai-desktop-pet'] || hasAiPetHookInObj(settings?.hooks));
    },
    connect() {
      ensureRuntimeInstalled();
      const settingsPath = path.join(HOME, '.claude', 'settings.json');
      const settings = readJsonSafe(settingsPath);
      settings.hooks = settings.hooks || {};
      const hookCmd = `PET_SOURCE=claude-code "${RUNNER_BIN}" "${AGENT_HOOK_SCRIPT}"`;

      settings.hooks.UserPromptSubmit = mergeHookGroups(settings.hooks.UserPromptSubmit, {
        hooks: [{ type: 'command', command: hookCmd, timeout: 5 }],
      });
      settings.hooks.PreToolUse = mergeHookGroups(settings.hooks.PreToolUse, {
        matcher: '.*',
        hooks: [{ type: 'command', command: hookCmd, timeout: 5 }],
      });
      settings.hooks.PermissionRequest = mergeHookGroups(settings.hooks.PermissionRequest, {
        matcher: '.*',
        hooks: [{ type: 'command', command: hookCmd, timeout: 5 }],
      });
      settings.hooks.Notification = mergeHookGroups(settings.hooks.Notification, {
        hooks: [{ type: 'command', command: hookCmd, timeout: 5 }],
      });
      settings.hooks.Stop = mergeHookGroups(settings.hooks.Stop, {
        hooks: [{ type: 'command', command: hookCmd, timeout: 5 }],
      });
      writeJsonSafe(settingsPath, settings);

      const claudeJsonPath = path.join(HOME, '.claude.json');
      const claudeJson = readJsonSafe(claudeJsonPath);
      claudeJson.mcpServers = claudeJson.mcpServers || {};
      claudeJson.mcpServers['ai-desktop-pet'] = {
        command: RUNNER_BIN,
        args: [MCP_SCRIPT],
        env: { PET_SOURCE: 'claude-code' },
      };
      writeJsonSafe(claudeJsonPath, claudeJson);
    },
    disconnect() {
      const settingsPath = path.join(HOME, '.claude', 'settings.json');
      if (exists(settingsPath)) {
        const settings = readJsonSafe(settingsPath);
        if (settings.hooks) {
          for (const key of Object.keys(settings.hooks)) {
            settings.hooks[key] = removeAiPetHookGroups(settings.hooks[key]);
            if (settings.hooks[key].length === 0) delete settings.hooks[key];
          }
        }
        writeJsonSafe(settingsPath, settings);
      }

      const claudeJsonPath = path.join(HOME, '.claude.json');
      if (exists(claudeJsonPath)) {
        const claudeJson = readJsonSafe(claudeJsonPath);
        if (claudeJson.mcpServers) delete claudeJson.mcpServers['ai-desktop-pet'];
        writeJsonSafe(claudeJsonPath, claudeJson);
      }
    },
  },
];

function getIntegrationStatuses() {
  return INTEGRATIONS.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    files: item.files,
    detected: item.detect(),
    connected: item.isConnected(),
  }));
}

function connectIntegrations(ids = []) {
  const results = [];
  for (const id of ids) {
    const target = INTEGRATIONS.find((i) => i.id === id);
    if (!target) continue;
    try {
      target.connect();
      results.push({ id, ok: true });
    } catch (err) {
      results.push({ id, ok: false, error: err.message });
    }
  }
  return results;
}

function disconnectIntegration(id) {
  const target = INTEGRATIONS.find((i) => i.id === id);
  if (!target) return { id, ok: false, error: 'Unknown integration' };
  try {
    target.disconnect();
    return { id, ok: true };
  } catch (err) {
    return { id, ok: false, error: err.message };
  }
}

module.exports = {
  ensureRuntimeInstalled,
  getIntegrationStatuses,
  connectIntegrations,
  disconnectIntegration,
};
