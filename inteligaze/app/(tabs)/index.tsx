import CaptureControls from "@/components/CaptureControls";
import HistoryList from "@/components/HistoryList";
import LogPanel from "@/components/LogPanel";
import ResponseCard from "@/components/ResponseCard";
import VisionStatusBar from "@/components/VisionStatusBar";
import { playGroqTTS } from '@/utils/playGroqTTS';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from "axios";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const SERVER_URL_KEY = 'server_url';
const ESP32_IP_KEY = 'esp32_ip';

export default function VisionTab() {
  const [serverUrl, setServerUrl] = useState('http://192.168.251.41:8000');
  const [esp32Ip, setEsp32Ip] = useState('192.168.0.237');
  const [status, setStatus] = useState<"connected" | "disconnected">(
    "disconnected"
  );
  const [autoCapture, setAutoCapture] = useState(false);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const autoCaptureRef = useRef<number | null>(null);
  const [autoCaptureInterval, setAutoCaptureInterval] = useState(5); // seconds
  const [intervalModalVisible, setIntervalModalVisible] = useState(false);
  const intervalOptions = [2, 3, 5, 10];
  const [autoTTS, setAutoTTS] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);

  // Function to load settings from AsyncStorage
  const loadSettings = async () => {
    try {
      setLogs((logs) => [...logs, "[Settings] Refreshing settings..."]);
      const url = await AsyncStorage.getItem(SERVER_URL_KEY);
      const ip = await AsyncStorage.getItem(ESP32_IP_KEY);
      
      let hasChanges = false;
      if (url && url !== serverUrl) {
        setServerUrl(url);
        hasChanges = true;
      }
      if (ip && ip !== esp32Ip) {
        setEsp32Ip(ip);
        hasChanges = true;
      }
      
      if (hasChanges) {
        setLogs((logs) => [...logs, "[Settings] Settings updated from storage"]);
        // Reset backend status to recheck with new URL
        setBackendOk(null);
      } else {
        setLogs((logs) => [...logs, "[Settings] No changes detected"]);
      }
    } catch (e) {
      console.log('Failed to load settings:', e);
      setLogs((logs) => [...logs, "[Settings] Failed to load settings"]);
    }
  };

  // Load settings from AsyncStorage on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // On mount, check backend connectivity
  useEffect(() => {
    if (!serverUrl) return; // Wait for settings to load
    
    (async () => {
      setLogs((logs) => [
        ...logs,
        "[Startup] Checking backend connectivity...",
      ]);
      try {
        const res = await axios.get(`${serverUrl}/`);
        if (res.data && res.data.status === "ok") {
          setBackendOk(true);
          setLogs((logs) => [...logs, "[Startup] Backend reachable."]);
        } else {
          setBackendOk(false);
          setLogs((logs) => [
            ...logs,
            "[Startup] Backend did not return ok status.",
          ]);
        }
      } catch (e: any) {
        setBackendOk(false);
        setLogs((logs) => [
          ...logs,
          `[Startup] Backend not reachable: ${e.message}`,
        ]);
      }
    })();
  }, [serverUrl]); // Re-run when serverUrl changes

  // Poll server for ESP32 status only if backend is reachable
  useEffect(() => {
    if (backendOk !== true || !serverUrl) return;
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${serverUrl}/status`);
        setStatus(res.data.esp32_connected ? "connected" : "disconnected");
        setLogs((logs) => [
          ...logs,
          `[Status] ESP32: ${
            res.data.esp32_connected ? "connected" : "disconnected"
          }`,
        ]);
      } catch {
        setStatus("disconnected");
        setLogs((logs) => [...logs, "[Status] ESP32: disconnected"]);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [backendOk, serverUrl]);

  // Auto-capture logic
  useEffect(() => {
    if (backendOk !== true || !serverUrl) return;
    if (autoCapture && !autoTTS) {
      autoCaptureRef.current = setInterval(() => {
        handleCapture();
      }, autoCaptureInterval * 1000) as unknown as number;
    } else if (autoCaptureRef.current) {
      clearInterval(autoCaptureRef.current);
    }
    return () => {
      if (autoCaptureRef.current) clearInterval(autoCaptureRef.current);
    };
  }, [autoCapture, backendOk, autoCaptureInterval, autoTTS, serverUrl]);

  // Auto TTS + Auto Capture: chain vision requests after TTS playback (no timer)
  useEffect(() => {
    if (!autoCapture || !autoTTS || !backendOk || !serverUrl) return;
    let stopped = false;
    const runAutoTTS = async () => {
      while (autoCapture && autoTTS && backendOk && !stopped) {
        setLoading(true);
        setLogs((logs) => [...logs, '[AutoTTS] Sending capture request...']);
        try {
          const res = await axios.post(
            `${serverUrl}/vision`,
            {}, // no interval field
            { timeout: 60000 }
          );
          setResponse(res.data.response);
          setHistory((hist) => [res.data.response, ...hist]);
          setLogs((logs) => [...logs, '[AutoTTS] Capture success, playing TTS...']);
          setTtsPlaying(true);
          await playGroqTTS(res.data.response);
          setTtsPlaying(false);
          setLogs((logs) => [...logs, '[AutoTTS] TTS playback finished. Sending next request after short buffer...']);
          // Wait a short buffer (e.g., 0.5s) before next request
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (e: any) {
          setResponse('Error: Could not get response.');
          setLogs((logs) => [...logs, `[AutoTTS] Error: ${e.message}`]);
          setTtsPlaying(false);
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    };
    runAutoTTS();
    return () => {
      stopped = true;
    };
  }, [autoCapture, autoTTS, autoCaptureInterval, backendOk, serverUrl]);

  const handleCapture = async () => {
    if (backendOk !== true || !serverUrl) return;
    setLoading(true);
    setLogs((logs) => [...logs, "[Capture] Sending capture request..."]);
    try {
      const res = await axios.post(
        `${serverUrl}/vision`,
        {}, // no interval field
        { timeout: 60000 }
      );
      setResponse(res.data.response);
      setHistory((hist) => [res.data.response, ...hist]);
      setLogs((logs) => [...logs, "[Capture] Success!"]);
    } catch (e: any) {
      setResponse("Error: Could not get response.");
      setLogs((logs) => [...logs, `[Capture] Error: ${e.message}`]);
    }
    setLoading(false);
  };

  const renderContent = () => (
    <>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerContent}>
            <Text style={styles.title}>🤖 Inteligaze</Text>
            <Text style={styles.subtitle}>{serverUrl}</Text>
          </View>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={loadSettings}
          >
            <Text style={styles.refreshButtonText}>🔄</Text>
          </TouchableOpacity>
        </View>
        {backendOk && (
          <View style={styles.statusBarContainer}>
            <VisionStatusBar status={status} />
          </View>
        )}
      </View>

      {/* Backend Status Cards */}
      {backendOk === null && (
        <View style={styles.statusCard}>
          <View style={styles.statusContent}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="small"
                color="#007aff"
                style={styles.loadingIndicator}
              />
              <Text style={styles.statusText}>
                Checking backend connection...
              </Text>
            </View>
          </View>
        </View>
      )}

      {backendOk === false && (
        <View style={[styles.statusCard, styles.errorCard]}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>
              Backend not reachable. Please check your server settings.
            </Text>
          </View>
        </View>
      )}

      {/* Main Controls */}
      {backendOk === true && (
        <>
          <View style={styles.controlsCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>📸 Capture Controls</Text>
            </View>
            
            {/* Show capture button only if not auto-capture */}
            {!autoCapture && (
              <CaptureControls
                onCapture={handleCapture}
                autoCapture={autoCapture}
                setAutoCapture={setAutoCapture}
                loading={loading}
              />
            )}
            
            {/* Show interval picker and auto-TTS toggle only if auto-capture */}
            {autoCapture && (
              <View style={styles.autoControlsContainer}>
                <View style={styles.intervalContainer}>
                  <Text style={styles.intervalLabel}>Auto-capture interval:</Text>
                  <TouchableOpacity
                    style={styles.intervalButton}
                    onPress={() => setIntervalModalVisible(true)}
                  >
                    <Text style={styles.intervalButtonText}>{autoCaptureInterval} sec</Text>
                    <Text style={styles.dropdownIcon}>▼</Text>
                  </TouchableOpacity>
                </View>
                
                {/* Auto TTS toggle */}
                <View style={styles.ttsContainer}>
                  <View style={styles.ttsLabelContainer}>
                    <Text style={styles.ttsIcon}>🔊</Text>
                    <Text style={styles.ttsLabel}>Auto TTS</Text>
                  </View>
                  <Switch 
                    value={autoTTS} 
                    onValueChange={setAutoTTS}
                    trackColor={{ false: '#ddd', true: '#007aff40' }}
                    thumbColor={autoTTS ? '#007aff' : '#fff'}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Processing State */}
          {loading && (
            <View style={styles.processingCard}>
              <View style={styles.processingContent}>
                <ActivityIndicator
                  size="large"
                  color="#007aff"
                  style={styles.processingIndicator}
                />
                <Text style={styles.processingText}>Processing image...</Text>
                <Text style={styles.processingSubtext}>AI is analyzing the captured image</Text>
              </View>
            </View>
          )}

          {/* Response Section */}
          {response && (
            <View style={styles.responseSection}>
              <ResponseCard response={response} />
              
              {/* Play TTS button only if not autoTTS or not autoCapture */}
              {(!autoCapture || !autoTTS) && (
                <TouchableOpacity 
                  style={styles.ttsButton}
                  onPress={() => playGroqTTS(response)}
                >
                  <Text style={styles.ttsButtonIcon}>🔊</Text>
                  <Text style={styles.ttsButtonText}>Play Audio</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* History and Logs */}
          <View style={styles.dataSection}>
            <HistoryList history={history} />
            <LogPanel logs={logs} />
          </View>
        </>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={[{ key: 'content' }]}
        renderItem={() => renderContent()}
        keyExtractor={(item: { key: string }) => item.key}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      />
      
      {/* Interval Selection Modal */}
      <Modal
        visible={intervalModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIntervalModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPressOut={() => setIntervalModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Interval</Text>
            {intervalOptions.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.modalOption,
                  opt === autoCaptureInterval && styles.modalOptionSelected
                ]}
                onPress={() => {
                  setAutoCaptureInterval(opt);
                  setIntervalModalVisible(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  opt === autoCaptureInterval && styles.modalOptionTextSelected
                ]}>
                  {opt} seconds
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 24,
    backgroundColor: "#111",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerContent: {
    alignItems: "center",
    flex: 1,
  },
  statusBarContainer: {
    alignItems: "center",
  },
  refreshButton: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: "#404040",
  },
  refreshButtonText: {
    fontSize: 18,
    color: "#fff",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#999",
    textAlign: "center",
  },
  statusCard: {
    backgroundColor: "#1a1a1a",
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#333",
  },
  statusContent: {
    padding: 20,
  },
  errorCard: {
    backgroundColor: "#2a1a1a",
    borderColor: "#ff4757",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
  },
  errorIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  controlsCard: {
    backgroundColor: "#1a1a1a",
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#333",
  },
  cardHeader: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
  autoControlsContainer: {
    marginTop: 16,
    gap: 16,
  },
  intervalContainer: {
    gap: 8,
  },
  intervalLabel: {
    fontSize: 16,
    color: "#fff",
    marginBottom: 8,
    fontWeight: "500",
  },
  intervalButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#404040",
  },
  intervalButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "500",
  },
  dropdownIcon: {
    fontSize: 12,
    color: "#999",
  },
  ttsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#404040",
  },
  ttsLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  ttsIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  ttsLabel: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "500",
  },
  processingCard: {
    backgroundColor: "#1a1a1a",
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#333",
  },
  processingContent: {
    padding: 24,
    alignItems: "center",
  },
  processingIndicator: {
    marginBottom: 16,
  },
  processingText: {
    fontSize: 18,
    color: "#007aff",
    fontWeight: "600",
    marginBottom: 8,
  },
  processingSubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  responseSection: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  ttsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007aff",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    shadowColor: "#007aff",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  ttsButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  ttsButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
  dataSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingIndicator: {
    marginRight: 12,
  },
  statusText: {
    fontSize: 16,
    color: "#ccc",
  },
  errorText: {
    fontSize: 16,
    color: "#ff4757",
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 20,
    minWidth: 200,
    borderWidth: 1,
    borderColor: "#333",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
    marginBottom: 16,
  },
  modalOption: {
    padding: 16,
    borderRadius: 12,
    marginVertical: 4,
  },
  modalOptionSelected: {
    backgroundColor: "#007aff20",
  },
  modalOptionText: {
    fontSize: 16,
    color: "#ccc",
    textAlign: "center",
  },
  modalOptionTextSelected: {
    color: "#007aff",
    fontWeight: "600",
  },
});
