/**
 * Hook reutilizable para STT (Speech-to-Text).
 * Encapsula @react-native-voice/voice: listeners, estados y limpieza.
 * Prefijo de logs: [STT].
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const LOG = '[STT]';

let Voice: typeof import('@react-native-voice/voice').default | null = null;
try {
  Voice = require('@react-native-voice/voice').default;
} catch (e) {
  console.warn(LOG, 'Voice module not loaded', e);
}

export type SttStatus = 'idle' | 'listening' | 'processing' | 'error';

export function useSpeechToText() {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isListening, setIsListening] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SttStatus>('idle');

  const isMounted = useRef(true);
  const locale = useRef('es-ES');
  const isListeningRef = useRef(false);
  const statusRef = useRef<SttStatus>('idle');
  const sessionIdRef = useRef(0);
  const activeSessionIdRef = useRef(0);
  const lastFinalProcessedInSessionRef = useRef<string>('');

  const safeSetListening = useCallback((v: boolean) => {
    if (isMounted.current) setIsListening(v);
  }, []);
  const safeSetPartial = useCallback((v: string) => {
    if (isMounted.current) setPartialText(v);
  }, []);
  const safeSetFinal = useCallback((v: string) => {
    if (isMounted.current) setFinalText(v);
  }, []);
  const safeSetError = useCallback((v: string | null) => {
    if (isMounted.current) setError(v);
  }, []);
  const safeSetStatus = useCallback((v: SttStatus) => {
    statusRef.current = v;
    if (isMounted.current) setStatus(v);
  }, []);

  useEffect(() => {
    isMounted.current = true;
    let cancelled = false;

    if (!Voice) {
      setIsAvailable(false);
      setError('Módulo de voz no disponible');
      return () => {
        isMounted.current = false;
      };
    }

    (async () => {
      try {
        const available = await Voice!.isAvailable();
        if (!cancelled && isMounted.current) {
          setIsAvailable(!!available);
          if (!available) console.warn(LOG, 'Speech recognition not available');
        }
      } catch (e) {
        console.warn(LOG, 'isAvailable check failed', e);
        if (!cancelled && isMounted.current) setIsAvailable(false);
      }
    })();

    Voice!.onSpeechStart = () => {
      console.log(LOG, 'session started:', activeSessionIdRef.current);
      safeSetError(null);
      safeSetListening(true);
      safeSetStatus('listening');
      safeSetPartial('');
      safeSetFinal('');
    };

    Voice!.onSpeechPartialResults = (e: { value?: string[] }) => {
      const activeSessionId = activeSessionIdRef.current;
      if (activeSessionId <= 0) {
        console.log(LOG, 'ignored result because there is no active session');
        return;
      }
      if (!isListeningRef.current && statusRef.current !== 'processing') {
        console.log(LOG, 'ignored late result because STT is not active');
        return;
      }
      const text = Array.isArray(e?.value) && e.value.length > 0 ? e.value[0] : '';
      if (text) {
        console.log(LOG, 'onSpeechPartialResults', text.slice(0, 40));
        safeSetPartial(text);
      }
    };

    Voice!.onSpeechResults = (e: { value?: string[] }) => {
      const activeSessionId = activeSessionIdRef.current;
      if (activeSessionId <= 0) {
        console.log(LOG, 'ignored result because there is no active session');
        return;
      }
      if (!isListeningRef.current && statusRef.current !== 'processing') {
        console.log(LOG, 'ignored late result because STT is not active');
        return;
      }
      const raw = e?.value;
      console.log(LOG, 'final raw results:', raw ?? '(null)');
      if (!Array.isArray(raw) || raw.length === 0) {
        isListeningRef.current = false;
        statusRef.current = 'processing';
        safeSetPartial('');
        safeSetStatus('processing');
        safeSetListening(false);
        return;
      }
      const firstNonEmpty = raw.map((s) => (typeof s === 'string' ? s.trim() : '')).find((s) => s.length > 0);
      const selected = firstNonEmpty ?? '';
      if (!selected) {
        isListeningRef.current = false;
        statusRef.current = 'processing';
        safeSetPartial('');
        safeSetStatus('processing');
        safeSetListening(false);
        return;
      }
      if (selected === lastFinalProcessedInSessionRef.current) {
        console.log(LOG, 'duplicate final ignored in same session');
        isListeningRef.current = false;
        statusRef.current = 'processing';
        safeSetPartial('');
        safeSetStatus('processing');
        safeSetListening(false);
        return;
      }
      lastFinalProcessedInSessionRef.current = selected;
      console.log(LOG, 'final accepted for session', activeSessionIdRef.current, ':', selected.slice(0, 60));
      isListeningRef.current = false;
      statusRef.current = 'processing';
      safeSetFinal(selected);
      safeSetPartial('');
      safeSetStatus('processing');
      safeSetListening(false);
    };

    Voice!.onSpeechEnd = () => {
      console.log(LOG, 'onSpeechEnd');
      isListeningRef.current = false;
      statusRef.current = 'idle';
      safeSetListening(false);
      safeSetStatus('idle');
    };

    Voice!.onSpeechError = (e: { error?: { code?: string; message?: string } }) => {
      const msg = e?.error?.message ?? e?.error?.code ?? 'Error de reconocimiento';
      console.warn(LOG, 'onSpeechError', msg);
      isListeningRef.current = false;
      statusRef.current = 'error';
      safeSetError(msg);
      safeSetListening(false);
      safeSetStatus('error');
    };

    return () => {
      cancelled = true;
      isMounted.current = false;
      try {
        if (Voice) {
          Voice.removeAllListeners();
          Voice.cancel().catch(() => {});
          Voice.destroy().catch(() => {});
          console.log(LOG, 'cleanup: listeners removed, cancel and destroy called');
        }
      } catch (e) {
        console.warn(LOG, 'cleanup error', e);
      }
    };
  }, []);

  const startListening = useCallback(async () => {
    if (!Voice) {
      console.warn(LOG, 'startListening skipped: Voice not loaded');
      safeSetError('Módulo de voz no disponible');
      return;
    }
    if (!isAvailable) {
      console.warn(LOG, 'startListening skipped: not available');
      safeSetError('Reconocimiento de voz no disponible');
      return;
    }
    if (isListeningRef.current) {
      console.log(LOG, 'start ignored, already listening');
      return;
    }
    if (statusRef.current === 'processing') {
      console.log(LOG, 'start ignored, still processing');
      return;
    }
    try {
      sessionIdRef.current += 1;
      activeSessionIdRef.current = sessionIdRef.current;
      lastFinalProcessedInSessionRef.current = '';
      isListeningRef.current = true;
      statusRef.current = 'listening';
      setError(null);
      setStatus('listening');
      setPartialText('');
      setFinalText('');
      console.log(LOG, 'startListening -> session', activeSessionIdRef.current);
      await Voice.start(locale.current);
    } catch (e) {
      isListeningRef.current = false;
      statusRef.current = 'idle';
      const msg = e instanceof Error ? e.message : 'No se pudo iniciar';
      console.warn(LOG, 'startListening failed', e);
      safeSetError(msg);
      safeSetStatus('error');
      safeSetListening(false);
    }
  }, [isAvailable, safeSetError, safeSetStatus, safeSetListening]);

  const resetSpeechState = useCallback(() => {
    lastFinalProcessedInSessionRef.current = '';
    setPartialText('');
    setFinalText('');
    setError(null);
    setStatus('idle');
    statusRef.current = 'idle';
    console.log(LOG, 'resetSpeechState called');
  }, []);

  const forceCloseSession = useCallback(async () => {
    console.log(LOG, 'forceCloseSession start');
    if (!Voice) {
      console.log(LOG, 'forceCloseSession done (no Voice)');
      activeSessionIdRef.current = 0;
      resetSpeechState();
      return;
    }
    try {
      if (isListeningRef.current || statusRef.current === 'processing') {
        try {
          await Voice.stop();
          console.log(LOG, 'Voice.stop success');
        } catch (stopErr) {
          console.warn(LOG, 'Voice.stop failed', stopErr);
        }
        try {
          await Voice.cancel();
          console.log(LOG, 'Voice.cancel success');
        } catch (cancelErr) {
          console.warn(LOG, 'Voice.cancel failed', cancelErr);
        }
      }
    } catch (e) {
      console.warn(LOG, 'forceCloseSession native close error', e);
    }
    isListeningRef.current = false;
    statusRef.current = 'idle';
    activeSessionIdRef.current = 0;
    console.log(LOG, 'active session cleared');
    resetSpeechState();
    console.log(LOG, 'forceCloseSession done');
  }, [resetSpeechState]);

  const stopListening = useCallback(async () => {
    if (!Voice) return;
    try {
      console.log(LOG, 'stopListening');
      await Voice.stop();
      isListeningRef.current = false;
      statusRef.current = 'idle';
      lastFinalProcessedInSessionRef.current = '';
    } catch (e) {
      console.warn(LOG, 'stopListening failed', e);
      safeSetListening(false);
      safeSetError(e instanceof Error ? e.message : 'Error al detener');
    }
  }, [safeSetListening, safeSetError]);

  const cancelListening = useCallback(async () => {
    if (!Voice) return;
    try {
      console.log(LOG, 'cancelListening');
      await Voice.cancel();
      isListeningRef.current = false;
      statusRef.current = 'idle';
      lastFinalProcessedInSessionRef.current = '';
      safeSetListening(false);
      safeSetStatus('idle');
      safeSetError(null);
      safeSetPartial('');
      safeSetFinal('');
    } catch (e) {
      console.warn(LOG, 'cancelListening failed', e);
      isListeningRef.current = false;
      safeSetListening(false);
    }
  }, [safeSetListening, safeSetStatus, safeSetError, safeSetPartial, safeSetFinal]);

  const destroyRecognition = useCallback(async () => {
    if (!Voice) return;
    try {
      console.log(LOG, 'destroyRecognition');
      await Voice.destroy();
      isListeningRef.current = false;
      statusRef.current = 'idle';
      lastFinalProcessedInSessionRef.current = '';
      safeSetListening(false);
      safeSetStatus('idle');
      safeSetError(null);
      safeSetPartial('');
      safeSetFinal('');
    } catch (e) {
      console.warn(LOG, 'destroyRecognition failed', e);
    }
  }, [safeSetListening, safeSetStatus, safeSetError, safeSetPartial, safeSetFinal]);

  const clearFinalText = useCallback(() => {
    setFinalText('');
    setPartialText('');
    setError(null);
    setStatus('idle');
  }, []);

  return {
    startListening,
    stopListening,
    cancelListening,
    destroyRecognition,
    resetSpeechState,
    forceCloseSession,
    clearFinalText,
    isListening,
    partialText,
    finalText,
    error,
    isAvailable,
    status,
  };
}
