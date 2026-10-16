# Multi-Agent Coordination Protocol

**Gate: no parallel implementation until this file + Phase 1 docs exist. Until then, work is sequential.**

## 1. Units of work

Every unit is a task file: `project-memory/status/tasks/TASK-<id>.md`.
`<id>` = first 8 hex chars of `sha1(title + scope + creation-iso-timestamp)`.
The ID is for **traceability only** (commits, ADRs, experiments reference it).
It is NOT a lock. Conflict resolution is git's job (branches/worktrees), never the hash's.

### Task file format

```markdown
---
id: TASK-f01a2b3c
title: Phase 1 monorepo toolchain
status: proposed | claimed | in_progress | review | done | blocked
claimed_by: <agent-name or human>
branch: task/f01a2b3c-monorepo-toolchain
owns: [package.json, pnpm-workspace.yaml, turbo.json, apps/*, packages/config]
depends_on: []
verify: ["pnpm install", "pnpm typecheck"]
created: 2026-10-14T00:00:00Z
---
## Scope
## Expected outputs
## Summary of changes   ← filled on completion
## Verification        ← level reached + evidence (commands + output gist)
```

## 2. Session protocol (every agent, every time)

**Before work:**
1. Read `HANDOFF.md` (snapshot), `coordination-protocol.md` (this), `PROJECT_CONTEXT.md`, `STATUS.md`.
2. Read ADRs touching your task's scope.
3. Check `tasks/` for conflicts on your `owns:` paths. If a claimed task overlaps → coordinate or pick another task; do not silently proceed.
4. Claim: create/update your task file (`status: claimed`, your name, branch) as its **own commit**.

**During work:**
- Edit ONLY paths in your task's `owns:` list + your task file + your session file.
- Shared files (`STATUS.md`, `PROJECT_CONTEXT.md`) are **append/update-only** — never restructure them in a feature task.
- One task = one branch = one PR. Parallel work: `git worktree add ../finlab-<id> task/<id>`.

**After work:**
5. Update your task file: summary + honest verification level + evidence.
6. Update `STATUS.md` (only your rows).
7. Write `project-memory/sessions/SESSION-<YYYY-MM-DD>-<agent>.md`: what/why/surprises/open questions.
8. If a decision was made → new ADR file, never edit a merged one (mark old `superseded`).

## 3. Decision records

ADRs live in `docs/decisions/ADR-NNNN-<slug>.md`, mirrored in machine-greppable
`project-memory/decisions/ADR-NNNN.md` (frontmatter + 3-line summary).
Status: `proposed | accepted | superseded by ADR-NNNN`.

## 4. Experiments

Each experiment = `experiments/<area>/EXP-NNN-<slug>.md` with:
hypothesis, environment, commands, measurements, results, conclusion, limitations.
An experiment referencing a task must cite its ID. Results are never claimed without output.

## 5. Conflict resolution

Same-file conflicts → git merge, human resolves if semantic.
Architecture-level disagreement → stop, write both options as an ADR `proposed`, human decides.
Never fork PROJECT_CONTEXT.md.
