import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { AvatarViewer } from '../../components/AvatarViewer';
import { colors } from '../../theme/colors';
import { useAssistantChat } from '../../hooks/useAssistantChat';
import { useSpeechToText } from '../../hooks/useSpeechToText';
import { useTextToSpeech } from '../../hooks/useTextToSpeech';
import { getHealthDetails } from '../../api/assistantApi';

const FLOW_LOG = '[AssistantFlow]';
const CONV_LOG = '[ConversationMode]';
const RESTART_DELAY_MS = 400;
const SILENCE_DEBOUNCE_MS = 1000;

export function AvatarScreen() {
  const {
    messages,
    loading,
    error,
    lastReply,
    sendMessage,
    sendMessageAndGetReply,
    resetSession,
    clearError,
  } = useAssistantChat();

  const stt = useSpeechToText();
  const {
    startListening,
    stopListening,
    cancelListening,
    isListening,
    partialText,
    finalText,
    error: sttError,
    isAvailable: sttAvailable,
    status: sttStatus,
    clearFinalText,
    resetSpeechState,
    forceCloseSession,
    setSpeechEndCallback,
  } = stt;

  const tts = useTextToSpeech();
  const { speak, stopSpeaking, isSpeaking } = tts;

  const [conversationModeEnabled, setConversationModeEnabled] = useState(false);
  const [inputText, setInputText] = useState('');
  const lastAppliedSpeechRef = useRef<string>('');
  const ignoreIncomingSpeechRef = useRef<boolean>(false);
  const sentJustNowRef = useRef<boolean>(false);
  const prevInputRef = useRef<string>('');
  const isMountedRef = useRef(true);
  const conversationModeRef = useRef(false);
  const requestInFlightRef = useRef(false);
  const autoRestartPendingRef = useRef(false);
  const manualStopRef = useRef(false);
  const pendingSpeechTextRef = useRef('');
  const lastSpeechUpdateAtRef = useRef(0);
  const autoSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatScrollRef = useRef<ScrollView>(null);

  const safeScrollToEnd = useCallback((reason: string) => {
    const ref = chatScrollRef.current;
    if (!ref) return;
    try {
      requestAnimationFrame(() => {
        try {
          if (chatScrollRef.current) {
            chatScrollRef.current.scrollToEnd({ animated: true });
            console.log('[AvatarScreen] auto-scroll ->', reason);
          }
        } catch (e) {
          console.warn('[AvatarScreen] scrollToEnd error', e);
        }
      });
    } catch (e) {
      console.warn('[AvatarScreen] safeScrollToEnd error', e);
    }
  }, []);

  const [health, setHealth] = useState<{
    ok: boolean;
    useMockOpenAi?: boolean;
    quickRepliesEnabled?: boolean;
  } | null>(null);

  conversationModeRef.current = conversationModeEnabled;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getHealthDetails();
        if (!cancelled && res.success && res.data) {
          setHealth({
            ok: true,
            useMockOpenAi: res.data.useMockOpenAi,
            quickRepliesEnabled: res.data.quickRepliesEnabled,
          });
        } else if (!cancelled) {
          setHealth({ ok: false });
        }
      } catch (e) {
        if (!cancelled) setHealth({ ok: false });
        console.warn('[AvatarScreen] health check', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const sendMessageCore = useCallback(
    async (text: string, source: 'manual' | 'speech'): Promise<string | null> => {
      const t = (text ?? '').trim();
      if (!t) return null;
      try {
        console.log(FLOW_LOG, 'send start source=' + source);
        const reply = await sendMessageAndGetReply(t);
        if (reply !== null) {
          console.log(FLOW_LOG, 'send success');
          return reply;
        }
        console.log(FLOW_LOG, 'send failed');
        return null;
      } catch (e) {
        console.warn(FLOW_LOG, 'send failed', e);
        return null;
      }
    },
    [sendMessageAndGetReply]
  );

  const clearAutoSendTimer = useCallback(() => {
    if (autoSendTimerRef.current != null) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
  }, []);

  const restartListeningAfterReply = useCallback(() => {
    if (autoRestartPendingRef.current) {
      console.log(CONV_LOG, 'restart skipped: already pending');
      return;
    }
    if (isSpeaking) {
      console.log(CONV_LOG, 'restart skipped: TTS still speaking');
      return;
    }
    if (requestInFlightRef.current) {
      console.log(CONV_LOG, 'restart skipped: request in flight');
      return;
    }
    if (manualStopRef.current) {
      console.log(CONV_LOG, 'restart skipped: manual stop');
      return;
    }
    if (!conversationModeRef.current) {
      console.log(CONV_LOG, 'restart skipped: conversation mode off');
      return;
    }
    if (!isMountedRef.current) {
      console.log(CONV_LOG, 'restart skipped: unmounted');
      return;
    }
    autoRestartPendingRef.current = true;
    setTimeout(() => {
      autoRestartPendingRef.current = false;
      if (!isMountedRef.current || !conversationModeRef.current || manualStopRef.current) return;
      try {
        console.log(CONV_LOG, 'restarting mic');
        startListening();
        console.log(CONV_LOG, 'mic restarted');
      } catch (e) {
        console.warn(CONV_LOG, 'restart startListening error', e);
      }
    }, RESTART_DELAY_MS);
  }, [startListening, isSpeaking]);

  const handleAutoSendFromSpeech = useCallback(
    async (text: string) => {
      const t = (text ?? '').trim();
      if (!t) return;
      if (requestInFlightRef.current) {
        console.log(CONV_LOG, 'auto send skipped (request in flight)');
        return;
      }
      try {
        requestInFlightRef.current = true;
        await forceCloseSession();
        const reply = await sendMessageCore(t, 'speech');
        if (reply && isMountedRef.current) {
          console.log(CONV_LOG, 'backend reply received');
          await speak(reply);
          console.log(CONV_LOG, 'tts finished');
        }
        if (isMountedRef.current) setInputText('');
      } catch (e) {
        console.warn(CONV_LOG, 'handleAutoSendFromSpeech error', e);
        if (isMountedRef.current) setInputText('');
      } finally {
        requestInFlightRef.current = false;
        console.log(CONV_LOG, 'requestInFlight=false');
      }
      if (!isMountedRef.current || !conversationModeRef.current || manualStopRef.current) return;
      restartListeningAfterReply();
    },
    [forceCloseSession, sendMessageCore, speak, restartListeningAfterReply]
  );

  const flushConversationSpeechAndSend = useCallback(
    (reason: 'speech end' | 'silence timeout') => {
      try {
        clearAutoSendTimer();
        const text = pendingSpeechTextRef.current.trim();
        pendingSpeechTextRef.current = '';
        if (reason === 'speech end') {
          console.log(CONV_LOG, 'speech end detected');
        } else {
          console.log(CONV_LOG, 'silence timeout fired');
        }
        if (!text) return;
        console.log(CONV_LOG, 'auto send text:', text.slice(0, 60));
        handleAutoSendFromSpeech(text);
      } catch (e) {
        console.warn(CONV_LOG, 'flushConversationSpeechAndSend error', e);
      }
    },
    [clearAutoSendTimer, handleAutoSendFromSpeech]
  );

  const maybeScheduleConversationAutoSend = useCallback(
    (text: string) => {
      const t = (text ?? '').trim();
      pendingSpeechTextRef.current = t;
      lastSpeechUpdateAtRef.current = Date.now();
      if (t) console.log(CONV_LOG, 'pending speech updated:', t.slice(0, 50));
      clearAutoSendTimer();
      autoSendTimerRef.current = setTimeout(() => {
        autoSendTimerRef.current = null;
        if (conversationModeRef.current && isMountedRef.current) {
          flushConversationSpeechAndSend('silence timeout');
        }
      }, SILENCE_DEBOUNCE_MS);
    },
    [clearAutoSendTimer, flushConversationSpeechAndSend]
  );

  const handleSend = useCallback(async () => {
    const t = inputText.trim();
    if (!t || loading) return;
    ignoreIncomingSpeechRef.current = true;
    await forceCloseSession();
    setInputText('');
    lastAppliedSpeechRef.current = '';
    sentJustNowRef.current = true;
    console.log('[STT] message sent -> STT state cleared');
    sendMessage(t);
    setTimeout(() => safeScrollToEnd('user message sent'), 100);
  }, [inputText, loading, sendMessage, forceCloseSession, safeScrollToEnd]);

  // Al empezar a escuchar: permitir aplicar resultado de la nueva sesión; dejar de ignorar tras send.
  useEffect(() => {
    if (isListening) {
      lastAppliedSpeechRef.current = '';
      ignoreIncomingSpeechRef.current = false;
    }
  }, [isListening]);

  // Input vacío: limpiar estado STT (envío o borrado manual).
  useEffect(() => {
    if (inputText !== '') {
      prevInputRef.current = inputText;
      return;
    }
    lastAppliedSpeechRef.current = '';
    resetSpeechState();
    if (prevInputRef.current !== '' && !sentJustNowRef.current) console.log('[STT] input manually cleared -> STT state cleared');
    prevInputRef.current = '';
    sentJustNowRef.current = false;
  }, [inputText, resetSpeechState]);

  // Poner texto final de STT: modo conversación → buffer + debounce/onSpeechEnd; si no → solo al input.
  useEffect(() => {
    const trimmed = finalText?.trim() ?? '';
    if (!trimmed) return;
    if (ignoreIncomingSpeechRef.current) {
      console.log('[STT] screen ignored finalText after send');
      clearFinalText();
      return;
    }
    if (trimmed === lastAppliedSpeechRef.current) {
      console.log('[STT] duplicate final ignored (screen)');
      clearFinalText();
      return;
    }
    lastAppliedSpeechRef.current = trimmed;

    if (
      conversationModeRef.current &&
      !requestInFlightRef.current &&
      isMountedRef.current
    ) {
      setInputText(trimmed);
      maybeScheduleConversationAutoSend(trimmed);
      clearFinalText();
      return;
    }

    setInputText((prev) => (prev ? prev + ' ' + trimmed : trimmed));
    console.log('[STT] final applied to input:', trimmed.slice(0, 50));
    clearFinalText();
  }, [finalText, clearFinalText, maybeScheduleConversationAutoSend]);

  // En modo conversación, partialText también actualiza el buffer y reinicia el timer de silencio.
  useEffect(() => {
    const p = partialText?.trim() ?? '';
    if (!conversationModeRef.current || !p || requestInFlightRef.current) return;
    maybeScheduleConversationAutoSend(p);
  }, [partialText, maybeScheduleConversationAutoSend]);

  // Registrar callback onSpeechEnd y limpiar timer al montar/desmontar o al cambiar modo conversación.
  useEffect(() => {
    if (conversationModeEnabled) {
      setSpeechEndCallback(() => {
        if (conversationModeRef.current && isMountedRef.current && !requestInFlightRef.current) {
          flushConversationSpeechAndSend('speech end');
        }
      });
    } else {
      setSpeechEndCallback(null);
      clearAutoSendTimer();
      pendingSpeechTextRef.current = '';
    }
    return () => {
      setSpeechEndCallback(null);
      clearAutoSendTimer();
    };
  }, [conversationModeEnabled, setSpeechEndCallback, clearAutoSendTimer, flushConversationSpeechAndSend]);

  const handleClearSession = useCallback(() => {
    setInputText('');
    lastAppliedSpeechRef.current = '';
    sentJustNowRef.current = true;
    resetSpeechState();
    resetSession();
  }, [resetSpeechState, resetSession]);

  const handleConversationModeToggle = useCallback(() => {
    const next = !conversationModeEnabled;
    if (!next) {
      manualStopRef.current = true;
      autoRestartPendingRef.current = false;
      clearAutoSendTimer();
      pendingSpeechTextRef.current = '';
      stopSpeaking().catch(() => {});
      forceCloseSession().catch(() => {});
      console.log(FLOW_LOG, 'conversation mode disabled -> STT/TTS stopped');
    } else {
      manualStopRef.current = false;
    }
    setConversationModeEnabled(next);
  }, [conversationModeEnabled, stopSpeaking, forceCloseSession, clearAutoSendTimer]);

  const suggestedAnimation = lastReply?.suggestedAnimation ?? undefined;

  useEffect(() => {
    if (messages.length === 0) return;
    safeScrollToEnd('messages updated');
  }, [messages.length, messages, safeScrollToEnd]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <Text style={styles.title}>Asistente virtual</Text>

      <View style={styles.avatarSection}>
        <AvatarViewer suggestedAnimation={suggestedAnimation} />
      </View>

      {/* Debug: mood, animation, voiceTone */}
      {lastReply && (
        <View style={styles.debugRow}>
          <Text style={styles.debugText}>
            mood: {lastReply.mood} · anim: {lastReply.suggestedAnimation} · tone: {lastReply.suggestedVoiceTone}
          </Text>
        </View>
      )}

      {/* Health debug */}
      {health !== null && (
        <View style={styles.healthRow}>
          <Text style={[styles.healthText, !health.ok && styles.healthWarn]}>
            backend {health.ok ? 'ok' : 'no ok'}
            {health.ok && health.useMockOpenAi !== undefined && ` · mockOpenAi: ${health.useMockOpenAi}`}
            {health.ok && health.quickRepliesEnabled !== undefined && ` · quickReplies: ${health.quickRepliesEnabled}`}
          </Text>
        </View>
      )}

      {/* Modo conversación: ON/OFF */}
      <Pressable
        style={[styles.conversationModeBtn, conversationModeEnabled && styles.conversationModeBtnOn]}
        onPress={handleConversationModeToggle}
      >
        <Text style={styles.conversationModeText}>
          Modo conversación: {conversationModeEnabled ? 'ON' : 'OFF'}
        </Text>
      </Pressable>

      {/* Chat: historial + input */}
      <View style={styles.chatSection}>
        <ScrollView
          ref={chatScrollRef}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((m, i) => (
            <View
              key={i}
              style={[styles.messageBubble, m.role === 'user' ? styles.userBubble : styles.assistantBubble]}
            >
              <Text style={styles.messageRole}>{m.role === 'user' ? 'Tú' : 'Asistente'}</Text>
              <Text style={styles.messageText}>{m.text}</Text>
            </View>
          ))}
        </ScrollView>

        {error ? (
          <View style={styles.errorBar}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={clearError} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </Pressable>
          </View>
        ) : null}

        {/* STT: estado y error */}
        {(sttStatus === 'listening' && partialText) || sttError ? (
          <View style={styles.sttBar}>
            {sttStatus === 'listening' && partialText ? (
              <Text style={styles.sttPartial} numberOfLines={2}>{partialText}</Text>
            ) : null}
            {sttError ? (
              <Text style={styles.sttError}>{sttError}</Text>
            ) : null}
            {sttStatus === 'listening' ? (
              <Pressable onPress={cancelListening} style={styles.sttCancelBtn}>
                <Text style={styles.sttCancelText}>Cancelar</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.inputRow}>
          <Pressable
            style={[
              styles.micButton,
              isListening && styles.micButtonActive,
              !sttAvailable && styles.micButtonDisabled,
            ]}
            onPress={isListening ? stopListening : startListening}
            disabled={!sttAvailable || loading}
          >
            <Text style={styles.micButtonText}>{isListening ? 'Detener' : 'Mic'}</Text>
          </Pressable>
          <TextInput
            style={styles.input}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            editable={!loading}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable
            style={[styles.sendButton, loading && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Text style={styles.sendButtonText}>Enviar</Text>
            )}
          </Pressable>
        </View>

        <Pressable style={styles.clearButton} onPress={handleClearSession}>
          <Text style={styles.clearButtonText}>Limpiar sesión (debug)</Text>
        </Pressable>
      </View>

      {/* TTS: siguiente fase — speakText(text) */}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    paddingTop: 8,
  },
  avatarSection: {
    minHeight: 140,
    maxHeight: 200,
    height: 180,
  },
  debugRow: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
    borderRadius: 6,
    marginBottom: 4,
  },
  debugText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  healthRow: {
    paddingVertical: 2,
    marginBottom: 4,
  },
  healthText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  healthWarn: {
    color: colors.error,
  },
  conversationModeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  conversationModeBtnOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  conversationModeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  chatSection: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingBottom: 16,
    minHeight: 120,
  },
  messageList: {
    flex: 1,
    marginBottom: 8,
  },
  messageListContent: {
    paddingVertical: 4,
  },
  messageBubble: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
    maxWidth: '95%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceLight,
  },
  messageRole: {
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  messageText: {
    fontSize: 14,
    color: colors.text,
  },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.error,
  },
  retryButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: colors.surfaceLight,
    borderRadius: 6,
  },
  retryButtonText: {
    fontSize: 12,
    color: colors.primary,
  },
  sttBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 6,
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  sttPartial: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    marginRight: 8,
  },
  sttError: {
    fontSize: 12,
    color: colors.error,
    marginRight: 8,
  },
  sttCancelBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  sttCancelText: {
    fontSize: 12,
    color: colors.primary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  micButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    justifyContent: 'center',
    minWidth: 48,
  },
  micButtonActive: {
    backgroundColor: colors.primary,
  },
  micButtonDisabled: {
    opacity: 0.5,
  },
  micButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  sendButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
    borderRadius: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  sendButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  clearButton: {
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearButtonText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
});
