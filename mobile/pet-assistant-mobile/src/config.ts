/**
 * URL base del backend. En desarrollo usar tu IP o localhost.
 * Puedes definir EXPO_PUBLIC_API_URL en .env o aquí.
 */
const getBaseURL = (): string => {
  // Expo: las variables de entorno públicas se leen en build time
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env) return env.replace(/\/$/, '');
  // Por defecto: emulador Android usa 10.0.2.2:5000, iOS usa localhost
  return __DEV__ ? 'http://localhost:5000' : 'http://localhost:5000';
};

export const API_BASE_URL = getBaseURL();
