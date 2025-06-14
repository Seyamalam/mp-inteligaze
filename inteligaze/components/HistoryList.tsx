import React from 'react';
import { StyleSheet, View, Text, FlatList } from 'react-native';
import Card from './ui/Card';

export default function HistoryList({ history }: { history: string[] }) {
  if (!history.length) return null;
  
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>History</Text>
      <View style={styles.divider} />
      
      <FlatList
        data={history}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item, index }) => (
          <View style={styles.historyItem}>
            <Text style={styles.historyTime}>{new Date().toLocaleTimeString()}</Text>
            <Text style={styles.historyText}>{item}</Text>
            {index < history.length - 1 && <View style={styles.itemDivider} />}
          </View>
        )}
        style={styles.list}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      />
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
  list: {
    maxHeight: 200,
  },
  historyItem: {
    marginBottom: 12,
  },
  historyTime: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  historyText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  itemDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginTop: 12,
  }
});