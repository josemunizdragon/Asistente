/**
 * API del asistente conversacional: sesiones, mensajes, avatar, health.
 * Usa fetch con timeout; no lanza a la UI en errores HTTP/JSON.
 */
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './config';
import type {
  ApiResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  AssistantChatRequest,
  AssistantChatResponse,
  AvatarStateDto,
  HealthDetailsResponse,
} from '../types/assistant';

const LOG = '[AssistantApi]';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

async function fetchJson<T>(
  url: string,
  options: RequestInit
): Promise<{ ok: boolean; data?: ApiResponse<T>; errorMessage: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await withTimeout(
      fetch(url, { ...options, signal: controller.signal }),
      REQUEST_TIMEOUT_MS
    );
    clearTimeout(timeoutId);
    const text = await res.text();
    if (!res.ok) {
      console.warn(LOG, 'response not ok', res.status, url, text?.slice(0, 200));
      return { ok: false, errorMessage: `El servidor respondió con error (${res.status})` };
    }
    let data: ApiResponse<T>;
    try {
      data = JSON.parse(text) as ApiResponse<T>;
    } catch {
      console.warn(LOG, 'invalid json', url, text?.slice(0, 200));
      return { ok: false, errorMessage: 'Respuesta inválida del servidor' };
    }
    return { ok: true, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'Timeout' || msg.includes('abort')) {
      console.warn(LOG, 'timeout', url);
      return { ok: false, errorMessage: 'Tiempo de espera agotado' };
    }
    console.warn(LOG, 'fetch error', url, e);
    return { ok: false, errorMessage: 'No pude conectar con el asistente' };
  }
}

export async function createConversationSession(
  payload: CreateSessionRequest
): Promise<{ success: boolean; data?: CreateSessionResponse; errorMessage: string }> {
  const url = `${API_BASE_URL}/api/conversation/session/create`;
  const body = JSON.stringify({
    userId: payload.userId ?? null,
    title: payload.title ?? 'Chat',
  });
  console.log(LOG, 'POST', url, body);
  const out = await fetchJson<CreateSessionResponse>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!out.ok) return { success: false, errorMessage: out.errorMessage };
  const api = out.data;
  if (api?.success && api?.data) {
    console.log(LOG, 'createSession response', api.data);
    return { success: true, data: api.data, errorMessage: '' };
  }
  console.warn(LOG, 'createSession unexpected', api);
  return {
    success: false,
    errorMessage: api?.message ?? 'No se pudo crear la sesión',
  };
}

export async function sendConversationMessage(
  payload: AssistantChatRequest
): Promise<{ success: boolean; data?: AssistantChatResponse; errorMessage: string }> {
  const url = `${API_BASE_URL}/api/conversation/message`;
  const body = JSON.stringify({
    userId: payload.userId ?? null,
    sessionId: payload.sessionId ?? null,
    message: payload.message ?? '',
    useQuickReply: payload.useQuickReply ?? true,
    saveMemory: payload.saveMemory ?? true,
    returnVoiceHints: payload.returnVoiceHints ?? true,
    clientTimestamp: payload.clientTimestamp ?? null,
    locale: payload.locale ?? null,
  });
  console.log(LOG, 'POST', url, { message: payload.message?.slice(0, 50) });
  const out = await fetchJson<AssistantChatResponse>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!out.ok) return { success: false, errorMessage: out.errorMessage };
  const api = out.data;
  if (api?.success && api?.data) {
    const rt = api.data.replyText ?? api.data.reply;
    console.log(LOG, 'sendMessage response', { replyTextLength: rt?.length, suggestedAnimation: api.data.suggestedAnimation });
    return { success: true, data: api.data, errorMessage: '' };
  }
  return {
    success: false,
    errorMessage: api?.message ?? 'Error al enviar el mensaje',
  };
}

export async function getAvatarState(
  userId: string
): Promise<{ success: boolean; data?: AvatarStateDto; errorMessage: string }> {
  const url = `${API_BASE_URL}/api/avatar/${userId}/state`;
  console.log(LOG, 'GET', url);
  const out = await fetchJson<AvatarStateDto>(url, { method: 'GET' });
  if (!out.ok) return { success: false, errorMessage: out.errorMessage };
  const api = out.data;
  if (api?.success && api?.data) {
    return { success: true, data: api.data, errorMessage: '' };
  }
  return { success: false, errorMessage: api?.message ?? 'Error al obtener estado del avatar' };
}

export async function getHealthDetails(): Promise<{
  success: boolean;
  data?: HealthDetailsResponse;
  errorMessage: string;
}> {
  const url = `${API_BASE_URL}/api/health/details`;
  console.log(LOG, 'GET', url);
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(t);
    const text = await res.text();
    if (!res.ok) {
      console.warn(LOG, 'health not ok', res.status);
      return { success: false, errorMessage: `Health error ${res.status}` };
    }
    const data = JSON.parse(text) as HealthDetailsResponse;
    return { success: true, data, errorMessage: '' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(LOG, 'getHealthDetails', e);
    return { success: false, errorMessage: msg };
  }
}
