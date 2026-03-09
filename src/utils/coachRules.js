export const IDLE_TIMEOUT_MS = 60 * 1000;
export const COACH_BUBBLE_COOLDOWN_MS = 20 * 1000;

export const TRACKED_COACH_EVENTS = [
    'page_view',
    'session_start',
    'session_resume',
    'chapter_opened',
    'level_opened',
    'lesson_opened',
    'lesson_swipe_next',
    'lesson_swipe_prev',
    'quiz_option_selected',
    'quiz_answer_correct',
    'quiz_answer_incorrect',
    'lesson_completed',
    'session_idle',
    'session_reactivated',
    'rapid_navigation',
    'page_hidden',
    'session_end'
];

export const clampInt = (value, min, max) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return min;
    if (parsed < min) return min;
    if (parsed > max) return max;
    return Math.floor(parsed);
};

export const frustrationBand = (score) => {
    const safe = clampInt(score, 0, 99);
    if (safe >= 9) return 'strong_disengagement_risk';
    if (safe >= 6) return 'frustration_likely';
    if (safe >= 3) return 'mild_hesitation';
    return 'normal';
};

export const interventionLevel = (score) => {
    const safe = clampInt(score, 0, 99);
    if (safe >= 9) return 3;
    if (safe >= 6) return 2;
    if (safe >= 3) return 1;
    return 0;
};

export const deriveContextFromPathname = (pathname) => {
    if (!pathname) {
        return { route: '/dashboard', context_type: 'dashboard', chapter_id: null, level_id: null, lesson_id: null };
    }

    const parts = pathname.split('/').filter(Boolean);
    const first = parts[0] || 'dashboard';
    const id = parts[1] ? Number(parts[1]) : null;
    const safeId = Number.isFinite(id) ? id : null;

    if (first === 'chapter') {
        return {
            route: pathname,
            context_type: 'chapter',
            chapter_id: safeId,
            level_id: null,
            lesson_id: null
        };
    }

    if (first === 'level') {
        return {
            route: pathname,
            context_type: 'level',
            chapter_id: null,
            level_id: safeId,
            lesson_id: null
        };
    }

    if (first === 'lesson') {
        return {
            route: pathname,
            context_type: 'lesson',
            chapter_id: null,
            level_id: safeId,
            lesson_id: null
        };
    }

    return {
        route: pathname,
        context_type: 'dashboard',
        chapter_id: null,
        level_id: null,
        lesson_id: null
    };
};

export const scoreDeltaForEvent = (eventType, payload = {}, previousState = {}) => {
    let frustrationDelta = 0;
    let engagementDelta = 0;

    switch (eventType) {
        case 'quiz_answer_incorrect':
            frustrationDelta += 2;
            break;
        case 'rapid_navigation':
            frustrationDelta += 2;
            engagementDelta -= 1;
            break;
        case 'session_idle':
            frustrationDelta += 1;
            engagementDelta -= 1;
            break;
        case 'page_hidden':
            engagementDelta -= 1;
            break;
        case 'lesson_swipe_prev':
            frustrationDelta += 1;
            break;
        case 'quiz_answer_correct':
            frustrationDelta -= 2;
            engagementDelta += 1;
            break;
        case 'lesson_completed':
            frustrationDelta -= 3;
            engagementDelta += 2;
            break;
        case 'session_reactivated':
            frustrationDelta -= 1;
            engagementDelta += 1;
            break;
        default:
            break;
    }

    if (eventType === 'lesson_opened' && payload.lesson_id && previousState.last_lesson_id) {
        if (Number(payload.lesson_id) === Number(previousState.last_lesson_id)) {
            frustrationDelta += 1;
        }
    }

    if (payload.recommendation_accepted) {
        frustrationDelta -= 1;
        engagementDelta += 1;
    }

    return { frustrationDelta, engagementDelta };
};

export const applyEventScoreUpdate = (scores, eventType, payload = {}, previousState = {}) => {
    const currentFrustration = clampInt(scores?.frustration_score ?? 0, 0, 12);
    const currentEngagement = clampInt(scores?.engagement_score ?? 5, 0, 10);
    const delta = scoreDeltaForEvent(eventType, payload, previousState);

    const nextFrustration = clampInt(currentFrustration + delta.frustrationDelta, 0, 12);
    const nextEngagement = clampInt(currentEngagement + delta.engagementDelta, 0, 10);

    return {
        frustration_score: nextFrustration,
        engagement_score: nextEngagement,
        frustration_band: frustrationBand(nextFrustration),
        intervention_level: interventionLevel(nextFrustration)
    };
};

export const intentFromEvent = (eventType, frustrationScore = 0) => {
    const band = frustrationBand(frustrationScore);

    if (eventType === 'session_start') return 'welcome';
    if (eventType === 'session_resume') return 'resume_path';
    if (eventType === 'quiz_answer_correct') return 'quiz_encouragement';
    if (eventType === 'quiz_answer_incorrect') return 'mistake_reassurance';
    if (eventType === 'lesson_completed') return 'completion_celebration';
    if (eventType === 'session_idle') return 'reengagement_nudge';
    if (eventType === 'session_reactivated') return 'return_after_absence';

    if (band === 'strong_disengagement_risk') return 'break_suggestion';
    if (band === 'frustration_likely') return 'frustration_support';
    if (eventType === 'page_view') return 'navigation_help';
    return 'next_step';
};

export const shouldPromptForEvent = (eventType, frustrationScore = 0) => {
    const directPromptEvents = new Set([
        'session_start',
        'session_resume',
        'quiz_answer_correct',
        'quiz_answer_incorrect',
        'lesson_completed',
        'session_idle',
        'session_reactivated'
    ]);

    if (directPromptEvents.has(eventType)) return true;
    if (eventType === 'page_view') return false;

    const band = frustrationBand(frustrationScore);
    return band === 'frustration_likely' || band === 'strong_disengagement_risk';
};

export const shortContextLabel = (context) => {
    const type = context?.context_type || 'dashboard';
    if (type === 'lesson' && context?.lesson_id) return `Lesson ${context.lesson_id}`;
    if (type === 'level' && context?.level_id) return `Level ${context.level_id}`;
    if (type === 'chapter' && context?.chapter_id) return `Chapter ${context.chapter_id}`;
    return 'Dashboard';
};
