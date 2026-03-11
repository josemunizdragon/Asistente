import { api } from './client';
import type { UserProfile } from '../types/user';

export const userApi = {
  getProfile: () => api.get<UserProfile>('/api/user/profile'),
};
