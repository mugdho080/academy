import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { useLocation } from 'react-router-dom';
import { apiFetch, getToken } from '../utils/api';

const ActivityTimerContext = createContext(null);

const STORAGE_KEY = 'goodwill_activity_state_v2';
const QUEUE_KEY = 'goodwill_activity_queue_v1';
const LEADER_LOCK_KEY = 'goodwill_activity_leader_lock_v1';
const TAB_ID_KEY = 'goodwill_activity_tab_id_v1';

const IDLE_TIMEOUT_MS = 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 60 * 1000;
const LEADER_LOCK_TTL_MS = 15 * 1000;
const LEADER_LOCK_REFRESH_MS = 5 * 1000;

const defaultContext = {
    context_type: 'dashboard',
    chapter_id: null,
    level_id: null,
    lesson_id: null
};

const safeJsonParse = (value, fallback) => {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch (_) {
        return fallback;
    }
};

const normalizeId = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const getStoredUser = () => safeJsonParse(localStorage.getItem('user'), {});

const getStoredUserId = () => normalizeId(getStoredUser()?.id);

const isLearnerUser = () => {
    const user = getStoredUser();
    if (!user?.id) return false;
    return user.role !== 'admin';
};

const isTrackablePath = (pathname) => {
    if (!pathname) return false;
    if (pathname.startsWith('/login')) return false;
    if (pathname.startsWith('/signup')) return false;
    if (pathname.startsWith('/admin')) return false;
    return true;
};

const contextEquals = (a, b) => {
    if (!a || !b) return false;
    return a.context_type === b.context_type
        && normalizeId(a.chapter_id) === normalizeId(b.chapter_id)
        && normalizeId(a.level_id) === normalizeId(b.level_id)
        && normalizeId(a.lesson_id) === normalizeId(b.lesson_id);
};

const deriveContextFromPath = (pathname, lessonIdOverride = null) => {
    if (!pathname) return { ...defaultContext };

    if (pathname.startsWith('/chapter/')) {
        return {
            context_type: 'chapter',
            chapter_id: normalizeId(pathname.split('/')[2]),
            level_id: null,
            lesson_id: null
        };
    }

    if (pathname.startsWith('/level/')) {
        return {
            context_type: 'level',
            chapter_id: null,
            level_id: normalizeId(pathname.split('/')[2]),
            lesson_id: null
        };
    }

    if (pathname.startsWith('/lesson/')) {
        return {
            context_type: 'lesson',
            chapter_id: null,
            level_id: normalizeId(pathname.split('/')[2]),
            lesson_id: normalizeId(lessonIdOverride)
        };
    }

    return { ...defaultContext };
};

const ensureTabId = () => {
    const existing = sessionStorage.getItem(TAB_ID_KEY);
    if (existing) return existing;
    const generated = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(TAB_ID_KEY, generated);
    return generated;
};

