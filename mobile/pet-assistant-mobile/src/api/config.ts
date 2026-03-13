/**
 * Configuración de la API del backend.
 * Base URL: EXPO_PUBLIC_API_URL o localhost (iOS simulator).
 * Para dispositivo físico usa IP local ej: http://192.168.1.x:5000
 */
import { API_BASE_URL as ROOT_BASE } from '../config';

export const API_BASE_URL = ROOT_BASE;
export const REQUEST_TIMEOUT_MS = 15000;
