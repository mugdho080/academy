# Updates Log

This file is a running handover log for any agent working on this project.

## 2026-03-05

### Activity Tracking System Rebuild
- Replaced fragmented tracking model with canonical `sessions` + `time_entries`.
- Added shared backend tracking utilities in `api/services/ActivityTrackingService.php`.
- Rebuilt learner APIs:
  - `api/learner/start_session.php`
  - `api/learner/ping_active.php`
  - `api/learner/switch_context.php`
  - `api/learner/end_session.php`
  - `api/learner/get_time_summary.php`
- Rebuilt admin summary API:
  - `api/admin/get_time_summary.php`
- Added logout endpoint:
  - `api/auth/logout.php`
- Updated router:
  - `api/index.php` now routes `/auth/logout`.
- Updated DB schema deliverables:
  - `db/schema.sql` now includes canonical tracking tables.
  - Added `db/activity_tracking_schema.sql`.

### Frontend Tracking Integration
- Rebuilt global tracking provider:
  - `src/context/ActivityTimerProvider.jsx`
- Updated global timer widget:
  - `src/components/TimerWidget.jsx`
- Connected login/logout/session lifecycle:
  - `src/pages/Login.jsx`
  - `src/components/Sidebar.jsx`
  - `src/pages/AdminPanel.jsx`
- Added lesson-level context hooks:
  - `src/pages/LessonView.jsx`
- Rebuilt analytics UI with date filtering + CSV export:
  - `src/components/TimeLogsViewer.jsx`
  - `src/pages/Profile.jsx`

### CRM Session Table Collision Fix
- Renamed CRM table usage from `sessions` to `crm_sessions` in CRM scripts to avoid conflict with learner tracking sessions.

### Paused Timer Follow-up Fixes
- Updated focus/activity detection to avoid false paused state after login.
- Added automatic retry for `start_session` when no active tracking session exists.
- Relaxed learner detection logic from strict `role === 'learner'` to `role !== 'admin'` so legacy user objects without explicit role still track activity.

### 500 Error Fix (Start Session / Summary)
- Fixed auth bootstrap edge case where `auth/login.php` and `auth/signup.php` could run without `$pdo` in some Apache routing paths.
- Fixed MariaDB SQL compatibility in `at_expire_stale_sessions`:
  - Removed unsupported `INTERVAL ? MINUTE` placeholder usage.
- Fixed MariaDB `SHOW ...` schema checks:
  - Replaced prepared placeholders with safe quoted SQL for table/column/index existence checks.
- Added self-heal for wrong FK after CRM rename:
  - `time_entries.session_id` FK now auto-corrects to reference `sessions(id)` (not `crm_sessions(id)`).
- Synced fixed backend files into live XAMPP path `C:\\xampp\\htdocs\\academy\\api`.

### Timer Reset UX Fix
- Fixed UI timer jumping backwards every ping interval:
  - In `ActivityTimerProvider`, server sync now updates timer with `max(local, server)` so display never resets while logged in.
  - Backend logging remains active at ping interval; only display reconciliation behavior changed.

## 2026-03-06

### Root Cause Fix for `/profile` Zero Totals
- Fixed the zero-delta backend bug caused by PHP-side timestamp parsing mismatch:
  - `api/learner/ping_active.php` and `api/learner/end_session.php` now calculate elapsed seconds with SQL `TIMESTAMPDIFF` against `UTC_TIMESTAMP()`.
- Added UTC consistency in DB connection:
  - `api/db_connect.php` now forces PHP + MySQL session timezone to UTC.
- Verified that `sessions.total_seconds_active` and `time_entries.seconds_active` now increment and summary endpoints return non-zero totals.

### Delta Logging + Idempotency
- Added new endpoint:
  - `api/learner/log_delta.php`
- Added idempotency event table:
  - `activity_events` (unique `event_id`, session/user links, processed timestamp).
- Added backend helpers in:
  - `api/services/ActivityTrackingService.php`
  - includes `at_bucket_add_seconds`, event id/client event validators, and analytics total alignment.
- Added route support:
  - `api/index.php` now handles `/learner/log_delta`.

### Write-Reduction + Better Accuracy
- Replaced frequent 15s write pattern in frontend provider with hybrid model:
  - state-change flushes (idle/blur/hidden/context_switch/logout/pagehide)
  - heartbeat every 60s only while active
  - pagehide/beforeunload flush via `sendBeacon` to `log_delta`
- Added multi-tab leader lock (`localStorage`) to prevent double counting across tabs.
- Added offline queue for unsent deltas and replay on reconnect.
- Context tracking now flushes previous context on route change without resetting global timer.

### Reporting Alignment
- `at_fetch_time_summary()` now uses `time_entries` sum as canonical `total_active_seconds` for analytics consistency.
- Added `session_total_seconds` in response for audit comparison.
- Session range filter uses indexed datetime boundaries (`login_at >= start AND < end+1 day`) instead of `DATE(login_at)`.

