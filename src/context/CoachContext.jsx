import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useActivityTimer } from './ActivityTimerProvider';
import { useCoachState } from '../hooks/useCoachState';
import { useCoachEvents } from '../hooks/useCoachEvents';
import { withAuthQuery } from '../utils/api';
import {
    COACH_BUBBLE_COOLDOWN_MS,
    IDLE_TIMEOUT_MS,
    applyEventScoreUpdate,
    deriveContextFromPathname,
    intentFromEvent,
    shouldPromptForEvent
} from '../utils/coachRules';

const CoachContext = createContext(null);

const getStoredUser = () => {
    try {
        return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (_) {
        return {};
    }
};

export const useCoach = () => {
    const context = useContext(CoachContext);
    if (!context) {
        throw new Error('useCoach must be used within CoachProvider');
    }
    return context;
};

export const CoachProvider = ({ children }) => {
    const location = useLocation();
    const { sessionId } = useActivityTimer();
    const user = getStoredUser();
    const isLearner = Boolean(user?.id) && user?.role !== 'admin';

    const coach = useCoachState({ enabled: isLearner });
    const {
        loading,
        error,
        profile,
        state,
        recommendation,
        message,
        setState,
        logEvent,
        requestMessage,
        fetchRecommendation,
        patchState,
        hydrate
    } = coach;
    const coachEnabled = Boolean(profile?.coach_enabled);

    const [routeContext, setRouteContext] = useState(() => deriveContextFromPathname(location.pathname));
    const [bubbleVisible, setBubbleVisible] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);
    const [currentMessage, setCurrentMessage] = useState(null);

    const lastInputAtRef = useRef(Date.now());
    const isIdleRef = useRef(false);
    const lastBubbleAtRef = useRef(0);
    const lastMessageRequestAtRef = useRef(0);
    const recentRoutesRef = useRef([]);
    const lastRouteKeyRef = useRef('');
    const sessionStartedRef = useRef(null);

    const requestCoachMessage = useCallback(async (eventType, overrides = {}, options = {}) => {
        if (!isLearner || !coachEnabled) return null;
        const nowTs = Date.now();
        if (!options.force && nowTs - lastMessageRequestAtRef.current < 2500) {
            return null;
        }
        lastMessageRequestAtRef.current = nowTs;

        const frustrationScore = overrides.frustration_score ?? state?.frustration_score ?? 0;
        const intent = overrides.intent || intentFromEvent(eventType, frustrationScore);

        const payload = {
            intent,
            mode: options.mode || (panelOpen ? 'panel' : 'bubble'),
            route: routeContext.route,
            chapter_id: routeContext.chapter_id,
            level_id: routeContext.level_id,
            lesson_id: overrides.lesson_id ?? routeContext.lesson_id,
            chapter_title: overrides.chapter_title,
            level_title: overrides.level_title,
            lesson_title: overrides.lesson_title,
            lesson_excerpt: overrides.lesson_excerpt,
            age_band: profile?.age_band,
            frustration_score: frustrationScore,
            engagement_score: overrides.engagement_score ?? state?.engagement_score,
            recommended_action: overrides.recommended_action || recommendation || null,
            last_completed_lesson_id: state?.last_completed_lesson_id,
            event_type: eventType,
            sensory_mode: profile?.sensory_mode
        };

        const response = await requestMessage(payload);
        if (!response) return null;

        setCurrentMessage(response);
        const canShowBubble = nowTs - lastBubbleAtRef.current >= COACH_BUBBLE_COOLDOWN_MS;
        if (options.forceBubble || (response.intent !== 'navigation_help' && canShowBubble)) {
            lastBubbleAtRef.current = nowTs;
            setBubbleVisible(true);
        }
        return response;
    }, [
        coachEnabled,
        isLearner,
        panelOpen,
        profile?.age_band,
        profile?.sensory_mode,
        recommendation,
        requestMessage,
        routeContext,
        state?.engagement_score,
        state?.frustration_score,
        state?.last_completed_lesson_id
    ]);

    const dispatchEvent = useCallback(async (eventPayload) => {
        if (!isLearner || !coachEnabled) return;

        const payload = {
            ...eventPayload,
            route: eventPayload.route || routeContext.route,
            chapter_id: eventPayload.chapter_id ?? routeContext.chapter_id,
            level_id: eventPayload.level_id ?? routeContext.level_id,
            lesson_id: eventPayload.lesson_id ?? routeContext.lesson_id,
            session_id: sessionId ?? null,
            payload_json: eventPayload.payload_json || {}
        };

        const localScore = applyEventScoreUpdate(
            {
                frustration_score: state?.frustration_score ?? 0,
                engagement_score: state?.engagement_score ?? 5
            },
            payload.event_type,
            {
                ...payload.payload_json,
                lesson_id: payload.lesson_id
            },
            {
                last_lesson_id: state?.last_lesson_id
            }
        );

        setState((prev) => ({
            ...prev,
            ...localScore,
            last_route: payload.route,
            last_chapter_id: payload.chapter_id,
            last_level_id: payload.level_id,
            last_lesson_id: payload.lesson_id
        }));

        const response = await logEvent(payload);
        const effectiveFrustration = response?.state?.frustration_score ?? localScore.frustration_score;
        if (shouldPromptForEvent(payload.event_type, effectiveFrustration)) {
            await requestCoachMessage(payload.event_type, {
                frustration_score: effectiveFrustration
            });
        }
    }, [
        coachEnabled,
        isLearner,
        logEvent,
        requestCoachMessage,
        routeContext,
        sessionId,
        setState,
        state?.engagement_score,
        state?.frustration_score,
        state?.last_lesson_id
    ]);

    const { emitCoachEvent } = useCoachEvents({ dispatchEvent });

    useEffect(() => {
        if (!isLearner || !coachEnabled) return;

        const context = deriveContextFromPathname(location.pathname);
        const routeKey = `${context.route}:${context.chapter_id || ''}:${context.level_id || ''}:${context.lesson_id || ''}`;
        if (lastRouteKeyRef.current === routeKey) {
            return;
        }
        lastRouteKeyRef.current = routeKey;
        setRouteContext(context);

        const now = Date.now();
        recentRoutesRef.current = [...recentRoutesRef.current.filter((t) => now - t < 6000), now];
        const rapidNav = recentRoutesRef.current.length >= 4;

        emitCoachEvent('page_view', {
            route: context.route,
            chapter_id: context.chapter_id,
            level_id: context.level_id,
            lesson_id: context.lesson_id
        }, { immediate: true });

        if (context.context_type === 'chapter') {
            emitCoachEvent('chapter_opened', { route: context.route, chapter_id: context.chapter_id }, { immediate: true });
        }
        if (context.context_type === 'level') {
            emitCoachEvent('level_opened', { route: context.route, level_id: context.level_id }, { immediate: true });
        }
        if (context.context_type === 'lesson') {
            emitCoachEvent('lesson_opened', { route: context.route, level_id: context.level_id, lesson_id: context.lesson_id }, { immediate: true });
        }
        if (rapidNav) {
            emitCoachEvent('rapid_navigation', { route: context.route }, { immediate: true });
        }

        fetchRecommendation({
            route: context.route,
            frustration_score: state?.frustration_score ?? 0
        });
    }, [coachEnabled, emitCoachEvent, fetchRecommendation, isLearner, location.pathname, state?.frustration_score]);

    useEffect(() => {
        if (!isLearner || !coachEnabled) return;

        const onActivity = () => {
            lastInputAtRef.current = Date.now();
            if (isIdleRef.current) {
                isIdleRef.current = false;
                emitCoachEvent('session_reactivated', { route: routeContext.route }, { immediate: true });
            }
        };

        const onVisibility = () => {
            if (document.visibilityState === 'hidden') {
                emitCoachEvent('page_hidden', { route: routeContext.route }, { immediate: true });
            } else {
                lastInputAtRef.current = Date.now();
            }
        };

        window.addEventListener('mousemove', onActivity);
        window.addEventListener('keydown', onActivity);
        window.addEventListener('touchstart', onActivity);
        window.addEventListener('click', onActivity);
        document.addEventListener('visibilitychange', onVisibility);

        const idleInterval = window.setInterval(() => {
            const idleMs = Date.now() - lastInputAtRef.current;
            if (!isIdleRef.current && idleMs >= IDLE_TIMEOUT_MS && document.visibilityState === 'visible') {
                isIdleRef.current = true;
                emitCoachEvent('session_idle', { route: routeContext.route }, { immediate: true });
            }
        }, 3000);

        const onPageHide = () => {
            if (!sessionId || !navigator.sendBeacon) return;
            const payload = {
                event_type: 'session_end',
                route: routeContext.route,
                chapter_id: routeContext.chapter_id,
                level_id: routeContext.level_id,
                lesson_id: routeContext.lesson_id,
                session_id: sessionId,
                payload_json: {}
            };
            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
            navigator.sendBeacon(withAuthQuery('/api/ai/log_coach_event.php'), blob);
        };

        window.addEventListener('pagehide', onPageHide);

        return () => {
            window.removeEventListener('mousemove', onActivity);
            window.removeEventListener('keydown', onActivity);
            window.removeEventListener('touchstart', onActivity);
            window.removeEventListener('click', onActivity);
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('pagehide', onPageHide);
            window.clearInterval(idleInterval);
        };
    }, [coachEnabled, emitCoachEvent, isLearner, routeContext, sessionId]);

    useEffect(() => {
        if (!isLearner || !coachEnabled) return;
        if (!sessionId) return;
        if (sessionStartedRef.current === sessionId) return;
        sessionStartedRef.current = sessionId;

        emitCoachEvent('session_start', {
            route: routeContext.route,
            chapter_id: routeContext.chapter_id,
            level_id: routeContext.level_id,
            lesson_id: routeContext.lesson_id
        }, { immediate: true });
    }, [coachEnabled, emitCoachEvent, isLearner, routeContext, sessionId]);

    const acceptRecommendation = useCallback(async () => {
        if (!recommendation?.id) return;
        await patchState({
            recommendation_id: recommendation.id,
            was_shown: true,
            was_accepted: true
        });
    }, [patchState, recommendation]);

    const dismissBubble = useCallback(() => {
        setBubbleVisible(false);
    }, []);

    const value = useMemo(() => ({
        loading,
        error,
        profile,
        state,
        recommendation,
        message: currentMessage || message,
        routeContext,
        bubbleVisible,
        panelOpen,
        setPanelOpen,
        setBubbleVisible,
        dismissBubble,
        requestCoachMessage,
        emitCoachEvent,
        acceptRecommendation,
        hydrateCoach: hydrate,
        updateCoachState: patchState
    }), [
        acceptRecommendation,
        currentMessage,
        bubbleVisible,
        dismissBubble,
        emitCoachEvent,
        error,
        hydrate,
        loading,
        message,
        panelOpen,
        patchState,
        profile,
        recommendation,
        requestCoachMessage,
        routeContext,
        state
    ]);

    return (
        <CoachContext.Provider value={value}>
            {children}
        </CoachContext.Provider>
    );
};
