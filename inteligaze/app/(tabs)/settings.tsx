// Make sure to install: npm install @react-native-async-storage/async-storage
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

const SERVER_URL_KEY = 'server_url';
const ESP32_IP_KEY = 'esp32_ip';

export default function SettingsTab() {
  const [serverUrl, setServerUrl] = useState('http://192.168.0.213:8000');
  const [esp32Ip, setEsp32Ip] = useState('192.168.0.237');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const url = await AsyncStorage.getItem(SERVER_URL_KEY);
      const ip = await AsyncStorage.getItem(ESP32_IP_KEY);
      if (url) setServerUrl(url);
      if (ip) setEsp32Ip(ip);
      setLoading(false);
    })();
  }, []);

  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem(SERVER_URL_KEY, serverUrl);
      await AsyncStorage.setItem(ESP32_IP_KEY, esp32Ip);
      Alert.alert('Settings saved!');
    } catch (e) {
      Alert.alert('Failed to save settings.');
    }
  };
  if (loading) return (
    <ThemedView style={styles.container}>
      <View style={styles.loadingContainer}>
        <ThemedText style={styles.loadingText}>Loading...</ThemedText>
      </View>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>⚙️ Settings</ThemedText>
          <ThemedText style={styles.subtitle}>Configure your connection settings</ThemedText>
        </View>

        {/* Settings Cards */}
        <View style={styles.settingsSection}>
          {/* Server URL Card */}
          <View style={styles.settingCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <ThemedText style={styles.cardIcon}>🌐</ThemedText>
              </View>
              <View style={styles.cardTitleContainer}>
                <ThemedText style={styles.cardTitle}>FastAPI Server</ThemedText>
                <ThemedText style={styles.cardDescription}>Backend server endpoint</ThemedText>
              </View>
            </View>
            <TextInput
              style={styles.input}
              value={serverUrl}
              onChangeText={setServerUrl}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="http://192.168.0.213:8000"
              placeholderTextColor="#666"
            />
          </View>

          {/* ESP32 IP Card */}
          <View style={styles.settingCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <ThemedText style={styles.cardIcon}>📡</ThemedText>
              </View>
              <View style={styles.cardTitleContainer}>
                <ThemedText style={styles.cardTitle}>ESP32 Device</ThemedText>
                <ThemedText style={styles.cardDescription}>Camera module IP address</ThemedText>
              </View>
            </View>
            <TextInput
              style={styles.input}
              value={esp32Ip}
              onChangeText={setEsp32Ip}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="192.168.0.237"
              placeholderTextColor="#666"
            />
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.saveButton} onPress={saveSettings}>
          <ThemedText style={styles.saveButtonText}>💾 Save Settings</ThemedText>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>
            Changes are automatically saved to device storage
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    opacity: 0.7,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  settingsSection: {
    paddingHorizontal: 20,
    gap: 16,
  },
  settingCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardIcon: {
    fontSize: 24,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
  input: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#404040',
    fontFamily: 'monospace',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 20,
    marginTop: 32,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    opacity: 0.5,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});