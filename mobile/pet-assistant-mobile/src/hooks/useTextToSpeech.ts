/**
 * Hook TTS (Text-to-Speech) con expo-speech.
 * Expone speak, stopSpeaking, isSpeaking, ttsAvailable, lastTtsError.
 * Prefijo de logs: [TTS].
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const LOG = '[TTS]';

let Speech: typeof import('expo-speech') | null = null;
try {
  Speech = require('expo-speech');
} catch (e) {
  console.warn(LOG, 'expo-speech not loaded', e);
}

export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsAvailable, setTtsAvailable] = useState(!!Speech);
  const [lastTtsError, setLastTtsError] = useState<string | null>(null);

  const isMounted = useRef(true);
  const speakResolveRef = useRef<(() => void) | null>(null);

  const safeSetSpeaking = useCallback((v: boolean) => {
    if (isMounted.current) setIsSpeaking(v);
  }, []);
  const safeSetError = useCallback((v: string | null) => {
    if (isMounted.current) setLastTtsError(v);
  }, []);

  useEffect(() => {
    isMounted.current = true;
    if (Speech) {
      setTtsAvailable(true);
      console.log(LOG, 'initialized');
    } else {
      setTtsAvailable(false);
    }
    return () => {
      isMounted.current = false;
      speakResolveRef.current = null;
      try {
        if (Speech) Speech.stop();
      } catch (e) {
        console.warn(LOG, 'cleanup stop error', e);
      }
      console.log(LOG, 'cleanup done');
    };
  }, []);

  const speak = useCallback(
    (text: string): Promise<void> => {
      return new Promise((resolve) => {
        if (!Speech || !text?.trim()) {
          resolve();
          return;
        }
        try {
          console.log(LOG, 'speak requested');
          safeSetError(null);
          Speech.stop().catch(() => {});
          speakResolveRef.current = () => {
            speakResolveRef.current = null;
            safeSetSpeaking(false);
            resolve();
          };
          safeSetSpeaking(true);
          Speech.speak(text.trim(), {
            language: 'es-ES',
            onStart: () => {
              console.log(LOG, 'speech started');
            },
            onDone: () => {
              console.log(LOG, 'speech finished');
              if (speakResolveRef.current) {
                speakResolveRef.current();
              } else {
                safeSetSpeaking(false);
                resolve();
              }
            },
            onStopped: () => {
              console.log(LOG, 'speech cancelled');
              if (speakResolveRef.current) {
                speakResolveRef.current();
              } else {
                safeSetSpeaking(false);
                resolve();
              }
            },
            onError: (err: Error) => {
              const msg = err?.message ?? 'TTS error';
              console.warn(LOG, 'speech error', msg);
              safeSetError(msg);
              if (speakResolveRef.current) {
                speakResolveRef.current();
              } else {
                safeSetSpeaking(false);
                resolve();
              }
            },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'speak failed';
          console.warn(LOG, 'speak exception', e);
          safeSetError(msg);
          safeSetSpeaking(false);
          speakResolveRef.current = null;
          resolve();
        }
      });
    },
    [safeSetError, safeSetSpeaking]
  );

  const stopSpeaking = useCallback(async () => {
    try {
      if (Speech) {
        await Speech.stop();
        if (speakResolveRef.current) {
          speakResolveRef.current();
        }
        safeSetSpeaking(false);
      }
    } catch (e) {
      console.warn(LOG, 'stopSpeaking error', e);
      safeSetSpeaking(false);
    }
  }, [safeSetSpeaking]);

  return {
    speak,
    stopSpeaking,
    isSpeaking,
    ttsAvailable,
    lastTtsError,
  };
}
