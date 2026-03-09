# Panda Coach Configuration

## 1) Frontend Gemini Live (Vite)

Create a `.env` file in project root:

```env
VITE_GEMINI_API_KEY=your_gemini_browser_key_here
```

Restart Vite after changes.

## 2) Backend Gemini (PHP)

Set one of these environment variables for Apache/PHP:

- `GEMINI_API_KEY`
- `GOOGLE_GENAI_API_KEY`

Example Apache vhost snippet:

```apache
SetEnv GEMINI_API_KEY your_gemini_server_key_here
```

Then restart Apache.

## 3) Database Migration

Run these SQL files in `ndis_lms`:

1. `schema.sql`
2. `activity_tracking_schema.sql`
3. `invoicing_schema.sql`
4. `coach_schema.sql`

## 4) New Coach APIs

- `POST /api/ai/coach_chat.php`
- `GET /api/ai/get_coach_recommendation.php`
- `POST /api/ai/log_coach_event.php`
- `GET /api/ai/get_coach_state.php`
- `POST /api/ai/update_coach_state.php`
- `GET /api/admin/get_coach_events.php` (admin analytics)

## 5) Safety Guardrails

- Rule-driven event model controls intent.
- LLM is bounded to short text output.
- Disallowed pressure language is filtered server-side.
- Voice remains opt-in and disabled in `quiet` sensory mode.
