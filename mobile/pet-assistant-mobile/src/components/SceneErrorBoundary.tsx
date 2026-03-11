import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

type Props = { children: ReactNode; fallback?: ReactNode; onError?: (error: Error) => void };
type State = { hasError: boolean; error: Error | null };

export class SceneErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error);
    console.warn('[SceneErrorBoundary]', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <View style={styles.box}>
          <Text style={styles.title}>Error en escena experimental</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  box: {
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
  },
  message: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
