import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

export default function WorkoutScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Seu Treino de Hoje</Text>
      <TouchableOpacity style={styles.card}>
        <Text style={styles.cardTitle}>Superiores e Abdômen</Text>
        <Text style={styles.cardSubtitle}>45 min • 6 exercícios</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 20 },
  header: { fontSize: 24, color: '#fff', fontWeight: 'bold', marginBottom: 20 },
  card: { backgroundColor: '#1E1E1E', padding: 20, borderRadius: 12, marginBottom: 15 },
  cardTitle: { fontSize: 18, color: '#fff', fontWeight: '600', marginBottom: 5 },
  cardSubtitle: { fontSize: 14, color: '#888' }
});