### Compatibility + Schema Deliverables
- Updated SQL deliverables:
  - `db/schema.sql`
  - `db/activity_tracking_schema.sql`
  - both now include `activity_events` and `idx_time_entries_bucket`.
- Synced latest backend changes to live XAMPP path:
  - `C:\\xampp\\htdocs\\academy\\api\\...`
  - and updated `C:\\xampp\\htdocs\\academy\\db\\...` schema files.
- Applied schema updates to local DB (`ndis_lms`) using XAMPP PHP:
  - executed `db/schema.sql`
  - executed `db/activity_tracking_schema.sql`

### Quick Validation Performed
- `start_session.php` returns `session_id` successfully.
- `log_delta.php` increments totals and ignores duplicate `event_id`.
- `get_time_summary.php` returns non-zero totals for range.
- SQL checks confirm recent rows increasing:
  - `sessions.total_seconds_active`
  - `time_entries.seconds_active`

## 2026-03-07

### Full Admin Invoicing System (Goodwill Care Academy)
- Added backend invoice service:
  - `api/services/InvoiceService.php`
  - includes schema bootstrap, admin/user auth guards, invoice sequencing, time-to-hours aggregation, totals recalculation, and PDF generation helper.
- Added DB migration SQL:
  - `db/invoicing_schema.sql`
  - tables: `company_settings`, `invoice_sequences`, `invoices`, `invoice_items`, `invoice_log_sources`.
- Added admin APIs:
  - `api/admin/company_settings.php`
  - `api/admin/upload_company_logo.php`
  - `api/admin/invoice_eligible_users.php`
  - `api/admin/generate_draft_invoices.php` (supports `preview_only`)
  - `api/admin/get_invoices.php`
  - `api/admin/get_invoice_detail.php`
  - `api/admin/update_invoice.php`
  - `api/admin/change_invoice_status.php`
  - `api/admin/generate_invoice_pdf.php`
  - `api/admin/download_invoice.php`
  - `api/admin/get_user_invoices.php`
- Added learner invoice API:
  - `api/learner/get_my_invoices.php`
- Routed all new endpoints in:
  - `api/index.php`

### Frontend Invoicing UI
- Added dedicated admin invoicing page:
  - `src/pages/admin/Invoicing.jsx`
  - tabs: create, draft, unpaid, paid, company settings
  - draft generation from selected signed participants + date range
  - invoice detail edit form + save/status/PDF actions
  - company settings edit + logo upload.
- Added routes:
  - `src/App.jsx` routes `/admin/invoicing` and `/admin/company-settings`.
- Added admin navigation entry:
  - `src/pages/AdminPanel.jsx` sidebar now includes `Invoicing`.

### Paid Invoice Visibility in Profiles
- Learner profile now shows paid invoices with PDF download:
  - `src/pages/Profile.jsx`
- Admin participant view now shows participant invoices with PDF download:
  - `src/pages/admin/ParticipantDetail.jsx`

### Runtime Integration / Verification
- Synced all new API files to XAMPP runtime:
  - `C:\\xampp\\htdocs\\academy\\api\\...`
- Applied `db/invoicing_schema.sql` to local `ndis_lms` DB.
- Verified workflow with live API calls:
  - admin login
  - fetch eligible users
  - preview/generate draft invoice
  - move draft -> unpaid -> paid
  - generate invoice PDF
  - fetch user invoices (admin endpoint)
- Frontend build check passes: `npm run build`.

### Panda Coach System (Production-Grade Layer on Existing Panda)
- Added coach backend service:
  - `api/services/CoachService.php`
  - includes schema bootstrap, profile/state upserts, deterministic frustration scoring, recommendation engine, bounded/safe message generation, and intervention logging.
- Added coach AI endpoints:
  - `api/ai/coach_chat.php`
  - `api/ai/get_coach_recommendation.php`
  - `api/ai/log_coach_event.php`
  - `api/ai/get_coach_state.php`
  - `api/ai/update_coach_state.php`
- Added admin coach analytics endpoint:
  - `api/admin/get_coach_events.php`
- Routed new endpoints in:
  - `api/index.php`
- Replaced insecure generic AI endpoint behavior:
  - `api/ai/chat.php` now delegates to coach-safe generation path.

### Coach Database Migration
- Added coach migration SQL:
  - `db/coach_schema.sql`
  - tables: `learner_profiles`, `coach_state`, `coach_events`, `coach_recommendations`, `coach_interventions`.
- Applied coach migration to local DB (`ndis_lms`) using XAMPP PHP:
  - `C:\xampp\php\php.exe` execution confirmed.
- Verified table existence:
  - all five coach tables present.

### Frontend Coach Runtime
- Added global coach context + deterministic rule engine:
  - `src/context/CoachContext.jsx`
  - `src/hooks/useCoachState.js`
  - `src/hooks/useCoachEvents.js`
  - `src/utils/coachRules.js`
