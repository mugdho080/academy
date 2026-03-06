import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../utils/audioUtils';
import { GET_SYSTEM_INSTRUCTION } from '../constants';
import { NDISPlan } from '../types';

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

interface UseGeminiLiveProps {
  plan: NDISPlan | null;
}

export const useGeminiLive = ({ plan }: UseGeminiLiveProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isMutedRef = useRef(false);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const volumeIntervalRef = useRef<number | null>(null);

  const toggleMute = useCallback(() => {
    isMutedRef.current = !isMutedRef.current;
    setIsMuted(isMutedRef.current);
  }, []);

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
      streamRef.current.getTracks().forEach(track => track.stop());
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
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    sourcesRef.current.clear();
    setIsConnected(false);
    setIsSpeaking(false);
    setIsMuted(false);
    isMutedRef.current = false;
  }, []);

  const connect = async () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      setError("API Key is missing");
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
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }, 
          },
          systemInstruction: GET_SYSTEM_INSTRUCTION(plan),
        },
        callbacks: {
          onopen: async () => {
            setIsConnected(true);
            setError(null);
            try {
              streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
              if (!inputAudioContextRef.current) return;
              inputSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
              processorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
              processorRef.current.onaudioprocess = (e) => {
                if (isMutedRef.current) return;
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
              };
              inputSourceRef.current.connect(processorRef.current);
              processorRef.current.connect(inputAudioContextRef.current.destination);
            } catch (err) {
              setError("Microphone access failed.");
              cleanup();
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              setIsSpeaking(true);
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              if (analyserRef.current) {
                source.connect(analyserRef.current);
                analyserRef.current.connect(ctx.destination);
              } else {
                source.connect(ctx.destination);
              }
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setIsSpeaking(false);
              });
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
            }
          },
          onclose: () => cleanup(),
          onerror: () => {
            setError("Service unavailable.");
            cleanup();
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;
      volumeIntervalRef.current = window.setInterval(() => {
        if (analyserRef.current && isSpeaking) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setVolume(avg);
        } else {
          setVolume(0);
        }
      }, 50);

    } catch (err) {
      setError("Failed to initialize AI connection.");
      cleanup();
    }
  };

  const disconnect = () => {
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(session => { try { session.close(); } catch (e) {} });
    }
    cleanup();
  };

  useEffect(() => cleanup, [cleanup]);

  return { connect, disconnect, toggleMute, isConnected, isSpeaking, isMuted, volume, error };
};