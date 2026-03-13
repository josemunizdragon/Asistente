import React, { useCallback, useEffect, useState } from 'react';
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

  const [inputText, setInputText] = useState('');
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

  const handleSend = useCallback(() => {
    const t = inputText.trim();
    if (!t || loading) return;
    setInputText('');
    sendMessage(t);
  }, [inputText, loading, sendMessage]);

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

        <View style={styles.inputRow}>
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

        <Pressable style={styles.clearButton} onPress={resetSession}>
          <Text style={styles.clearButtonText}>Limpiar sesión (debug)</Text>
        </Pressable>
      </View>

      {/* Placeholder STT/TTS — conectar voz en siguiente fase */}
      {/* startListening() / stopListening() / speakText(text) */}
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
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
