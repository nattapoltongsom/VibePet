#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const PET_STATUS_URL = process.env.PET_STATUS_URL || 'http://127.0.0.1:4567/status';
const DEFAULT_SOURCE = process.env.PET_SOURCE || 'antigravity';
const REQUEST_TIMEOUT_MS = 1500;

const server = new McpServer({
  name: 'ai-desktop-pet',
  version: '1.1.0',
});

server.tool(
  'update_pet_status',
  'Update the AI Desktop Pet floating cat animation, speech bubble message, detailed thought/reasoning box, macOS Menu Bar status, and notification sound. Fails silently if the Desktop Pet app is not running.',
  {
    state: z
      .enum(['idle', 'thinking', 'coding', 'waiting', 'success'])
      .describe(
        'Visual state of the cat pet: idle (blue), thinking (purple), coding (green), waiting (amber, pins bubble + plays chime), success (bright green + plays melody).'
      ),
    message: z
      .string()
      .max(160)
      .describe('Short headline status shown on macOS Topbar and top of speech bubble (keep under 15 words).'),
    detail: z
      .string()
      .max(240)
      .optional()
      .describe(
        'Optional deeper thought or detail showing what you are thinking, analyzing, editing, or waiting to approve (rendered in the 💭 thought box).'
      ),
    project: z
      .string()
      .max(40)
      .optional()
      .describe('Optional workspace or repository name shown as a small pill badge (e.g. "liff-app").'),
    model: z
      .string()
      .max(48)
      .optional()
      .describe('Optional AI model name currently active (e.g. "gpt-5.5", "claude-sonnet-4", "gemini-3-pro").'),
    source: z
      .string()
      .max(32)
      .optional()
      .describe('Origin IDE or client name shown as a badge on the speech bubble, e.g. "antigravity" or "vscode".'),
  },
  async ({ state, message, detail, project, model, source }) => {
    const resolvedSource = (source && source.trim()) || DEFAULT_SOURCE;
    const payload = {
      state,
      message: message.trim(),
      detail: detail ? detail.trim() : '',
      project: project ? project.trim() : '',
      model: model ? model.trim() : '',
      source: resolvedSource,
    };

    try {
      const response = await fetch(PET_STATUS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        return {
          content: [
            {
              type: 'text',
              text: `Desktop Pet returned HTTP ${response.status} (ignored silently so your workflow continues).`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `Pet status updated: [${state}] (${resolvedSource}) "${payload.message}"${payload.detail ? ` — ${payload.detail}` : ''}`,
          },
        ],
      };
    } catch {
      return {
        content: [
          {
            type: 'text',
            text: 'Desktop Pet app is not running (skipped silently).',
          },
        ],
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('[ai-desktop-pet-mcp] Fatal startup error:', err);
  process.exit(1);
});
