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
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import { AvatarViewer } from '../../components/AvatarViewer';
import { colors } from '../../theme/colors';
import { useAssistantChat } from '../../hooks/useAssistantChat';
import { useSpeechToText } from '../../hooks/useSpeechToText';
import { useTextToSpeech } from '../../hooks/useTextToSpeech';
import { getHealthDetails } from '../../api/assistantApi';
import {
  normalizeAvatarAnimation,
  isTemporaryAnimation,
  isPersistentAnimation,
  isValidAvatarAnimation,
  TEMPORARY_ANIMATION_MS,
} from '../../utils/avatarAnimations';

const FLOW_LOG = '[AssistantFlow]';
const AVATAR_ACTION_LOG = '[AvatarAction]';
const CONV_LOG = '[ConversationMode]';
const RESTART_DELAY_MS = 400;
const SILENCE_DEBOUNCE_MS = 1000;

/** Poner en true para mostrar mood/anim/tone, health y botón "Limpiar sesión" en la UI. */
const SHOW_DEBUG_UI = false;

const premium = {
  background: '#05080c',
  backgroundMid: '#080c12',
  surface: '#0c1118',
  surfaceCard: '#0a0e14',
  cardBorder: 'rgba(90, 170, 255, 0.1)',
  cardBorderStrong: 'rgba(90, 170, 255, 0.18)',
  accent: '#5eb3f6',
  accentDim: 'rgba(94, 179, 246, 0.22)',
  text: '#eef2f6',
  textSecondary: '#7d8fa3',
  pillBg: 'rgba(12, 17, 24, 0.98)',
  pillBorder: 'rgba(90, 170, 255, 0.15)',
  inputBg: 'rgba(10, 14, 20, 0.95)',
  glowInner: 'rgba(70, 130, 220, 0.06)',
  glowOuter: 'rgba(60, 100, 180, 0.04)',
  statusCalm: 'rgba(94, 179, 246, 0.5)',
  statusListening: 'rgba(80, 200, 180, 0.55)',
  statusThinking: 'rgba(220, 180, 100, 0.5)',
  statusSpeaking: 'rgba(160, 140, 255, 0.55)',
};

type Nav = NativeStackNavigationProp<AppStackParamList, 'Avatar'>;

