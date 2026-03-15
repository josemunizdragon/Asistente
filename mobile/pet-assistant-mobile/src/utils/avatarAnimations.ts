/**
 * Lista cerrada de animaciones válidas (alineada con backend).
 * Temporal: tras un tiempo se vuelve a idle. Persistente: se mantiene hasta nuevo cambio.
 */
export const VALID_AVATAR_ANIMATIONS = new Set([
  'idle',
  'wave',
  'yes',
  'no',
  'dance',
  'walking',
  'jump',
  'thumbsUp',
  'sitting',
  'standing',
  'punch',
]);

const TEMPORARY_ANIMATIONS = new Set([
  'dance',
  'jump',
  'wave',
  'yes',
  'no',
  'thumbsUp',
  'punch',
]);

/** Duración en ms tras la cual volver a idle para animaciones temporales. */
export const TEMPORARY_ANIMATION_MS = 4000;

export function isValidAvatarAnimation(value: string | null | undefined): boolean {
  if (value == null || value === '') return false;
  return VALID_AVATAR_ANIMATIONS.has(value.trim().toLowerCase());
}

export function normalizeAvatarAnimation(value: string | null | undefined): string {
  if (value == null || value === '') return 'idle';
  const v = value.trim().toLowerCase();
  if (VALID_AVATAR_ANIMATIONS.has(v)) return v;
  if (v === 'walk' || v === 'celebrate') return v === 'celebrate' ? 'dance' : 'walking';
  return 'idle';
}

export function isTemporaryAnimation(animation: string): boolean {
  return TEMPORARY_ANIMATIONS.has(animation.trim().toLowerCase());
}
