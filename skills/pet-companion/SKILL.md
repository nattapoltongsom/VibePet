---
name: pet-companion
description: Control the floating macOS AI Desktop Pet via the `update_pet_status` MCP tool to show live agent thoughts, coding progress, approval alerts, and completion chimes.
---

# AI Desktop Pet Companion Skill

Use the `update_pet_status` MCP tool to keep the user informed on their macOS desktop and Menu Bar while you work.

## Tool Parameters

```json
{
  "state": "idle | thinking | coding | waiting | success",
  "message": "Short headline status (under 15 words)",
  "detail": "Optional deeper thought, file path, or command being run",
  "project": "Optional workspace or repository name",
  "model": "Optional active AI model name (e.g. gpt-5.5, claude-sonnet-4, gemini-3-pro)",
  "source": "antigravity | vscode | codex | claude-code"
}
```

## Recommended Milestones

| State | Visual & Sound | When to Call | Example |
| :--- | :--- | :--- | :--- |
| `thinking` | Purple · subtle blip | Starting a task, analyzing code, or planning | `message: "Analyzing auth flow"`, `detail: "Checking token refresh in auth.ts"` |
| `coding` | Green · subtle blip | Editing files, running builds, or executing tests | `message: "Updating login component"`, `detail: "Editing src/components/Login.tsx"` |
| `waiting` | Amber · 2-note chime (bubble stays pinned) | **Important!** Before asking a question, waiting on a plan, or requesting approval | `message: "Approval needed!"`, `detail: "Waiting for permission to run npm run build"` |
| `success` | Bright green · C-E-G melody | Task completed cleanly before final summary | `message: "All tests passed!"`, `detail: "Fixed login bug and verified build"` |
| `idle` | Blue · silent | Resetting back to resting mode | `message: "Ready for the next task!"` |

## Guidelines

1. Call at meaningful phase transitions rather than on every minor step.
2. Always send `waiting` before pausing for user approval or input so the chime calls them back.
3. Keep `message` concise (under 15 words) and put richer context in `detail`.
4. If the AI Pet app is not running, the MCP server returns silently without errors — continue your main task normally.
