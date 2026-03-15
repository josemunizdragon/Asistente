/**
 * Hook para el chat del asistente: historial, sesión, envío y estado del avatar.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  createConversationSession,
  sendConversationMessage,
} from '../api/assistantApi';
import {
  getOrCreateLocalUserId,
  getStoredSessionId,
  setStoredSessionId,
  clearConversationSession as clearStoredSession,
} from '../utils/sessionStorage';

export type ChatMessage = { role: 'user' | 'assistant'; text: string };

export type LastReplyState = {
  reply: string;
  mood: string;
  suggestedAnimation: string;
  suggestedVoiceTone: string;
} | null;

export function useAssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastReply, setLastReply] = useState<LastReplyState>(null);

  const ensureUserId = useCallback(async () => {
    try {
      const id = await getOrCreateLocalUserId();
      setUserId(id);
      return id;
    } catch (e) {
      console.warn('[useAssistantChat] ensureUserId', e);
      setError('No se pudo obtener el usuario');
      return null;
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = (text ?? '').trim();
      if (!trimmed) return;
      setError(null);
      setLoading(true);
      try {
        const uid = userId ?? (await getOrCreateLocalUserId());
        if (!uid) {
          setError('No se pudo obtener el usuario');
          setLoading(false);
          return;
        }
        setUserId(uid);

        let sid = sessionId ?? (await getStoredSessionId());
        if (!sid) {
          const create = await createConversationSession({
            userId: uid,
            title: 'Chat',
          });
          if (!create.success || !create.data?.sessionId) {
            setError(create.errorMessage || 'No se pudo crear la sesión');
            setLoading(false);
            return;
          }
          sid = create.data.sessionId;
          await setStoredSessionId(sid);
          setSessionId(sid);
        }

        setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);

        const send = await sendConversationMessage({
          userId: uid,
          sessionId: sid,
          message: trimmed,
          useQuickReply: true,
          saveMemory: true,
          returnVoiceHints: true,
        });

        if (!send.success || !send.data) {
          setError(send.errorMessage || 'Error al enviar el mensaje');
          setLoading(false);
          return;
        }

        const d = send.data;
        setMessages((prev) => [...prev, { role: 'assistant', text: d.reply }]);
        setLastReply({
          reply: d.reply,
          mood: d.mood ?? 'calm',
          suggestedAnimation: d.suggestedAnimation ?? 'idle',
          suggestedVoiceTone: d.suggestedVoiceTone ?? 'warm',
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error inesperado';
        setError(msg);
        console.warn('[useAssistantChat] sendMessage', e);
      } finally {
        setLoading(false);
      }
    },
    [userId, sessionId]
  );

  /** Envía mensaje y devuelve el texto de la respuesta del asistente, o null si falla. */
  const sendMessageAndGetReply = useCallback(
    async (text: string): Promise<string | null> => {
      const trimmed = (text ?? '').trim();
      if (!trimmed) return null;
      setError(null);
      setLoading(true);
      try {
        const uid = userId ?? (await getOrCreateLocalUserId());
        if (!uid) {
          setError('No se pudo obtener el usuario');
          setLoading(false);
          return null;
        }
        setUserId(uid);

        let sid = sessionId ?? (await getStoredSessionId());
        if (!sid) {
          const create = await createConversationSession({
            userId: uid,
            title: 'Chat',
          });
          if (!create.success || !create.data?.sessionId) {
            setError(create.errorMessage || 'No se pudo crear la sesión');
            setLoading(false);
            return null;
          }
          sid = create.data.sessionId;
          await setStoredSessionId(sid);
          setSessionId(sid);
        }

        setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);

        const send = await sendConversationMessage({
          userId: uid,
          sessionId: sid,
          message: trimmed,
          useQuickReply: true,
          saveMemory: true,
          returnVoiceHints: true,
        });

        if (!send.success || !send.data) {
          setError(send.errorMessage || 'Error al enviar el mensaje');
          setLoading(false);
          return null;
        }

        const d = send.data;
        setMessages((prev) => [...prev, { role: 'assistant', text: d.reply }]);
        setLastReply({
          reply: d.reply,
          mood: d.mood ?? 'calm',
          suggestedAnimation: d.suggestedAnimation ?? 'idle',
          suggestedVoiceTone: d.suggestedVoiceTone ?? 'warm',
        });
        setLoading(false);
        return d.reply ?? null;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error inesperado';
        setError(msg);
        console.warn('[useAssistantChat] sendMessageAndGetReply', e);
        setLoading(false);
        return null;
      }
    },
    [userId, sessionId]
  );

  const resetSession = useCallback(async () => {
    try {
      await clearStoredSession();
      setSessionId(null);
      setMessages([]);
      setLastReply(null);
      setError(null);
    } catch (e) {
      console.warn('[useAssistantChat] resetSession', e);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = await getOrCreateLocalUserId();
        if (!cancelled) setUserId(id);
        const sid = await getStoredSessionId();
        if (!cancelled) setSessionId(sid);
      } catch (e) {
        console.warn('[useAssistantChat] init', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    messages,
    loading,
    error,
    userId,
    sessionId,
    lastReply,
    sendMessage,
    sendMessageAndGetReply,
    resetSession,
    clearError: () => setError(null),
  };
}
