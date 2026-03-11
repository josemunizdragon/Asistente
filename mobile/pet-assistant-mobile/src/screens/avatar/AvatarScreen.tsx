import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AvatarViewer } from '../../components/AvatarViewer';
import { colors } from '../../theme/colors';

export function AvatarScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Asistente virtual</Text>
      <AvatarViewer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
});
