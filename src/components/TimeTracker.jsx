import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { withAuthQuery } from '../utils/api';

const PING_INTERVAL_MS = 30000; // Ping every 30 seconds

const TimeTracker = () => {
    const [sessionId, setSessionId] = useState(null);
    const intervalRef = useRef(null);
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Only track time for learners
    const isLearner = user && user.id && user.role !== 'admin';

    useEffect(() => {
        if (!isLearner) return;

        const startSession = async () => {
            try {
                const response = await axios.post('/api/index.php/learner/start_session', {
                    user_id: user.id
                });

                if (response.data.success) {
                    setSessionId(response.data.session_id);
                } else {
                    console.error("Failed to start time tracking session:", response.data.error);
                }
            } catch (err) {
                console.error("Error starting time tracking session:", err);
            }
        };

        startSession();

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isLearner, user.id]);

    useEffect(() => {
        if (!sessionId || !isLearner) return;

        const pingSession = async () => {
            try {
                await axios.post('/api/index.php/learner/ping_session', {
                    session_id: sessionId
                });
            } catch (err) {
                console.error("Error pinging time tracking session:", err);
            }
        };

        // Ping immediately once session is created, then setup interval
        pingSession();
        intervalRef.current = setInterval(pingSession, PING_INTERVAL_MS);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            // Optional: send a final beacon payload on unmount to capture the very last seconds
            if (navigator.sendBeacon) {
                const data = new Blob([JSON.stringify({ session_id: sessionId })], { type: 'application/json' });
                navigator.sendBeacon(withAuthQuery('/api/index.php/learner/ping_session'), data);
            }
        };
    }, [sessionId, isLearner]);

    // This component renders nothing, it's just a logical wrapper
    return null;
};

export default TimeTracker;
