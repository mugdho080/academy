import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../utils/audioUtils';

export const useGeminiLive = (initialContext = '') => {
    const [isConnected, setIsConnected] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(0);
    const [error, setError] = useState(null);
    const [logs, setLogs] = useState([]);

    const addLog = useCallback((message) => {
        console.log("GeminiLive:", message);
        setLogs(prev => [...prev.slice(-9), message]); // Keep last 10 logs
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
        addLog(isMutedRef.current ? "Muted" : "Unmuted");
    }, [addLog]);

    const cleanup = useCallback(() => {
        addLog("Cleaning up session...");
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
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close().catch(() => { });
            inputAudioContextRef.current = null;
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close().catch(() => { });
            outputAudioContextRef.current = null;
        }
        if (volumeIntervalRef.current) {
            window.clearInterval(volumeIntervalRef.current);
            volumeIntervalRef.current = null;
        }
        sourcesRef.current.forEach(source => {
            try { source.stop(); } catch (e) { }
        });
        sourcesRef.current.clear();
        setIsConnected(false);
        setIsSpeaking(false);
        setIsMuted(false);
        isMutedRef.current = false;
    }, [addLog]);

    const connect = async () => {
        addLog("Starting connection...");
        const apiKey = 'AIzaSyBh-jDANoAg3ta-ulDQLkmahoh29ua7g4s';

        if (!apiKey) {
            const msg = "API Key is missing";
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

            addLog("Init GoogleGenAI (Default Version)...");

            // Reverting to default version as per reference implementation
            const ai = new GoogleGenAI({ apiKey });

            addLog("Init GoogleGenAI with Key ending in ... " + apiKey.slice(-4));

            // Using the reference implementation's model and config
            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-12-2025',
                config: {
                    responseModalities: ['AUDIO'], // Matching reference array format
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                    },
                    systemInstruction: {
                        parts: [{ text: `You are a professional, patient, and deeply encouraging AI teacher named 'Gemini Friend' working on a special education learning platform. Your students are autistic individuals learning essential life and digital skills. Your personality is warm, clear, professional, and patient. Speak clearly, explain concepts thoroughly without rushing, and use positive reinforcement. Do not restrict your answers to just two sentences; take the time needed to properly teach the concept. Avoid overwhelming complexity, but do not talk down to the student. ${initialContext}` }]
                    },
                },
                callbacks: {
                    onopen: async () => {
                        addLog("WebSocket Opened!");
                        setIsConnected(true);
                        setError(null);
                        try {
                            addLog("Requesting Mic...");
                            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
                            if (!inputAudioContextRef.current) return;

                            inputSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
                            processorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);

                            let chunkCount = 0;
                            processorRef.current.onaudioprocess = (e) => {
                                if (isMutedRef.current) return;
                                const inputData = e.inputBuffer.getChannelData(0);
                                const audioData = createBlob(inputData);

                                if (chunkCount++ % 100 === 0) {
                                    // addLog("Sending Audio Chunk " + chunkCount);
                                    console.log("Sending Audio Chunk", chunkCount);
                                }

                                sessionPromise.then(session => {
                                    session.sendRealtimeInput({ media: audioData });
                                }).catch(e => {
                                    console.error(e);
                                });
                            };

                            inputSourceRef.current.connect(processorRef.current);
                            processorRef.current.connect(inputAudioContextRef.current.destination);
                            addLog("Audio Pipeline Ready");
                        } catch (err) {
                            addLog("Mic Setup Failed: " + err.message);
                            setError("Mic Error: " + err.message);
                            cleanup();
                        }
                    },
                    onmessage: async (message) => {
                        // Log interesting events
                        if (message.serverContent?.modelTurn) {
                            // addLog("Received Audio Chunk");
                        }
                        if (message.serverContent?.turnComplete) {
                            addLog("Turn Complete");
                        }
                        if (message.serverContent?.interrupted) {
                            addLog("Interrupted by user");
                            setIsSpeaking(false);
                            sourcesRef.current.forEach(s => { try { s.stop(); } catch (e) { } });
                            sourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                        }

                        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            setIsSpeaking(true);
                            try {
                                const ctx = outputAudioContextRef.current;
                                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                                const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                                const source = ctx.createBufferSource();
                                source.buffer = audioBuffer;
                                source.connect(ctx.destination);
                                if (analyserRef.current) source.connect(analyserRef.current);

                                source.addEventListener('ended', () => {
                                    sourcesRef.current.delete(source);
                                    if (sourcesRef.current.size === 0) setIsSpeaking(false);
                                });

                                source.start(nextStartTimeRef.current);
                                nextStartTimeRef.current += audioBuffer.duration;
                                sourcesRef.current.add(source);
                            } catch (e) {
                                addLog("Decode Error: " + e.message);
                            }
                        }
                    },
                    onclose: (e) => {
                        addLog(`Creating Closed: Code=${e.code}, Reason=${e.reason}`);
                        cleanup();
                    },
                    onerror: (e) => {
                        addLog("Fatal Error: " + e.message);
                        setError("Connection Error: " + e.message);
                        cleanup();
                    }
                }
            });

            sessionPromiseRef.current = sessionPromise;

            volumeIntervalRef.current = window.setInterval(() => {
                if (analyserRef.current && isConnected) {
                    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                    analyserRef.current.getByteFrequencyData(dataArray);
                    setVolume(dataArray.reduce((a, b) => a + b, 0) / dataArray.length);
                } else {
                    setVolume(0);
                }
            }, 50);

        } catch (err) {
            addLog("Init Exception: " + err.message);
            setError("Init Failed: " + err.message);
            cleanup();
        }
    };

    const disconnect = () => {
        addLog("User requested disconnect");
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => {
                try { session.close(); } catch (e) { console.error("Close Error:", e); }
            });
        }
        cleanup();
    };

    useEffect(() => {
        return () => {
            cleanup();
        };
    }, []);

    return { connect, disconnect, toggleMute, isConnected, isSpeaking, isMuted, volume, error, logs };
};
