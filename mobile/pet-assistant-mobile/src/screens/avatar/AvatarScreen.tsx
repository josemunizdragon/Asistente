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
import { getHealthDetails } from '../../api/assistantApi';

export function AvatarScreen() {
  const {
    messages,
    loading,
    error,
    lastReply,
    sendMessage,
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
  } = stt;

  const [inputText, setInputText] = useState('');
  const lastAppliedSpeechRef = useRef<string>('');
  const ignoreIncomingSpeechRef = useRef<boolean>(false);
  const sentJustNowRef = useRef<boolean>(false);
  const prevInputRef = useRef<string>('');
  const [health, setHealth] = useState<{
    ok: boolean;
    useMockOpenAi?: boolean;
    quickRepliesEnabled?: boolean;
  } | null>(null);

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
  }, [inputText, loading, sendMessage, forceCloseSession]);

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

  // Poner texto final de STT en el input; ignorar si ya se envió o es duplicado inmediato.
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
    setInputText((prev) => (prev ? prev + ' ' + trimmed : trimmed));
    console.log('[STT] final applied to input:', trimmed.slice(0, 50));
    clearFinalText();
  }, [finalText, clearFinalText]);

  const handleClearSession = useCallback(() => {
    setInputText('');
    lastAppliedSpeechRef.current = '';
    sentJustNowRef.current = true;
    resetSpeechState();
    resetSession();
  }, [resetSpeechState, resetSession]);

  const suggestedAnimation = lastReply?.suggestedAnimation ?? undefined;

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

      {/* Chat: historial + input */}
      <View style={styles.chatSection}>
        <ScrollView
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
    flex: 1,
    minHeight: 240,
    maxHeight: 320,
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
  chatSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingBottom: 16,
    minHeight: 160,
  },
  messageList: {
    maxHeight: 140,
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
