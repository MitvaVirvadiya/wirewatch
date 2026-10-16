# apps/

Three deployable processes, two workspace packages (ADR-0002: modular monolith).

| Package | Processes | Stack | Ports |
|---|---|---|---|
| `web/` | web | Next.js 15 App Router | 3100 |
| `api/` | **api** (`src/server.ts`) + **worker** (`src/worker.ts`) — one codebase, two entrypoints | Bun + Elysia | 3001 / 3002 (worker health) |

Railway runs `api` twice with different start commands (`start` vs `start:worker`).
Worker shares all domain modules with the API — no HTTP calls between them.

