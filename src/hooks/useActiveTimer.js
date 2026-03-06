import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// Helper to generate a unique chunk ID
const generateUniqueId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export const useActiveTimer = (userId) => {
    const [seconds, setSeconds] = useState(0);

    // Refs to keep track of current chunk without triggering re-renders
    const chunkIdRef = useRef(null);
    const chunkStartRef = useRef(null);
    const syncIntervalRef = useRef(null);
    const counterIntervalRef = useRef(null);

    // We also need the latest userId & sessionId for our event listeners
    const userRef = useRef(userId);
    useEffect(() => {
        userRef.current = userId;
    }, [userId]);

    const sendChunkToBackend = () => {
        if (!userRef.current || !chunkIdRef.current || !chunkStartRef.current) return;

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const sessionId = user.session_id;
        const now = new Date();

        // Calculate seconds since last update for backwards compatibility
        const elapsedSecs = Math.floor((now.getTime() - chunkStartRef.current.getTime()) / 1000);

        axios.post('/api/learner/track_time.php', {
            user_id: userRef.current,
            session_id: sessionId,
            chunk_id: chunkIdRef.current,
            chunk_start: chunkStartRef.current.toISOString().slice(0, 19).replace('T', ' '),
            chunk_end: now.toISOString().slice(0, 19).replace('T', ' '),
            seconds: elapsedSecs > 0 ? elapsedSecs : 1 // Pass at least 1 second if called immediately
        }).catch(err => console.error("Error syncing time:", err));
    };

    const startNewChunk = () => {
        chunkIdRef.current = generateUniqueId();
        chunkStartRef.current = new Date();
    };

    useEffect(() => {
        if (!userId) return;

        // Initialize first chunk
        startNewChunk();

        // Counter for UI display
        counterIntervalRef.current = setInterval(() => {
            setSeconds(s => s + 1);
        }, 1000);

        // Periodic sync to ensure we don't lose data if browser crashes
        syncIntervalRef.current = setInterval(() => {
            if (document.visibilityState === 'visible') {
                sendChunkToBackend();
            }
        }, 60000);

        // Visibility change handler (tab switching, minimizing)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                // User left the tab, send final chunk update and stop counter
                sendChunkToBackend();
                clearInterval(counterIntervalRef.current);
            } else if (document.visibilityState === 'visible') {
                // User returned, start a new chunk and resume counter
                startNewChunk();
                counterIntervalRef.current = setInterval(() => {
                    setSeconds(s => s + 1);
                }, 1000);
            }
        };

        // Before unload handler (closing tab/browser)
        const handleBeforeUnload = () => {
            sendChunkToBackend();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            // Cleanup on unmount (navigation)
            sendChunkToBackend();
            clearInterval(counterIntervalRef.current);
            clearInterval(syncIntervalRef.current);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [userId]);

    const formatTime = (totalSeconds) => {
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return { seconds, formatTime: formatTime(seconds) };
};