export function AvatarScreen() {
  const navigation = useNavigation<Nav>();
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
  const revertToIdleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEffectiveAnimationRef = useRef<string>('idle');

  const [effectiveAvatarAnimation, setEffectiveAvatarAnimation] = useState<string>('idle');

  const safeScrollToEnd = useCallback((reason: string) => {
    try {
      const ref = chatScrollRef.current;
      if (!ref) return;
      requestAnimationFrame(() => {
        try {
          const r = chatScrollRef.current;
          if (r) r.scrollToEnd({ animated: true });
        } catch (e) {
          console.warn('[AvatarScreen] scrollToEnd error', e);
        }
      });
      setTimeout(() => {
        try {
          const r = chatScrollRef.current;
          if (r) r.scrollToEnd({ animated: true });
        } catch (e) {
          console.warn('[AvatarScreen] scrollToEnd (delayed) error', e);
        }
      }, 80);
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

  const handleInicio = useCallback(() => {
    try {
      navigation.navigate('Home');
    } catch (e) {
      console.warn('[AvatarScreen] handleInicio', e);
    }
  }, [navigation]);

  const handleSettings = useCallback(() => {
    try {
      Alert.alert('Próximamente', 'Ajustes estarán disponibles en una próxima actualización.');
    } catch (e) {
      console.warn('[AvatarScreen] handleSettings', e);
    }
  }, []);

  const handleQuickAction = useCallback((label: string) => {
    try {
      Alert.alert('Próximamente', `${label} estará disponible en una próxima actualización.`);
    } catch (e) {
      console.warn('[AvatarScreen] quickAction', e);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = lastReply?.suggestedAnimation ?? undefined;
      if (__DEV__) console.log(AVATAR_ACTION_LOG, 'requested animation:', raw ?? '(empty)');

      const normalized = normalizeAvatarAnimation(raw ?? '');
      if (__DEV__) console.log(AVATAR_ACTION_LOG, 'normalized animation:', normalized);

      const valid = isValidAvatarAnimation(normalized) || normalized === 'idle';
      const applied = valid ? normalized : 'idle';
      if (!valid) {
        if (__DEV__) console.log(AVATAR_ACTION_LOG, 'fallback to idle: invalid or unknown');
        lastEffectiveAnimationRef.current = 'idle';
        setEffectiveAvatarAnimation('idle');
        return;
      }

      const current = lastEffectiveAnimationRef.current;
      if (applied === current && isPersistentAnimation(applied)) {
        if (__DEV__) console.log(AVATAR_ACTION_LOG, 'ignored duplicate persistent animation:', applied);
        return;
      }

      if (revertToIdleTimeoutRef.current) {
        clearTimeout(revertToIdleTimeoutRef.current);
        revertToIdleTimeoutRef.current = null;
      }

      lastEffectiveAnimationRef.current = applied;
      setEffectiveAvatarAnimation(applied);
      if (__DEV__) console.log(AVATAR_ACTION_LOG, 'applying animation:', applied);

      if (applied !== 'idle' && isTemporaryAnimation(applied)) {
        revertToIdleTimeoutRef.current = setTimeout(() => {
          revertToIdleTimeoutRef.current = null;
          if (isMountedRef.current) {
            lastEffectiveAnimationRef.current = 'idle';
            setEffectiveAvatarAnimation('idle');
            if (__DEV__) console.log(AVATAR_ACTION_LOG, 'returning to idle from temporary:', applied);
          }
        }, TEMPORARY_ANIMATION_MS);
      }
    } catch (e) {
      console.warn(AVATAR_ACTION_LOG, 'effect error', e);
      lastEffectiveAnimationRef.current = 'idle';
      setEffectiveAvatarAnimation('idle');
      if (__DEV__) console.log(AVATAR_ACTION_LOG, 'fallback to idle: error');
    }
  }, [lastReply?.suggestedAnimation]);

  useEffect(() => {
    return () => {
      if (revertToIdleTimeoutRef.current) {
        clearTimeout(revertToIdleTimeoutRef.current);
        revertToIdleTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    safeScrollToEnd('messages updated');
  }, [messages.length, messages, safeScrollToEnd]);

  useEffect(() => {
    if (messages.length === 0) return;
    const t = setTimeout(() => safeScrollToEnd('messages updated (delayed)'), 120);
    return () => clearTimeout(t);
  }, [messages.length, messages, safeScrollToEnd]);

  const companionStatus: 'Calm' | 'Listening' | 'Thinking' | 'Speaking' =
    loading ? 'Thinking' : isSpeaking ? 'Speaking' : isListening ? 'Listening' : 'Calm';
  const statusPillStyle =
    companionStatus === 'Listening' ? styles.statusPillListening :
    companionStatus === 'Thinking' ? styles.statusPillThinking :
    companionStatus === 'Speaking' ? styles.statusPillSpeaking :
    styles.statusPillCalm;
  const statusDotStyle =
    companionStatus === 'Listening' ? styles.statusDotListening :
    companionStatus === 'Thinking' ? styles.statusDotThinking :
    companionStatus === 'Speaking' ? styles.statusDotSpeaking :
    styles.statusDotCalm;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <View style={styles.backgroundLayer} />
      <View style={styles.backgroundGlow} />

      <View style={styles.headerArea}>
        <Pressable style={styles.headerButton} onPress={handleInicio}>
          <Text style={styles.headerButtonText}>Inicio</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Avatar</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconButton} onPress={() => handleQuickAction('Necesidades')} accessibilityLabel="Necesidades">
            <Text style={styles.iconButtonText}>♥</Text>
          </Pressable>
          <Pressable style={styles.iconButton} onPress={handleSettings} accessibilityLabel="Ajustes">
            <Text style={styles.iconButtonText}>⚙</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.mainContent}>
        <View style={styles.heroWrap}>
          <View style={styles.heroGlow} />
          <View style={styles.heroArea}>
            <View style={styles.avatarSection}>
              <AvatarViewer suggestedAnimation={effectiveAvatarAnimation || undefined} />
            </View>
          </View>
          {!SHOW_DEBUG_UI && (
            <View style={[styles.companionStatusPill, statusPillStyle]}>
              <View style={[styles.companionStatusDot, statusDotStyle]} />
              <Text style={styles.companionStatusText}>{companionStatus === 'Listening' ? 'Escuchando' : companionStatus === 'Thinking' ? 'Pensando' : companionStatus === 'Speaking' ? 'Hablando' : 'En calma'}</Text>
            </View>
          )}
        </View>

        <View style={styles.chatCard}>
          <ScrollView
            ref={chatScrollRef}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {messages.map((m, i) => (
              <View
                key={i}
                style={[styles.messageBubble, m.role === 'user' ? styles.userBubble : styles.assistantBubble]}
              >
                <Text style={styles.messageRole}>{m.role === 'user' ? 'TÚ' : 'ASISTENTE'}</Text>
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
        </View>
      </View>

      <View style={styles.footerBar}>
        <View style={styles.inputRow}>
          <Pressable
            style={[styles.conversationModeBtn, conversationModeEnabled && styles.conversationModeBtnOn]}
            onPress={handleConversationModeToggle}
          >
            <View style={[styles.conversationDot, conversationModeEnabled && styles.conversationDotOn]} />
            <Text style={styles.conversationModeText}>
              {conversationModeEnabled ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
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
            placeholderTextColor={premium.textSecondary}
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
              <ActivityIndicator size="small" color={premium.text} />
            ) : (
              <Text style={styles.sendButtonText}>Enviar</Text>
            )}
          </Pressable>
        </View>
      </View>

      {SHOW_DEBUG_UI && lastReply && (
        <View style={styles.debugRow}>
          <Text style={styles.debugText}>
            mood: {lastReply.mood} · anim: {lastReply.suggestedAnimation} · tone: {lastReply.suggestedVoiceTone}
          </Text>
        </View>
      )}
      {SHOW_DEBUG_UI && health !== null && (
        <View style={styles.healthRow}>
          <Text style={[styles.healthText, !health.ok && styles.healthWarn]}>
            backend {health.ok ? 'ok' : 'no ok'}
            {health.ok && health.useMockOpenAi !== undefined && ` · mockOpenAi: ${health.useMockOpenAi}`}
            {health.ok && health.quickRepliesEnabled !== undefined && ` · quickReplies: ${health.quickRepliesEnabled}`}
          </Text>
        </View>
      )}

      {SHOW_DEBUG_UI && (
        <Pressable style={styles.clearButton} onPress={handleClearSession}>
          <Text style={styles.clearButtonText}>Limpiar sesión (debug)</Text>
        </Pressable>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: premium.background,
    paddingHorizontal: 16,
  },
  mainContent: {
    flex: 1,
    minHeight: 0,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: premium.backgroundMid,
    opacity: 0.6,
  },
  backgroundGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: premium.glowOuter,
    opacity: 1,
  },
  headerArea: {
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  headerButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: premium.accent,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: premium.textSecondary,
    letterSpacing: 0.3,
    opacity: 0.9,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: premium.pillBg,
    borderWidth: 1,
    borderColor: premium.pillBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonText: {
    fontSize: 16,
    color: premium.textSecondary,
  },
  conversationModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: premium.pillBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: premium.pillBorder,
    gap: 4,
  },
  conversationModeBtnOn: {
    backgroundColor: premium.accentDim,
    borderColor: 'rgba(94, 179, 246, 0.4)',
  },
  conversationDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: premium.textSecondary,
    opacity: 0.7,
  },
  conversationDotOn: {
    backgroundColor: premium.accent,
    opacity: 1,
  },
  conversationModeText: {
    fontSize: 10,
    fontWeight: '700',
    color: premium.text,
    letterSpacing: 0.2,
  },
  heroWrap: {
    flex: 3,
    minHeight: 220,
    marginBottom: 6,
    position: 'relative',
    alignItems: 'center',
  },
  heroGlow: {
    position: 'absolute',
    top: -12,
    left: -16,
    right: -16,
    bottom: -8,
    backgroundColor: premium.glowInner,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(90, 170, 255, 0.06)',
  },
  heroArea: {
    flex: 1,
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: premium.surface,
    borderWidth: 1,
    borderColor: premium.cardBorderStrong,
    padding: 16,
    minHeight: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarSection: {
    flex: 1,
    minHeight: 148,
  },
  companionStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  companionStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillCalm: {
    backgroundColor: 'rgba(12, 17, 24, 0.9)',
    borderColor: premium.statusCalm,
  },
  statusPillListening: {
    backgroundColor: 'rgba(12, 22, 20, 0.9)',
    borderColor: premium.statusListening,
  },
  statusPillThinking: {
    backgroundColor: 'rgba(22, 18, 12, 0.9)',
    borderColor: premium.statusThinking,
  },
  statusPillSpeaking: {
    backgroundColor: 'rgba(18, 16, 24, 0.9)',
    borderColor: premium.statusSpeaking,
  },
  companionStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: premium.textSecondary,
    letterSpacing: 0.3,
  },
  statusDotCalm: { backgroundColor: premium.statusCalm },
  statusDotListening: { backgroundColor: premium.statusListening },
  statusDotThinking: { backgroundColor: premium.statusThinking },
  statusDotSpeaking: { backgroundColor: premium.statusSpeaking },
  debugRow: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: premium.surface,
    borderRadius: 6,
    marginBottom: 4,
  },
  debugText: {
    fontSize: 11,
    color: premium.textSecondary,
  },
  healthRow: {
    paddingVertical: 2,
    marginBottom: 4,
  },
  healthText: {
    fontSize: 10,
    color: premium.textSecondary,
  },
  healthWarn: {
    color: colors.error,
  },
  chatCard: {
    flex: 1,
    maxHeight: 170,
    minHeight: 80,
    backgroundColor: premium.surfaceCard,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: premium.cardBorder,
    padding: 12,
    paddingBottom: 10,
    overflow: 'hidden',
  },
  messageList: {
    flex: 1,
    minHeight: 0,
    marginBottom: 6,
  },
  messageListContent: {
    paddingVertical: 8,
  },
  messageBubble: {
    padding: 14,
    borderRadius: 18,
    marginBottom: 12,
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(94, 179, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(94, 179, 246, 0.28)',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(15, 22, 32, 0.85)',
    borderWidth: 1,
    borderColor: premium.cardBorder,
  },
  messageRole: {
    fontSize: 9,
    color: premium.textSecondary,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  messageText: {
    fontSize: 15,
    color: premium.text,
    lineHeight: 23,
  },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: premium.surface,
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.error,
  },
  retryButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: premium.surfaceCard,
    borderRadius: 10,
  },
  retryButtonText: {
    fontSize: 12,
    color: premium.accent,
  },
  sttBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
    backgroundColor: premium.surface,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: premium.accent,
  },
  sttPartial: {
    flex: 1,
    fontSize: 13,
    color: premium.text,
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
    color: premium.accent,
  },
  footerBar: {
    backgroundColor: 'rgba(8, 12, 18, 0.95)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: premium.cardBorder,
    padding: 8,
    marginTop: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 0,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: premium.surface,
    borderWidth: 1,
    borderColor: premium.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonActive: {
    backgroundColor: premium.accentDim,
    borderColor: premium.accent,
  },
  micButtonDisabled: {
    opacity: 0.5,
  },
  micButtonText: {
    fontSize: 9,
    fontWeight: '700',
    color: premium.text,
    letterSpacing: 0.2,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: premium.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: premium.text,
    backgroundColor: premium.inputBg,
  },
  sendButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: premium.accent,
    borderRadius: 14,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: premium.background,
    letterSpacing: 0.2,
  },
  clearButton: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  clearButtonText: {
    fontSize: 11,
    color: premium.textSecondary,
  },
});
