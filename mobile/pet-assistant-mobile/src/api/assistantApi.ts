import { api } from './client';
import type { WelcomeResponse } from '../types/assistant';

export const assistantApi = {
  getWelcome: (userName?: string) =>
    api.get<WelcomeResponse>('/api/assistant/welcome', {
      params: userName ? { userName } : undefined,
    }),
};
