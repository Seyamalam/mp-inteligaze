import React from 'react';
import { View, StyleSheet, Text } from 'react-native';

export default function VisionStatusBar({ status }: { status: 'connected' | 'disconnected' }) {
  const isConnected = status === 'connected';
  
  return (
    <View style={styles.container}>
      <View style={[
        styles.statusPill, 
        isConnected ? styles.connectedPill : styles.disconnectedPill
      ]}>
        <View style={[
          styles.dot, 
          isConnected ? styles.connectedDot : styles.disconnectedDot
        ]} />
        <Text style={[
          styles.statusText,
          isConnected ? styles.connectedText : styles.disconnectedText
        ]}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  connectedPill: {
    backgroundColor: 'rgba(46, 213, 115, 0.15)',
  },
  disconnectedPill: {
    backgroundColor: 'rgba(255, 71, 87, 0.15)',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  connectedDot: {
    backgroundColor: '#2ed573',
    shadowColor: '#2ed573',
    shadowOpacity: 0.5,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  disconnectedDot: {
    backgroundColor: '#ff4757',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  connectedText: {
    color: '#2ed573',
  },
  disconnectedText: {
    color: '#ff4757',
  },
});