const makeEventId = (tabId) => `${tabId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;

export const useActivityTimer = () => {
    const context = useContext(ActivityTimerContext);
    if (!context) {
        throw new Error('useActivityTimer must be used within ActivityTimerProvider');
    }
    return context;
};

export const ActivityTimerProvider = ({ children }) => {
    const location = useLocation();
    const initialPersisted = safeJsonParse(localStorage.getItem(STORAGE_KEY), {});
    const persistedUserId = normalizeId(initialPersisted.user_id);
    const currentUserId = getStoredUserId();
    const persistedIsValidUser = persistedUserId && currentUserId && persistedUserId === currentUserId;

    const [sessionIdState, setSessionIdState] = useState(() => {
        if (persistedIsValidUser) {
            return normalizeId(initialPersisted.sessionId ?? localStorage.getItem('ndis_session_id'));
        }
        return null;
    });
    const [activeSeconds, setActiveSeconds] = useState(() =>
        normalizeId(persistedIsValidUser ? initialPersisted.activeSeconds : 0) || 0
    );
    const [lessonIdOverride, setLessonIdOverride] = useState(() =>
        normalizeId(persistedIsValidUser ? initialPersisted.lesson_id : null)
    );
    const [currentContext, setCurrentContext] = useState(() =>
        deriveContextFromPath(location.pathname, normalizeId(persistedIsValidUser ? initialPersisted.lesson_id : null))
    );
    const [isActive, setIsActive] = useState(false);
    const [isLeader, setIsLeader] = useState(false);

    const sessionIdRef = useRef(sessionIdState);
    const contextRef = useRef(currentContext);
    const isActiveRef = useRef(false);
    const isLeaderRef = useRef(false);
    const tabIdRef = useRef(ensureTabId());
    const startInFlightRef = useRef(null);
    const flushInFlightRef = useRef(false);
    const deltaFlushInFlightRef = useRef(false);
    const pendingDeltaSecondsRef = useRef(0);
    const lastTickAtRef = useRef(Date.now());
    const previouslyEligibleRef = useRef(false);
    const onlineRef = useRef(navigator.onLine);

    const tabVisibleRef = useRef(document.visibilityState === 'visible');
    const focusedRef = useRef(typeof document.hasFocus === 'function' ? document.hasFocus() : true);
    const lastInputAtRef = useRef(Date.now());

    const queueRef = useRef(safeJsonParse(localStorage.getItem(QUEUE_KEY), []));
    if (!Array.isArray(queueRef.current)) {
        queueRef.current = [];
    }

    useEffect(() => {
        sessionIdRef.current = sessionIdState;
    }, [sessionIdState]);

    useEffect(() => {
        contextRef.current = currentContext;
    }, [currentContext]);

    const persistQueue = useCallback(() => {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queueRef.current));
    }, []);

    const enqueuePayload = useCallback((payload) => {
        queueRef.current.push(payload);
        if (queueRef.current.length > 500) {
            queueRef.current = queueRef.current.slice(-500);
        }
        persistQueue();
    }, [persistQueue]);

    const clearTrackingState = useCallback(() => {
        setSessionIdState(null);
        setActiveSeconds(0);
        setIsActive(false);
        pendingDeltaSecondsRef.current = 0;
        setLessonIdOverride(null);
        setCurrentContext(deriveContextFromPath(location.pathname, null));
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('ndis_session_id');
    }, [location.pathname]);

    const setSessionId = useCallback((value) => {
        const next = normalizeId(value);
        setSessionIdState(next);
        if (next) {
            localStorage.setItem('ndis_session_id', String(next));
        } else {
            localStorage.removeItem('ndis_session_id');
        }
    }, []);

    const computeEligibleActive = useCallback(() => {
        if (!isLearnerUser()) return false;
        if (!isTrackablePath(location.pathname)) return false;
        if (!sessionIdRef.current) return false;
        if (!isLeaderRef.current) return false;
        if (!tabVisibleRef.current) return false;
        if (!focusedRef.current) return false;

        const idleMs = Date.now() - lastInputAtRef.current;
        if (idleMs > IDLE_TIMEOUT_MS) return false;
        return true;
    }, [location.pathname]);

    const acquireLeaderLock = useCallback(() => {
        const now = Date.now();
        const mine = tabIdRef.current;
        const currentLock = safeJsonParse(localStorage.getItem(LEADER_LOCK_KEY), null);

        if (!currentLock || !currentLock.tab_id || Number(currentLock.expires_at || 0) <= now || currentLock.tab_id === mine) {
            localStorage.setItem(LEADER_LOCK_KEY, JSON.stringify({
                tab_id: mine,
                expires_at: now + LEADER_LOCK_TTL_MS
            }));
            return true;
        }
        return currentLock.tab_id === mine;
    }, []);

    const releaseLeaderLock = useCallback(() => {
        const currentLock = safeJsonParse(localStorage.getItem(LEADER_LOCK_KEY), null);
        if (currentLock?.tab_id === tabIdRef.current) {
            localStorage.removeItem(LEADER_LOCK_KEY);
        }
    }, []);

    const flushQueuedPayloads = useCallback(async () => {
        if (!onlineRef.current || !queueRef.current.length) return;
        if (!isLearnerUser()) return;
        if (flushInFlightRef.current) return;

        flushInFlightRef.current = true;
        try {
            const remaining = [];
            for (const payload of queueRef.current) {
                try {
                    const response = await apiFetch('/api/learner/log-delta', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    const data = await response.json().catch(() => ({}));

                    if (response.status === 409 || data?.session_closed) {
                        if (sessionIdRef.current === payload.session_id) {
                            setSessionId(null);
                        }
                        continue;
                    }

                    if (!response.ok || !data?.success) {
                        remaining.push(payload);
                        continue;
                    }

                    if (Number.isFinite(data.total_seconds_active)) {
                        const serverTotal = Number(data.total_seconds_active);
                        setActiveSeconds((prev) => Math.max(prev, serverTotal));
                    }
                } catch (_) {
                    remaining.push(payload);
                }
            }
            queueRef.current = remaining;
            persistQueue();
        } finally {
            flushInFlightRef.current = false;
        }
    }, [persistQueue, setSessionId]);

    const flushDelta = useCallback(async (clientEvent, options = {}) => {
        const sid = sessionIdRef.current;
        if (!sid) return false;

        const context = options.contextOverride || contextRef.current || defaultContext;
        const pendingSeconds = Number(options.forceDeltaSeconds);
        const deltaSeconds = Number.isFinite(pendingSeconds) ? pendingSeconds : pendingDeltaSecondsRef.current;
        const safeDelta = Math.max(0, Math.min(120, Math.floor(deltaSeconds)));
        const allowZero = Boolean(options.allowZero);
        const useBeacon = Boolean(options.useBeacon);

        if (!allowZero && safeDelta <= 0) {
            return true;
        }

        if (!useBeacon && deltaFlushInFlightRef.current) {
            return false;
        }

        const payload = {
            session_id: sid,
            delta_seconds_active: safeDelta,
            context_type: context.context_type || 'dashboard',
            chapter_id: normalizeId(context.chapter_id),
            level_id: normalizeId(context.level_id),
            lesson_id: normalizeId(context.lesson_id),
            client_event: clientEvent || 'manual',
            client_ts: new Date().toISOString(),
            event_id: makeEventId(tabIdRef.current),
            is_active: isActiveRef.current
        };

        if (useBeacon && navigator.sendBeacon) {
            // sendBeacon can't set headers — include token in URL query param as fallback
            const token = getToken();
            const beaconUrl = token ? `/api/learner/log-delta?token=${encodeURIComponent(token)}` : '/api/learner/log-delta';
            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
            const sent = navigator.sendBeacon(beaconUrl, blob);
            if (sent) {
                pendingDeltaSecondsRef.current = Math.max(0, pendingDeltaSecondsRef.current - safeDelta);
                return true;
            }
            enqueuePayload(payload);
            return false;
        }

        if (!onlineRef.current) {
            enqueuePayload(payload);
            return false;
        }

        deltaFlushInFlightRef.current = true;
        try {
            const response = await apiFetch('/api/learner/log-delta', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const data = await response.json().catch(() => ({}));

            if (response.status === 409 || data?.session_closed) {
                if (sessionIdRef.current === sid) {
                    setSessionId(null);
                }
                return false;
            }

            if (!response.ok || !data?.success) {
                enqueuePayload(payload);
                return false;
            }

            pendingDeltaSecondsRef.current = Math.max(0, pendingDeltaSecondsRef.current - safeDelta);

            if (Number.isFinite(data.total_seconds_active)) {
                const serverTotal = Number(data.total_seconds_active);
                setActiveSeconds((prev) => Math.max(prev, serverTotal));
            }

            return true;
        } catch (_) {
            enqueuePayload(payload);
            return false;
        } finally {
            deltaFlushInFlightRef.current = false;
        }
    }, [enqueuePayload, setSessionId]);

    const startSession = useCallback(async (contextOverride = null) => {
        if (!isLearnerUser()) return null;
        if (!isTrackablePath(location.pathname) && !contextOverride) return null;

        if (startInFlightRef.current) {
            return startInFlightRef.current;
        }

        const targetContext = contextOverride || deriveContextFromPath(location.pathname, lessonIdOverride);

        const request = (async () => {
            try {
                const response = await apiFetch('/api/learner/start-session', {
                    method: 'POST',
                    body: JSON.stringify(targetContext)
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data?.success) {
                    return null;
                }

                const nextSessionId = normalizeId(data.session_id);
                if (!nextSessionId) return null;

                setSessionId(nextSessionId);
                setCurrentContext(targetContext);
                pendingDeltaSecondsRef.current = 0;
                setActiveSeconds(normalizeId(data?.session?.total_seconds_active) || 0);
                return nextSessionId;
            } catch (_) {
                return null;
            } finally {
                startInFlightRef.current = null;
            }
        })();

        startInFlightRef.current = request;
        return request;
    }, [lessonIdOverride, location.pathname, setSessionId]);

    const ensureSession = useCallback(async () => {
        if (!isLearnerUser()) return null;
        if (!isTrackablePath(location.pathname)) return null;
        if (!isLeaderRef.current) return null;

        if (sessionIdRef.current) {
            return sessionIdRef.current;
        }
        return startSession();
    }, [location.pathname, startSession]);

    const endSession = useCallback(async ({ destroyAuth = false } = {}) => {
        const sid = sessionIdRef.current;
        if (sid) {
            await flushDelta('logout', { allowZero: true });
            try {
                await apiFetch('/api/learner/end-session', {
                    method: 'POST',
                    body: JSON.stringify({ session_id: sid, is_active: false }),
                    keepalive: true
                });
            } catch (_) {
                // Best effort only.
            }
        }

        clearTrackingState();
    }, [clearTrackingState, flushDelta]);

    const logoutLearner = useCallback(async () => {
        await endSession({ destroyAuth: false });
        localStorage.removeItem('user');
        localStorage.removeItem('token');
    }, [endSession]);

    const setCurrentLessonId = useCallback((lessonId) => {
        setLessonIdOverride(normalizeId(lessonId));
    }, []);

    useEffect(() => {
        const lockTick = () => {
            const learner = isLearnerUser();
            const trackable = isTrackablePath(location.pathname);
            if (!learner || !trackable) {
                isLeaderRef.current = false;
                setIsLeader(false);
                return;
            }

            const leader = acquireLeaderLock();
            isLeaderRef.current = leader;
            setIsLeader(leader);
        };

        lockTick();
        const interval = window.setInterval(lockTick, LEADER_LOCK_REFRESH_MS);

        return () => window.clearInterval(interval);
    }, [acquireLeaderLock, location.pathname]);

    useEffect(() => {
        const onStorage = (event) => {
            if (event.key === LEADER_LOCK_KEY) {
                const current = safeJsonParse(localStorage.getItem(LEADER_LOCK_KEY), null);
                const leader = current?.tab_id === tabIdRef.current && Number(current?.expires_at || 0) > Date.now();
                isLeaderRef.current = leader;
                setIsLeader(leader);
                return;
            }

            if (event.key === 'user' && !event.newValue) {
                clearTrackingState();
            }
        };

        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [clearTrackingState]);

    useEffect(() => {
        const persist = {
            user_id: getStoredUserId(),
            sessionId: sessionIdState,
            activeSeconds,
            lesson_id: lessonIdOverride
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(persist));
    }, [activeSeconds, lessonIdOverride, sessionIdState]);

    useEffect(() => {
        const learner = isLearnerUser();
        if (!learner) {
            clearTrackingState();
            return;
        }
        if (!isTrackablePath(location.pathname)) return;
        ensureSession();
    }, [clearTrackingState, ensureSession, location.pathname]);

    useEffect(() => {
        const retry = window.setInterval(() => {
            if (!isLearnerUser()) return;
            if (!isTrackablePath(location.pathname)) return;
            if (!isLeaderRef.current) return;
            if (sessionIdRef.current) return;
            if (startInFlightRef.current) return;
            startSession();
        }, 5000);

        return () => window.clearInterval(retry);
    }, [location.pathname, startSession]);

    useEffect(() => {
        const nextContext = deriveContextFromPath(location.pathname, lessonIdOverride);
        const previousContext = contextRef.current;

        const run = async () => {
            if (!contextEquals(previousContext, nextContext) && sessionIdRef.current) {
                await flushDelta('context_switch', { contextOverride: previousContext });
            }
            setCurrentContext(nextContext);
        };

        run();
    }, [flushDelta, lessonIdOverride, location.pathname]);

    useEffect(() => {
        const onActivity = () => {
            focusedRef.current = true;
            lastInputAtRef.current = Date.now();
        };
        const onFocus = () => {
            focusedRef.current = true;
            lastInputAtRef.current = Date.now();
        };
        const onBlur = () => {
            focusedRef.current = false;
            flushDelta('blur');
        };
        const onVisibilityChange = () => {
            tabVisibleRef.current = document.visibilityState === 'visible';
            if (tabVisibleRef.current) {
                lastInputAtRef.current = Date.now();
            } else {
                flushDelta('hidden');
            }
        };
        const onOnline = () => {
            onlineRef.current = true;
            flushQueuedPayloads();
        };
        const onOffline = () => {
            onlineRef.current = false;
        };

        window.addEventListener('mousemove', onActivity);
        window.addEventListener('keydown', onActivity);
        window.addEventListener('touchstart', onActivity);
        window.addEventListener('click', onActivity);
        window.addEventListener('scroll', onActivity);
        window.addEventListener('focus', onFocus);
        window.addEventListener('blur', onBlur);
        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);

        return () => {
            window.removeEventListener('mousemove', onActivity);
            window.removeEventListener('keydown', onActivity);
            window.removeEventListener('touchstart', onActivity);
            window.removeEventListener('click', onActivity);
            window.removeEventListener('scroll', onActivity);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('blur', onBlur);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, [flushDelta, flushQueuedPayloads]);

    useEffect(() => {
        const tick = window.setInterval(async () => {
            const now = Date.now();
            const elapsedSeconds = Math.floor((now - lastTickAtRef.current) / 1000);
            if (elapsedSeconds <= 0) return;
            lastTickAtRef.current += elapsedSeconds * 1000;

            const eligible = computeEligibleActive();
            const wasEligible = previouslyEligibleRef.current;

            if (eligible) {
                pendingDeltaSecondsRef.current += elapsedSeconds;
                setActiveSeconds((prev) => prev + elapsedSeconds);
            } else if (wasEligible) {
                await flushDelta('idle');
            }

            isActiveRef.current = eligible;
            previouslyEligibleRef.current = eligible;
            setIsActive(eligible);
        }, 1000);

        return () => window.clearInterval(tick);
    }, [computeEligibleActive, flushDelta]);

    useEffect(() => {
        const heartbeat = window.setInterval(() => {
            if (!isActiveRef.current) return;
            if (pendingDeltaSecondsRef.current <= 0) return;
            flushDelta('heartbeat');
        }, HEARTBEAT_INTERVAL_MS);

        return () => window.clearInterval(heartbeat);
    }, [flushDelta]);

    useEffect(() => {
        flushQueuedPayloads();
    }, [flushQueuedPayloads]);

    useEffect(() => {
        const sendPagehideFlush = () => {
            if (!sessionIdRef.current) return;
            flushDelta('pagehide', { useBeacon: true });
        };

        window.addEventListener('pagehide', sendPagehideFlush);
        window.addEventListener('beforeunload', sendPagehideFlush);
        return () => {
            window.removeEventListener('pagehide', sendPagehideFlush);
            window.removeEventListener('beforeunload', sendPagehideFlush);
        };
    }, [flushDelta]);

    useEffect(() => () => {
        releaseLeaderLock();
    }, [releaseLeaderLock]);

    const contextValue = useMemo(() => ({
        sessionId: sessionIdState,
        setSessionId,
        localActiveSeconds: activeSeconds,
        activeSeconds,
        isActive,
        isLeader,
        currentContext,
        startSession,
        endSession,
        logoutLearner,
        setCurrentLessonId,
        clearTrackingState
    }), [
        activeSeconds,
        clearTrackingState,
        currentContext,
        endSession,
        isActive,
        isLeader,
        logoutLearner,
        sessionIdState,
        setCurrentLessonId,
        setSessionId,
        startSession
    ]);

    return (
        <ActivityTimerContext.Provider value={contextValue}>
            {children}
        </ActivityTimerContext.Provider>
    );
};
