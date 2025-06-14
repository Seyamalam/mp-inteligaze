import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';

export default function CaptureControls({ onCapture, autoCapture, setAutoCapture, loading }: {
  onCapture: () => void,
  autoCapture: boolean,
  setAutoCapture: (v: boolean) => void,
  loading: boolean
}) {
  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[styles.captureButton, loading && styles.captureButtonDisabled]}
        onPress={onCapture}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.captureButtonText}>Capture Now</Text>
        )}
      </TouchableOpacity>
      
      <View style={styles.autoRow}>
        <Text style={styles.autoText}>Auto-capture</Text>
        <Switch
          value={autoCapture}
          onValueChange={setAutoCapture}
          trackColor={{ false: '#e0e0e0', true: 'rgba(0, 122, 255, 0.3)' }}
          thumbColor={autoCapture ? '#007aff' : '#f5f5f5'}
          ios_backgroundColor="#e0e0e0"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  captureButton: {
    backgroundColor: '#007aff',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007aff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  captureButtonDisabled: {
    backgroundColor: '#82b4ff',
    shadowOpacity: 0.1,
  },
  captureButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  autoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  autoText: {
    fontSize: 16,
    color: '#444',
  },
});