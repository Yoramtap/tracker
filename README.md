# Ralph

![Ralph](ralph.webp)

## Quick Start

1. Clone the repo
```bash
git clone https://github.com/Yoramtap/codex-loop.git
cd codex-loop
```

2. Install prerequisites
- Codex CLI (`npm install -g @openai/codex`) and authenticate
- `jq` (`brew install jq` on macOS)

3. Run the workflow
Use the `prd` skill to generate a PRD in `tasks/`, then use the `ralph` skill to convert it to `prd.json`. Finally:
```bash
./ralph.sh [max_iterations]
```
Use `--with-browser` to enable browser verification (default is off).

Ralph is an autonomous AI agent loop that runs AI coding tools like [Codex CLI](https://github.com/openai/codex) repeatedly until all PRD items are complete. Each iteration is a fresh instance with clean context. Memory persists via git history, `progress.txt`, and `prd.json`.

This repo was made Codex-ready by Yoram Tap.

**Codex PRD flow:** Use the `prd` skill to generate PRDs in `tasks/`, and the `ralph` skill to convert them to `prd.json`. Skills are installed globally in `~/.codex/skills` (not in this repo).
For terminal runs, answer the interactive questions. For chat/non-interactive runs, pass `--answers "1A, 2B, 3A"` to generate the PRD in one shot.

Based on [Geoffrey Huntley's Ralph pattern](https://ghuntley.com/ralph/).

[Read Ryan Carson's in-depth article on how to use Ralph](https://x.com/ryancarson/status/2008548371712135632)

## Prerequisites

- [Codex CLI](https://github.com/openai/codex) installed and authenticated (`npm install -g @openai/codex`)
- `jq` installed (`brew install jq` on macOS)
- A git repository for your project

## Setup

### Option 1: Copy to your project

Copy the ralph files into your project:

```bash
# From your project root
mkdir -p scripts/ralph
cp /path/to/ralph/ralph.sh scripts/ralph/
cp /path/to/ralph/AGENTS.md scripts/ralph/AGENTS.md

chmod +x scripts/ralph/ralph.sh
```

### Option 2: Use as Codex CLI repo

Use this repo directly with Codex:

```bash
./ralph.sh [max_iterations]
```
Use `--with-browser` to enable browser verification (default is off).

## Workflow

### 1. Create a PRD

Use the `prd` skill to generate a detailed requirements document. The PRD is saved to `tasks/prd-[feature-name].md`.

### 2. Convert PRD to Ralph format

Use the `ralph` skill to convert the markdown PRD to `prd.json`.

### 3. Run Ralph

```bash
./ralph.sh [max_iterations]
```
Use `--with-browser` to enable browser verification (default is off).

Default is 1 iteration.

Ralph will:
1. Pick the highest priority story where `passes: false`
2. Implement that single story
3. Commit if checks pass
4. Update `prd.json` to mark story as `passes: true`
5. Append learnings to `progress.txt`
6. Repeat until all stories pass or max iterations reached

## Key Files

| File | Purpose |
|------|---------|
| `ralph.sh` | The bash loop that spawns fresh Codex instances |
| `AGENTS.md` | Prompt template for Codex |
| `prd.json` | User stories with `passes` status (the task list) |
| `prd.json.example` | Example PRD format for reference |
| `progress.txt` | Append-only learnings for future iterations |

## Critical Concepts

### Each Iteration = Fresh Context

Each iteration spawns a **new Codex instance** with clean context. The only memory between iterations is:
- Git history (commits from previous iterations)
- `progress.txt` (learnings and context)
- `prd.json` (which stories are done)

### Small Tasks

Each PRD item should be small enough to complete in one context window. If a task is too big, the LLM runs out of context before finishing and produces poor code.

Right-sized stories:
- Add a database column and migration
- Add a UI component to an existing page
- Update a server action with new logic
- Add a filter dropdown to a list

Too big (split these):
- "Build the entire dashboard"
- "Add authentication"
- "Refactor the API"

### AGENTS.md Updates Are Critical

After each iteration, Ralph updates the relevant `AGENTS.md` files with learnings. This is key because AI coding tools automatically read these files, so future iterations (and future human developers) benefit from discovered patterns, gotchas, and conventions.

Examples of what to add to AGENTS.md:
- Patterns discovered ("this codebase uses X for Y")
- Gotchas ("do not forget to update Z when changing W")
- Useful context ("the settings panel is in component X")

### Feedback Loops

Ralph only works if there are feedback loops:
- Typecheck catches type errors
- Tests verify behavior
- CI must stay green (broken code compounds across iterations)

### Browser Verification for UI Stories

Frontend stories must include "Verify in browser using agent-browser skill" in acceptance criteria. Ralph will use the agent-browser skill to navigate to the page, interact with the UI, and confirm changes work.

Install the agent-browser skill:
```bash
npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser
```

### Stop Condition

When all stories have `passes: true`, Ralph outputs `<promise>COMPLETE</promise>` and the loop exits.

## Debugging

Check current state:

```bash
# See which stories are done
cat prd.json | jq '.userStories[] | {id, title, passes}'

# See learnings from previous iterations
cat progress.txt

# Check git history
git log --oneline -10
```

## Customizing the Prompt

After copying `AGENTS.md` to your project, customize it for your project:
- Add project-specific quality check commands
- Include codebase conventions
- Add common gotchas for your stack

## Archiving

Ralph automatically archives previous runs when you start a new feature (different `branchName`). Archives are saved to `archive/YYYY-MM-DD-feature-name/`.

## References

- [Geoffrey Huntley's Ralph article](https://ghuntley.com/ralph/)
- [Codex CLI documentation](https://github.com/openai/codex)
