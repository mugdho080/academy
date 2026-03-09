import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { frustrationBand, interventionLevel } from '../utils/coachRules';

const defaultProfile = {
    age_band: 'age_20_40',
    sensory_mode: 'calm',
    preferred_tone: 'supportive',
    preferred_session_length_minutes: 20,
    favorite_topics: [],
    support_intensity: 'medium',
    coach_enabled: true,
    voice_enabled: false
};

const defaultState = {
    last_route: '/dashboard',
    last_chapter_id: null,
    last_level_id: null,
    last_lesson_id: null,
    last_message_type: null,
    last_message_text: '',
    last_intervention_level: 0,
    frustration_score: 0,
    engagement_score: 5,
    frustration_band: 'normal',
    last_recommendation: null
};

export const useCoachState = ({ enabled = true } = {}) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [profile, setProfile] = useState(defaultProfile);
    const [state, setState] = useState(defaultState);
    const [recommendation, setRecommendation] = useState(null);
    const [message, setMessage] = useState(null);

    const hydrate = useCallback(async () => {
        if (!enabled) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const response = await axios.get('/api/ai/get_coach_state.php');
            const payload = response.data || {};
            setProfile((prev) => ({ ...prev, ...(payload.profile || {}) }));
            setState((prev) => ({ ...prev, ...(payload.state || {}) }));
            if (payload?.state?.last_recommendation) {
                setRecommendation(payload.state.last_recommendation);
            }
            setError(null);
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to load coach state');
        } finally {
            setLoading(false);
        }
    }, [enabled]);

    useEffect(() => {
        if (!enabled) {
            setLoading(false);
            return;
        }
        hydrate();
    }, [enabled, hydrate]);

    const patchState = useCallback(async (patch = {}) => {
        if (!enabled) return null;
        try {
            const response = await axios.post('/api/ai/update_coach_state.php', patch);
            const payload = response.data || {};
            if (payload.profile) {
                setProfile((prev) => ({ ...prev, ...payload.profile }));
            }
            if (payload.state) {
                setState((prev) => ({ ...prev, ...payload.state }));
            }
            return payload;
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to update coach state');
            return null;
        }
    }, [enabled]);

    const logEvent = useCallback(async (eventPayload) => {
        if (!enabled) return null;
        try {
            const response = await axios.post('/api/ai/log_coach_event.php', eventPayload);
            const payload = response.data || {};
            if (payload.state) {
                setState((prev) => ({ ...prev, ...payload.state, frustration_band: payload.frustration_band || frustrationBand(payload.state?.frustration_score ?? prev.frustration_score) }));
            }
            return payload;
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to log coach event');
            return null;
        }
    }, [enabled]);

    const fetchRecommendation = useCallback(async ({ route, frustration_score, mark_shown = false } = {}) => {
        if (!enabled) return null;
        try {
            const response = await axios.get('/api/ai/get_coach_recommendation.php', {
                params: {
                    route,
                    frustration_score,
                    mark_shown: mark_shown ? 1 : 0
                }
            });
            setRecommendation(response.data || null);
            return response.data || null;
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to fetch recommendation');
            return null;
        }
    }, [enabled]);

    const requestMessage = useCallback(async (chatPayload) => {
        if (!enabled) return null;
        try {
            const response = await axios.post('/api/ai/coach_chat.php', chatPayload);
            const payload = response.data || null;
            setMessage(payload);
            if (payload?.recommended_action) {
                setRecommendation(payload.recommended_action);
            }
            if (typeof payload?.frustration_score === 'number') {
                setState((prev) => ({
                    ...prev,
                    frustration_score: payload.frustration_score,
                    frustration_band: payload.frustration_band || frustrationBand(payload.frustration_score),
                    last_message_type: payload.intent || prev.last_message_type,
                    last_message_text: payload.message || prev.last_message_text,
                    last_intervention_level: payload.intervention_level ?? interventionLevel(payload.frustration_score)
                }));
            }
            return payload;
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to generate coach message');
            return null;
        }
    }, [enabled]);

    const value = useMemo(() => ({
        loading,
        error,
        profile,
        state,
        recommendation,
        message,
        setState,
        setProfile,
        setRecommendation,
        setMessage,
        hydrate,
        patchState,
        logEvent,
        fetchRecommendation,
        requestMessage
    }), [
        loading,
        error,
        profile,
        state,
        recommendation,
        message,
        hydrate,
        patchState,
        logEvent,
        fetchRecommendation,
        requestMessage
    ]);

    return value;
};
