import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  FilamentScene,
  FilamentView,
  DefaultLight,
  Model,
  Camera,
} from 'react-native-filament';
import type { AvatarSource } from '../types/avatar';
import { colors } from '../theme/colors';

// =============================================================================
// FASE ESTABLE: solo render estático. Sin animación, sin worklets, sin movimiento.
// Siguiente fase: reactivar animaciones de una en una (primero Animator/Idle,
// luego si hace falta movimiento procedural con mucho cuidado en thread safety).
// =============================================================================

type Props = {
  source: AvatarSource;
  style?: object;
};

/**
 * Escena nativa con react-native-filament. Solo se monta en development build (no en Expo Go).
 * Versión estable: modelo visible, cámara fija, luz fija, escala fija. Sin animación ni movimiento extra.
 */
export function AvatarFilamentScene({ source, style }: Props) {
  return (
    <View style={[styles.wrapper, style]}>
      <FilamentScene>
        <FilamentView style={styles.view}>
          <DefaultLight />
          <Model source={source} />
          <Camera />
        </FilamentView>
      </FilamentScene>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    minHeight: 280,
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  view: {
    flex: 1,
    minHeight: 280,
  },
});
