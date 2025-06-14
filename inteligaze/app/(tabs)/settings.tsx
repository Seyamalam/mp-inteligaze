// Make sure to install: npm install @react-native-async-storage/async-storage
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, Button, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

const SERVER_URL_KEY = 'server_url';
const ESP32_IP_KEY = 'esp32_ip';

export default function SettingsTab() {
  const [serverUrl, setServerUrl] = useState('http://127.0.0.1:8000');
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

  if (loading) return <ThemedView style={styles.container}><ThemedText>Loading...</ThemedText></ThemedView>;

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Settings</ThemedText>
      <ThemedText>FastAPI Server URL:</ThemedText>
      <TextInput
        style={styles.input}
        value={serverUrl}
        onChangeText={setServerUrl}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="http://127.0.0.1:8000"
      />
      <ThemedText>ESP32 IP Address:</ThemedText>
      <TextInput
        style={styles.input}
        value={esp32Ip}
        onChangeText={setEsp32Ip}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="192.168.0.237"
      />
      <View style={{ marginTop: 20 }}>
        <Button title="Save Settings" onPress={saveSettings} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16 },
  input: {
    backgroundColor: '#232323',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    fontSize: 16,
  },
}); 