import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Card from './ui/Card';

export default function ResponseCard({ response }: { response: string }) {
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Latest Response</Text>
      <View style={styles.divider} />
      <Text style={styles.responseText}>{response}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007aff',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginBottom: 16,
  },
  responseText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    letterSpacing: 0.3,
  },
});