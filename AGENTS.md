# Ralph Agent Instructions

## Overview

Ralph is an autonomous AI agent loop that runs AI coding tools (Amp or Claude Code) repeatedly until all PRD items are complete. Each iteration is a fresh instance with clean context.

## Commands

```bash
# Run the flowchart dev server
cd flowchart && npm run dev

# Build the flowchart
cd flowchart && npm run build

# Run Ralph with Amp (default)
./ralph.sh [max_iterations]

# Run Ralph with Claude Code
./ralph.sh --tool claude [max_iterations]
```

## Key Files

- `ralph.sh` - The bash loop that spawns fresh AI instances (supports `--tool amp` or `--tool claude`)
- `prompt.md` - Instructions given to each AMP instance
-  `CLAUDE.md` - Instructions given to each Claude Code instance
- `prd.json.example` - Example PRD format
- `flowchart/` - Interactive React Flow diagram explaining how Ralph works

## Flowchart

The `flowchart/` directory contains an interactive visualization built with React Flow. It's designed for presentations - click through to reveal each step with animations.

To run locally:
```bash
cd flowchart
npm install
npm run dev
```

## Patterns

- Each iteration spawns a fresh AI instance (Amp or Claude Code) with clean context
- Memory persists via git history, `progress.txt`, and `prd.json`
- Stories should be small enough to complete in one context window
- Always update AGENTS.md with discovered patterns for future iterations
- TODO: Confirm any new patterns observed in recent Ralph runs
- After shipping a feature, add build note entries to `web/src/app/prds/story/posts.ts` so it shows up in the build notes list
- Replay timeline responsibilities are split: normalize/sort events in `web/src/app/replay/data.ts`, keep route shell in `web/src/app/replay/page.tsx`, and do grouped rendering plus URL filter behavior in `web/src/app/replay/replay-timeline.tsx`.
- For static export compatibility, query-param UI state on `/replay` should be handled in a client component wrapped in `Suspense` instead of `await searchParams` in the page server component.

## Browser Verification

- If `SKIP_BROWSER_VERIFICATION=1`, skip browser checks and note that manual verification is required.
- When enabled, prefer using the `agent-browser` skill for UI verification.