- Added coach UI components:
  - `src/components/PandaCoachBubble.jsx`
  - `src/components/PandaCoachPanel.jsx`
  - `src/components/PandaCoachNavigator.jsx`
- Mounted coach globally in app:
  - `src/App.jsx` now wraps routes with `CoachProvider`.
  - `src/components/SidebarLayout.jsx` now renders coach bubble/panel on learner routes.

### Panda Integration Updates (Reuse Existing Components)
- Extended existing panda components (not rebuilt):
  - `src/components/AnimatedPanda.jsx` now supports mood + animation state.
  - `src/components/AICharacter.jsx` now maps mood to visual glow and passes animation state.
  - `src/components/AIFriend.jsx` now consumes coach context (message/recommendation), opens panel, and uses structured live options.
  - `src/hooks/useGeminiLive.js` refactored for bounded coach voice prompts and env-based key (`VITE_GEMINI_API_KEY`), removed hard-coded API key.
  - `src/pages/AIFriendPage.jsx` fixed mute bug (`toggleMute`), and uses structured live options.

### Route/Event Integrations
- Dashboard coaching card + resume prompt:
  - `src/pages/Dashboard.jsx`
- Lesson-level frustration-aware events:
  - `src/pages/LessonView.jsx`
  - emits quiz correct/incorrect/select, lesson_opened/completed, swipe next/prev.
- Chapter/level event hooks:
  - `src/pages/LevelMap.jsx`
  - `src/pages/LevelDashboard.jsx`
- Profile event hook + fixed missing icon import:
  - `src/pages/Profile.jsx`
- Admin participant now displays coach analytics summary/events:
  - `src/pages/admin/ParticipantDetail.jsx`

### Security / Config
- Removed exposed Gemini keys from source.
- Added config documentation:
  - `.env.example`
  - `coach_configuration.md`

### Verification
- PHP syntax checks passed for all new/changed coach backend files.
- Frontend production build passes:
  - `npm run build`
- Synced coach backend files to XAMPP runtime:
  - `C:\xampp\htdocs\academy\api\...`
  - `C:\xampp\htdocs\academy\db\coach_schema.sql`

### Coach Request-Storm Hotfix (`ERR_INSUFFICIENT_RESOURCES`)
- Root cause:
  - `CoachContext` effects depended on the full `coach` object, causing repeated reruns and API call storms.
  - This flooded `log_coach_event.php`, `coach_chat.php`, and `get_coach_recommendation.php`.
- Fixes applied:
  - `src/context/CoachContext.jsx` now uses stable destructured dependencies instead of whole-object effect dependencies.
  - Added one-time guards:
    - route key guard (`lastRouteKeyRef`)
    - session start guard (`sessionStartedRef`)
  - `src/hooks/useCoachEvents.js` now keeps `emitCoachEvent` stable by dispatching through a ref (`dispatchRef`).
- Result:
  - coach network calls are throttled to actual events/routes instead of rerender loops.

### Coach Storm Follow-up Fix (Persistent Loop)
- Additional root causes found:
  - `Dashboard` welcome effect retriggered when `requestCoachMessage` identity changed.
  - `LessonView` lesson-open effect retriggered by coach state/recommendation dependency churn.
- Additional fixes:
  - Added one-time welcome guard in `src/pages/Dashboard.jsx` (`welcomedRef`).
  - Added per-lesson coach-open guard in `src/pages/LessonView.jsx` (`lessonCoachLoadedRef`).
  - Added global message-rate throttle in `src/context/CoachContext.jsx` (`lastMessageRequestAtRef`, 2.5s window unless forced).
- Expected result:
  - coach bubble text no longer spins rapidly.
  - `coach_chat.php` and `log_coach_event.php` request volume drops to normal event-driven levels.

## 2026-03-16 (Antigravity)

### Learner Profile Enhancements
- Added dynamic DB migrations in `scripts/migrate_goals.sql` for adding `profile_image_url` and `about_me` columns.
- Implemented new backend API endpoints for handling profile updates and picture uploads:
  - `api/learner/upload_profile_image.php`
  - `api/learner/update_profile_text.php`
  - `api/learner/fetch_user_profile.php`
- Updated `Profile.jsx` to dynamically render user attributes and manage interactive image upload flows cleanly with loading states.
- Handled backwards-compatible updates in `auth/login.php` to hydrate extended user profile properties on standard sign-in.

### Chapter Completion Dashboard Sync
- Computed dynamically calculated chapter progress using available statistics.
- Implemented new backend API:
  - `api/learner/get_chapter_progress.php`
- Added progression progress bar injection directly into `Dashboard.jsx`.
- Extended the CRM view with module progress in `admin/ParticipantDetail.jsx`.

### Router/Deployment Fixes
- Addressed deployment integration 404 block for new APIs:
  - Explicitly registered new fetch endpoints in `api/index.php`.
  - Re-synced core `/api` and `/scripts` files dynamically into the active `htdocs/academy` XAMPP environment.
