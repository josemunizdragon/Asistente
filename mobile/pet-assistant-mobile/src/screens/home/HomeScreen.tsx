import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { assistantApi } from '../../api/assistantApi';
import { colors } from '../../theme/colors';

export function HomeScreen({ navigation }: { navigation: { navigate: (name: string) => void } }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  const [loadingWelcome, setLoadingWelcome] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await assistantApi.getWelcome(user?.name ?? undefined);
        if (!cancelled) setWelcomeMessage(data.message);
      } catch {
        if (!cancelled) setWelcomeMessage('Hola, soy tu asistente virtual.');
      } finally {
        if (!cancelled) setLoadingWelcome(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.name]);

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>
        Hola, {user?.name ?? 'Usuario'}
      </Text>
      {loadingWelcome ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <Text style={styles.welcome}>{welcomeMessage}</Text>
      )}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => navigation.navigate('Avatar')}
      >
        <Text style={styles.primaryButtonText}>Ver avatar</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={() => logout()}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    paddingTop: 48,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  welcome: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  loader: { marginBottom: 32 },
  primaryButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    padding: 16,
    alignItems: 'center',
  },
  logoutText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
