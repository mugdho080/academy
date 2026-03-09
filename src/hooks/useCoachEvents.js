import { useCallback, useEffect, useRef } from 'react';
import { TRACKED_COACH_EVENTS } from '../utils/coachRules';

const EVENT_DEBOUNCE_MS = 1200;

export const useCoachEvents = ({ dispatchEvent }) => {
    const lastSentRef = useRef({});
    const queuedRef = useRef({});
    const dispatchRef = useRef(dispatchEvent);

    useEffect(() => {
        dispatchRef.current = dispatchEvent;
    }, [dispatchEvent]);

    const emitCoachEvent = useCallback((eventType, payload = {}, options = {}) => {
        if (!TRACKED_COACH_EVENTS.includes(eventType)) {
            return;
        }

        const key = `${eventType}:${payload.route || ''}:${payload.lesson_id || ''}`;
        const now = Date.now();
        const immediate = Boolean(options.immediate);

        if (!immediate) {
            const lastSent = lastSentRef.current[key] || 0;
            if (now - lastSent < EVENT_DEBOUNCE_MS) {
                return;
            }
        }

        const run = () => {
            lastSentRef.current[key] = Date.now();
            dispatchRef.current?.({
                event_type: eventType,
                ...payload
            });
        };

        if (immediate) {
            run();
            return;
        }

        if (queuedRef.current[key]) {
            window.clearTimeout(queuedRef.current[key]);
        }

        queuedRef.current[key] = window.setTimeout(() => {
            run();
            delete queuedRef.current[key];
        }, options.delayMs ?? 160);
    }, []);

    return { emitCoachEvent };
};
