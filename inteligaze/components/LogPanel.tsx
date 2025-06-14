import React, { useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity } from 'react-native';
import Card from './ui/Card';

export default function LogPanel({ logs }: { logs: string[] }) {
  const [expanded, setExpanded] = useState(false);
  
  if (!logs.length) return null;
  
  return (
    <Card style={styles.card}>
      <TouchableOpacity 
        style={styles.header} 
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.title}>Logs</Text>
        <Text style={styles.expandIcon}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      
      {expanded && (
        <>
          <View style={styles.divider} />
          <FlatList
            data={logs}
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ item }) => (
              <Text style={styles.logItem}>{item}</Text>
            )}
            style={styles.list}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007aff',
  },
  expandIcon: {
    fontSize: 14,
    color: '#007aff',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  list: {
    maxHeight: 150,
  },
  logItem: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
    lineHeight: 18,
  },
});