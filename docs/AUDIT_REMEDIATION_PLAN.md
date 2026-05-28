# Audit Remediation Plan

Prioritised roadmap for the 24 findings raised in the 2026-05 architecture audit.
Each item below is tagged with its current status and the mission/commit that
addresses it.

Legend: `DONE` (landed) | `IN PROGRESS` (this mission) | `DEFERRED` (next mission, rationale below).

## Sprint 1 — Safety hardening (this mission)

| # | Audit item | Status | Notes |
|---|---|---|---|
| 1 | Restrict token-in-query auth | IN PROGRESS | Allow `?token=` only on `/api/learner/log-delta`. Reject everywhere else. |
| 2 | Lock down production CORS | IN PROGRESS | In production refuse to start when `FRONTEND_URL` is missing. No wildcard origin in production. |
| 3 | Curriculum import safety | IN PROGRESS | `POST /api/admin/import_content` now defaults to additive upsert. Destructive reset requires `{ mode: 'reset', confirm: 'RESET_CURRICULUM' }`. Frontend updated to pass the confirmation when the admin opts in. |
| 4 | Learner-controlled `/update_points.php` abuse | IN PROGRESS | Validate integer, reject negatives, cap per-request, add per-day ceiling per user. The only caller is the claw game; cap is sized for that. |
| 5 | Fail-fast on missing production env | IN PROGRESS | Refuse to start in production without `DATABASE_URL` and `JWT_SECRET`. Degraded mode kept for development. |
| 6 | Readiness vs. liveness | IN PROGRESS | Add `/api/live` and `/api/ready`. Keep `/api/health` as alias. |
| 7 | CI: typecheck script | IN PROGRESS | Root + server `typecheck` and `ci` scripts. Tests deferred (no framework installed yet). |
| 8 | Quiz answer validation | IN PROGRESS | Validate answer is finite, integer, within bounds of options array. |

## Sprint 2 — Data consistency (next mission)

| # | Audit item | Status | Notes |
|---|---|---|---|
| 9 | `time_entries` as single source of truth | DEFERRED | Cannot ship without parity verification. Reading from `time_entries` instead of `activity_log` will change visible totals. Next mission: write a parity report comparing the two tables for each user/day for the last 30 days, then cut over in a follow-up commit. |
| 10 | Schema drift / migration runner | DEFERRED | Audit confirmed runtime `information_schema` probing exists for `users.profile_image_url` and `users.about_me`. Replace with a proper migrations folder + startup check. Tracked separately. |
| 11 | Multi-tab tracking regression tests | DEFERRED | High risk of regression; needs Playwright + e2e setup which we do not yet have. |

## Sprint 3 — Testing and CI

| # | Audit item | Status | Notes |
|---|---|---|---|
| 12 | Vitest unit/integration tests | DEFERRED | This mission adds typecheck only. Adding a test framework + 1 smoke test should be its own mission so the test infra is reviewed independently. |
| 13 | Build smoke test for frontend asset serving | DEFERRED | After CI exists. |

## Sprint 4 — Repo cleanup

| # | Audit item | Status | Notes |
|---|---|---|---|
| 14 | Archive `claw-game/`, `ndismate.ai/`, nested `claw-game/claw-game/` | DEFERRED | Move to `/archive/` or separate repo. Reduces dependency surface and lockfile noise. |
| 15 | PHP-compatibility route inventory | DEFERRED | Build a mapping of every legacy endpoint to its modern equivalent before deprecation. |
| 16 | Extract admin route monolith into services | DEFERRED | `server/src/routes/admin.ts` is 1.8k lines. Split into invoice/curriculum/dashboard services. |

## Sprint 5 — Storage and media

| # | Audit item | Status | Notes |
|---|---|---|---|
| 17 | Move profile images out of DB into object storage | DEFERRED | Currently stored as base64 data URLs in `users.profile_image_url`. Bloats DB and backups. |

## Risk acceptance for this mission

- **No automated tests are added.** This mission relies on `tsc --noEmit` for safety. A
  follow-up mission must add Vitest + a smoke test before next high-risk change.
- **`time_entries` cutover is intentionally not in this mission.** Switching the analytics
  read path can change visible totals; we need a written parity report first.
- **Branch model:** this mission was instructed to "work directly on main." `main` is
  checked out in a sibling worktree, so commits land on `devfleet/coder/2-f7b47bee` and
  must be fast-merged to `main` by the orchestrator.
