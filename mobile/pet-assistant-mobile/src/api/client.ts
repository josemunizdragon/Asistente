import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

const TOKEN_KEY = '@pet_assistant_token';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Añadir token a las peticiones si existe
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const setStoredToken = (token: string) => AsyncStorage.setItem(TOKEN_KEY, token);
export const getStoredToken = () => AsyncStorage.getItem(TOKEN_KEY);
export const removeStoredToken = () => AsyncStorage.removeItem(TOKEN_KEY);
