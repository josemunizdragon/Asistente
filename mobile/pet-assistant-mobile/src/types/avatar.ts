/**
 * Entrada del catálogo de avatares (local o remoto).
 * file: para Metro use require() y pase el número; para remoto use { uri: string }.
 * thumbnail: opcional; URI o require de imagen para listados.
 */
export interface AvatarEntry {
  id: string;
  name: string;
  file: number | { uri: string };
  thumbnail?: number | string;
}

export type AvatarSource = number | { uri: string };
