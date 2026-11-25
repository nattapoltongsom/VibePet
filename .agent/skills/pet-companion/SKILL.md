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
  "source": "antigravity | vscode | codex | claude-code"
}
```

## Guidelines

1. Call at meaningful milestones (`thinking` -> `coding` -> `waiting` -> `success`).
2. Always send `waiting` before pausing for user approval, questions, or plan confirmation.
3. Keep `message` short (under 15 words) and place deeper reasoning or command details in `detail`.
4. If AI Pet is closed, the tool skips silently — continue normally.
