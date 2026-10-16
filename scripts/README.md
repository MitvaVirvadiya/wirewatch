# scripts/

| Script | Purpose | Phase |
|---|---|---|
| `smoke.ts` | Hit `/health` + `/ready` on every env, print status table | 1 |
| `simulator/` | **Synthetic provider simulator** — feeds, webhooks, schedules + failure knobs (late_file, schema_drift, duplicate_webhook, stale_data, partial_day). Product feature & demo engine | 2 |
| `seed/` | Idempotent demo tenant + monitors + events | 2 |
| `load-tests/` | Bounded generators backing `experiments/` (EXP-001…006) | 3+ |
| `failure-injection/` | Controlled chaos: malformed payloads, DB kill, worker crash, backlog | 5 |
| `backup.sh` | Weekly `pg_dump` (lab-grade DR) | 1 |

Rules: scripts must accept `--max-requests`/`--max-duration`; never target
third parties; production runs smoke only.
