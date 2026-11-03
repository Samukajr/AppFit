import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ProgressScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Seu Progresso</Text>
      <Text style={styles.subtitle}>Evolução de cargas e histórico de treinos</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212', padding: 20 },
  title: { fontSize: 24, color: '#fff', marginBottom: 12, fontWeight: 'bold' },
  subtitle: { fontSize: 16, color: '#aaa', textAlign: 'center' }
});