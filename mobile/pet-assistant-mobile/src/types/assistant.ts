export interface WelcomeResponse {
  message: string;
}

// --- Respuesta estándar API (alineado con backend ApiResponse<T>) ---
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T | null;
  errorCode?: string | null;
}

// --- Sesión ---
export interface CreateSessionRequest {
  userId?: string | null;
  title?: string | null;
}

export interface CreateSessionResponse {
  sessionId: string;
  title: string;
}

// --- Chat ---
export interface AssistantChatRequest {
  userId?: string | null;
  sessionId?: string | null;
  message: string;
  useQuickReply?: boolean;
  saveMemory?: boolean;
  returnVoiceHints?: boolean;
  clientTimestamp?: string | null;
  locale?: string | null;
}

export interface AssistantChatResponse {
  sessionId: string;
  reply: string;
  mood: string;
  suggestedAnimation: string;
  suggestedVoiceTone: string;
  usedQuickReply: boolean;
  savedMemory: boolean;
  memoryHints: string[];
  followUpSuggestions: string[];
}

// --- Avatar state ---
export interface AvatarStateDto {
  userId: string;
  mood: string;
  energy: string;
  attachmentLevel: string;
  lastInteractionAtUtc: string;
  consecutiveDaysActive: number;
  currentNeed?: string | null;
  suggestedAnimation: string;
  suggestedVoiceTone: string;
}

// --- Health ---
export interface HealthDetailsResponse {
  status: string;
  timestamp: string;
  openAiConfigured: boolean;
  useMockOpenAi: boolean;
  quickRepliesEnabled: boolean;
  longMemoryEnabled: boolean;
}

// --- User context (para futura expansión) ---
export interface UserContextResponse {
  userId: string;
  sessionCount: number;
  messageCount: number;
}
