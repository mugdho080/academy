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
