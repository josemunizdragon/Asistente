import { api } from './client';
import type { LoginResponse, SignupResponse } from '../types/auth';

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/api/auth/login', { email, password }),

  signup: (name: string, email: string, password: string) =>
    api.post<SignupResponse>('/api/auth/signup', { name, email, password }),
};
