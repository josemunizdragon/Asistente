/**
 * Persistencia local de userId y sessionId para el chat del asistente.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_USER_ID = '@pet_assistant_conversation_user_id';
const KEY_SESSION_ID = '@pet_assistant_conversation_session_id';

function simpleGuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getOrCreateLocalUserId(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(KEY_USER_ID);
    if (stored && stored.length > 0) return stored;
    const newId = simpleGuid();
    await AsyncStorage.setItem(KEY_USER_ID, newId);
    return newId;
  } catch (e) {
    console.warn('[sessionStorage] getOrCreateLocalUserId', e);
    return simpleGuid();
  }
}

export async function getStoredSessionId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY_SESSION_ID);
  } catch (e) {
    console.warn('[sessionStorage] getStoredSessionId', e);
    return null;
  }
}

export async function setStoredSessionId(sessionId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_SESSION_ID, sessionId);
  } catch (e) {
    console.warn('[sessionStorage] setStoredSessionId', e);
  }
}

export async function clearConversationSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY_SESSION_ID);
  } catch (e) {
    console.warn('[sessionStorage] clearConversationSession', e);
  }
}
