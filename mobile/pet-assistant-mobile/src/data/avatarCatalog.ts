import type { AvatarEntry } from '../types/avatar';

// Desde src/data la raíz del proyecto es ../..
const defaultAvatarGlb = require('../../assets/models/avatar.glb');

/**
 * Catálogo local de avatares. Añade más entradas para soportar múltiples modelos.
 * Para remoto, más adelante se puede cargar desde API y usar file: { uri: url }.
 */
export const avatarCatalog: AvatarEntry[] = [
  {
    id: 'avatar-default',
    name: 'Avatar principal',
    file: defaultAvatarGlb,
    // thumbnail: require('../../assets/thumbnails/avatar.png'), // opcional
  },
];

export function getAvatarById(id: string): AvatarEntry | undefined {
  return avatarCatalog.find((a) => a.id === id);
}

export function getDefaultAvatar(): AvatarEntry {
  return avatarCatalog[0];
}
