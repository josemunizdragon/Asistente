import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

/**
 * Avatar 3D — Fase 1: pantalla estable en Expo Native.
 * Three.js y GLTFLoader acceden a `document` al importar, por eso no se usan aquí.
 * Fase 2: integrar un visor GLB compatible con RN (ej. expo-gl sin three, o librería nativa).
 */
export function AvatarViewer() {
  return (
    <View style={styles.container}>
      <View style={styles.placeholder}>
        <Text style={styles.label}>Avatar 3D</Text>
        <Text style={styles.message}>Avatar 3D en ajuste para Expo Native</Text>
        <Text style={styles.hint}>Sin uso de document/window — listo para Fase 2</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 280,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    margin: 12,
  },
  label: {
    fontSize: 18,
    color: colors.text,
    fontWeight: '600',
  },
  message: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
});
