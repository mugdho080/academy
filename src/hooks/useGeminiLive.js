import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../utils/audioUtils';

const normalizeOptions = (input) => {
    if (typeof input === 'string') {
        return {
            contextPrompt: input,
            coachMode: 'teaching',
            intent: 'navigation_help',
            sensoryMode: 'calm',
            ageBand: 'age_20_40',
            maxWords: 50
        };
    }

    return {
        contextPrompt: input?.contextPrompt || '',
        coachMode: input?.coachMode || 'teaching',
        intent: input?.intent || 'navigation_help',
        sensoryMode: input?.sensoryMode || 'calm',
        ageBand: input?.ageBand || 'age_20_40',
        maxWords: Number.isFinite(input?.maxWords) ? input.maxWords : 50
    };
};

export const useGeminiLive = (options = '') => {
    const config = useMemo(() => normalizeOptions(options), [options]);
    const [isConnected, setIsConnected] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(0);
    const [error, setError] = useState(null);
    const [logs, setLogs] = useState([]);

    const mood = isSpeaking ? 'encouraging' : isConnected ? 'thinking' : 'calm';

    const addLog = useCallback((message) => {
        setLogs((prev) => [...prev.slice(-9), message]);
    }, []);

    const isMutedRef = useRef(false);
    const inputAudioContextRef = useRef(null);
    const outputAudioContextRef = useRef(null);
    const streamRef = useRef(null);
    const processorRef = useRef(null);
    const inputSourceRef = useRef(null);
    const analyserRef = useRef(null);
    const nextStartTimeRef = useRef(0);
    const sourcesRef = useRef(new Set());
    const sessionPromiseRef = useRef(null);
    const volumeIntervalRef = useRef(null);

    const toggleMute = useCallback(() => {
        isMutedRef.current = !isMutedRef.current;
        setIsMuted(isMutedRef.current);
        addLog(isMutedRef.current ? 'Muted' : 'Unmuted');
    }, [addLog]);

    const cleanup = useCallback(() => {
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current.onaudioprocess = null;
            processorRef.current = null;
        }
        if (inputSourceRef.current) {
            inputSourceRef.current.disconnect();
            inputSourceRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close().catch(() => {});
            inputAudioContextRef.current = null;
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close().catch(() => {});
            outputAudioContextRef.current = null;
        }
        if (volumeIntervalRef.current) {
            window.clearInterval(volumeIntervalRef.current);
            volumeIntervalRef.current = null;
        }
        sourcesRef.current.forEach((source) => {
            try {
                source.stop();
            } catch (_) {}
        });
        sourcesRef.current.clear();

        setIsConnected(false);
        setIsSpeaking(false);
        setIsMuted(false);
        isMutedRef.current = false;
    }, []);

    const connect = useCallback(async () => {
        addLog('Starting voice coach...');
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

        if (!apiKey) {
            const msg = 'Voice is unavailable: missing VITE_GEMINI_API_KEY';
            setError(msg);
            addLog(msg);
            return;
        }

        if (config.sensoryMode === 'quiet') {
            const msg = 'Voice is off in quiet sensory mode.';
            setError(msg);
            addLog(msg);
            return;
        }

        cleanup();

        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            inputAudioContextRef.current = new AudioCtx({ sampleRate: 16000 });
            outputAudioContextRef.current = new AudioCtx({ sampleRate: 24000 });
            analyserRef.current = outputAudioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;

            const ai = new GoogleGenAI({ apiKey });
            const coachInstruction = [
                'You are Panda Coach for Goodwill Care Academy.',
                'Role: learner navigator, lesson guide, engagement coach.',
                'Rules: low stimulation, one suggestion at a time, no pressure, no guilt, no diagnosis.',
                `Mode: ${config.coachMode}. Intent: ${config.intent}.`,
                `Age band: ${config.ageBand}. Sensory mode: ${config.sensoryMode}.`,
                `Keep responses short (max ${config.maxWords} words).`,
                config.contextPrompt
            ].join(' ');

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-12-2025',
                config: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                    },
                    systemInstruction: {
                        parts: [{ text: coachInstruction }]
                    }
                },
                callbacks: {
                    onopen: async () => {
                        setIsConnected(true);
                        setError(null);
                        try {
                            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
                            if (!inputAudioContextRef.current) return;

                            await inputAudioContextRef.current.audioWorklet.addModule('/gemini-recorder.worklet.js');

                            inputSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
                            processorRef.current = new window.AudioWorkletNode(inputAudioContextRef.current, 'gemini-recorder-worklet');

                            processorRef.current.port.onmessage = (event) => {
                                if (isMutedRef.current) return;
                                const inputData = event.data;
                                const audioData = createBlob(inputData);
                                sessionPromise
                                    .then((session) => {
                                        // Ignore send attempt if we are closing
                                        try {
                                            session.sendRealtimeInput({ media: audioData });
                                        } catch (sendErr) {
                                            // Silently catch WebSocket CLOSE errors
                                        }
                                    })
                                    .catch(() => {});
                            };

                            inputSourceRef.current.connect(processorRef.current);
                            processorRef.current.connect(inputAudioContextRef.current.destination);
                        } catch (err) {
                            setError(`Mic error: ${err.message}`);
                            cleanup();
                        }
                    },
                    onmessage: async (message) => {
                        if (message.serverContent?.interrupted) {
                            setIsSpeaking(false);
                            sourcesRef.current.forEach((source) => {
                                try {
                                    source.stop();
                                } catch (_) {}
                            });
                            sourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                        }

                        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (!base64Audio || !outputAudioContextRef.current) return;

                        setIsSpeaking(true);
                        try {
                            const ctx = outputAudioContextRef.current;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                            const source = ctx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(ctx.destination);
                            if (analyserRef.current) {
                                source.connect(analyserRef.current);
                            }

                            source.addEventListener('ended', () => {
                                sourcesRef.current.delete(source);
                                if (sourcesRef.current.size === 0) {
                                    setIsSpeaking(false);
                                }
                            });

                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            sourcesRef.current.add(source);
                        } catch (err) {
                            addLog(`Audio decode error: ${err.message}`);
                        }
                    },
                    onclose: () => {
                        cleanup();
                    },
                    onerror: (event) => {
                        setError(`Connection error: ${event?.message || 'unknown'}`);
                        cleanup();
                    }
                }
            });

            sessionPromiseRef.current = sessionPromise;

            volumeIntervalRef.current = window.setInterval(() => {
                if (analyserRef.current) {
                    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                    analyserRef.current.getByteFrequencyData(dataArray);
                    setVolume(dataArray.reduce((a, b) => a + b, 0) / dataArray.length);
                } else {
                    setVolume(0);
                }
            }, 80);
        } catch (err) {
            setError(`Init failed: ${err.message}`);
            cleanup();
        }
    }, [addLog, cleanup, config]);

    const disconnect = useCallback(() => {
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then((session) => {
                try {
                    session.close();
                } catch (_) {}
            });
        }
        cleanup();
    }, [cleanup]);

    useEffect(() => () => {
        cleanup();
    }, [cleanup]);

    return {
        connect,
        disconnect,
        toggleMute,
        isConnected,
        isSpeaking,
        isMuted,
        volume,
        mood,
        error,
        logs
    };
};
