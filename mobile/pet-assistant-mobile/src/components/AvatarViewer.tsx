import React, { useEffect, useState, Suspense } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { Asset } from 'expo-asset';
import { colors } from '../theme/colors';
import { SceneErrorBoundary } from './SceneErrorBoundary';
import { AvatarNativeScene } from './AvatarNativeScene';
import { getDefaultAvatar } from '../data/avatarCatalog';

const AVATAR_MODULE = require('../../assets/models/avatar.glb');

// Fallback cuando el lazy resuelve a undefined (p. ej. import falla por Worklets).
function FilamentUnavailableFallback() {
  return (
    <View style={styles.fallbackBox}>
      <Text style={styles.fallbackTitle}>Render nativo no disponible</Text>
      <Text style={styles.fallbackText}>
        Falta integración nativa de Worklets o el módulo no cargó. Reconstruye con: npx expo run:ios
      </Text>
    </View>
  );
}

// Lazy con resolución segura: NUNCA pasar undefined a React.lazy (evita "Element type is invalid").
const AvatarFilamentSceneLazy = React.lazy(() =>
  import('./AvatarFilamentScene')
    .then((m) => {
      const Component = m?.AvatarFilamentScene;
      if (typeof Component === 'function') return { default: Component };
      return { default: FilamentUnavailableFallback };
    })
    .catch(() => ({ default: FilamentUnavailableFallback }))
);

type AssetStatus = 'loading' | 'found' | 'error';

export type AvatarViewerProps = { suggestedAnimation?: string };

export function AvatarViewer({ suggestedAnimation }: AvatarViewerProps = {}) {
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

  // UI limpia: no mostrar "Modo seguro", "GLB listo", ni letrero "Avatar" (estado se mantiene internamente).
  return (
    <View style={styles.container}>
      {status === 'found' && !isExpoGo && (
        <View style={styles.filamentBlock}>
          <SceneErrorBoundary
            fallback={
              <View style={styles.fallbackBox}>
                <Text style={styles.fallbackTitle}>Render nativo no disponible</Text>
                <Text style={styles.fallbackText}>
                  Falta integración nativa de Worklets. Reconstruye con: npx expo run:ios
                </Text>
              </View>
            }
          >
            <Suspense fallback={<View style={styles.filamentBlock} />}>
              <AvatarFilamentSceneLazy source={getDefaultAvatar().file} suggestedAnimation={suggestedAnimation} />
            </Suspense>
          </SceneErrorBoundary>
        </View>
      )}

      {status === 'found' && isExpoGo && (
        <View style={styles.experimentalBlock}>
          <SceneErrorBoundary>
            <AvatarNativeScene suggestedAnimation={suggestedAnimation} />
          </SceneErrorBoundary>
        </View>
      )}

      {status === 'loading' && <View style={styles.filamentBlock} />}
      {status === 'error' && (
        <View style={styles.fallbackBox}>
          <Text style={styles.fallbackTitle}>Error</Text>
          <Text style={styles.fallbackText}>{errorMessage}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  filamentBlock: {
    flex: 1,
    minHeight: 280,
    padding: 0,
  },
  experimentalBlock: {
    flex: 1,
    minHeight: 280,
  },
  fallbackBox: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    margin: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  fallbackTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  fallbackText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
