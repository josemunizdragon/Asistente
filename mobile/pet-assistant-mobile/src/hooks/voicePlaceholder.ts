/**
 * Placeholder para conectar STT/TTS en la siguiente fase.
 * No implementar todavía; solo interfaz y comentarios donde se conectará voz.
 */

// startListening() — aquí se conectará el reconocimiento de voz (STT)
// stopListening() — aquí se detendrá la escucha
// speakText(text: string) — aquí se conectará la síntesis de voz (TTS) para leer la respuesta del asistente

export interface VoiceApi {
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  speakText: (text: string) => Promise<void>;
}
