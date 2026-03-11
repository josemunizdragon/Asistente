import React, { useEffect, useState, Suspense } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Constants from 'expo-constants';
import { Asset } from 'expo-asset';
import { colors } from '../theme/colors';
import { SceneErrorBoundary } from './SceneErrorBoundary';
import { AvatarNativeScene } from './AvatarNativeScene';
import { getDefaultAvatar } from '../data/avatarCatalog';

const AVATAR_MODULE = require('../../assets/models/avatar.glb');

// Lazy: solo se carga en development build; en Expo Go no se importa react-native-filament
const AvatarFilamentScene = React.lazy(() =>
  import('./AvatarFilamentScene').then((m) => ({ default: m.AvatarFilamentScene }))
);

type AssetStatus = 'loading' | 'found' | 'error';

export function AvatarViewer() {
  const [status, setStatus] = useState<AssetStatus>('loading');
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isExpoGo = Constants.appOwnership === 'expo';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const asset = Asset.fromModule(AVATAR_MODULE);
        await asset.downloadAsync();
        const uri = asset.localUri ?? asset.uri ?? null;
        if (cancelled) return;
        if (uri) {
          setLocalUri(uri);
          setStatus('found');
        } else {
          setErrorMessage('No se pudo obtener URI del asset');
          setStatus('error');
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Error al cargar asset';
        setErrorMessage(msg);
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* ——— Modo seguro: validación del asset (siempre visible) ——— */}
      <View style={styles.safeBlock}>
        <Text style={styles.title}>Modo seguro — Verificación de asset</Text>
        {status === 'loading' && (
          <Text style={styles.status}>Comprobando asset…</Text>
        )}
        {status === 'found' && (
          <>
            <Text style={styles.success}>Archivo GLB detectado</Text>
            <Text style={styles.success}>URI local resuelta</Text>
            <Text style={styles.uri} numberOfLines={2}>{localUri ?? ''}</Text>
          </>
        )}
        {status === 'error' && (
          <>
            <Text style={styles.errorLabel}>Error</Text>
            <Text style={styles.errorMessage}>{errorMessage}</Text>
          </>
        )}
      </View>

      {/* ——— Render nativo con Filament (solo en development build; no en Expo Go) ——— */}
      {status === 'found' && !isExpoGo && (
        <View style={styles.filamentBlock}>
          <Text style={styles.experimentalTitle}>Render nativo (react-native-filament)</Text>
          <SceneErrorBoundary>
            <Suspense fallback={<Text style={styles.hint}>Cargando escena…</Text>}>
              <AvatarFilamentScene source={getDefaultAvatar().file} />
            </Suspense>
          </SceneErrorBoundary>
        </View>
      )}

      {/* ——— Fallback: Expo Go o cuando Filament no está disponible ——— */}
      {status === 'found' && isExpoGo && (
        <View style={styles.experimentalBlock}>
          <Text style={styles.experimentalTitle}>Modo Expo Go — Sin render 3D nativo</Text>
          <Text style={styles.hint}>Usa development build (npx expo run:ios) para ver el modelo con Filament.</Text>
          <SceneErrorBoundary>
            <AvatarNativeScene />
          </SceneErrorBoundary>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  safeBlock: {
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  status: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  success: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '600',
    marginBottom: 6,
  },
  uri: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 6,
  },
  errorLabel: {
    fontSize: 14,
    color: colors.error,
    fontWeight: '600',
    marginBottom: 6,
  },
  errorMessage: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  filamentBlock: {
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  experimentalBlock: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  experimentalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 12,
  },
});
