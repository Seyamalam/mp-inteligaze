import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Text,
  ActivityIndicator,
  Button,
  Modal,
  TouchableOpacity,
  Switch,
} from "react-native";
import Card from "@/components/ui/Card";
import VisionStatusBar from "@/components/VisionStatusBar";
import CaptureControls from "@/components/CaptureControls";
import ResponseCard from "@/components/ResponseCard";
import HistoryList from "@/components/HistoryList";
import LogPanel from "@/components/LogPanel";
import axios from "axios";
import { playGroqTTS } from '@/utils/playGroqTTS';

const SERVER_URL = "http://192.168.0.213:8000";

export default function VisionTab() {
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

  // On mount, check backend connectivity
  useEffect(() => {
    (async () => {
      setLogs((logs) => [
        ...logs,
        "[Startup] Checking backend connectivity...",
      ]);
      try {
        const res = await axios.get(`${SERVER_URL}/`);
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
  }, []);

  // Poll server for ESP32 status only if backend is reachable
  useEffect(() => {
    if (backendOk !== true) return;
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${SERVER_URL}/status`);
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
  }, [backendOk]);

  // Auto-capture logic
  useEffect(() => {
    if (backendOk !== true) return;
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
  }, [autoCapture, backendOk, autoCaptureInterval, autoTTS]);

  // Auto TTS + Auto Capture: chain vision requests after TTS playback (no timer)
  useEffect(() => {
    if (!autoCapture || !autoTTS || !backendOk) return;
    let stopped = false;
    const runAutoTTS = async () => {
      while (autoCapture && autoTTS && backendOk && !stopped) {
        setLoading(true);
        setLogs((logs) => [...logs, '[AutoTTS] Sending capture request...']);
        try {
          const res = await axios.post(
            `${SERVER_URL}/vision`,
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
  }, [autoCapture, autoTTS, autoCaptureInterval, backendOk]);

  const handleCapture = async () => {
    if (backendOk !== true) return;
    setLoading(true);
    setLogs((logs) => [...logs, "[Capture] Sending capture request..."]);
    try {
      const res = await axios.post(
        `${SERVER_URL}/vision`,
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>AI Vision Assistant</Text>
        {backendOk && <VisionStatusBar status={status} />}
      </View>

      {backendOk === null && (
        <Card style={styles.statusCard}>
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
        </Card>
      )}

      {backendOk === false && (
        <Card style={[styles.statusCard, styles.errorCard]}>
          <Text style={styles.errorText}>
            Backend not reachable. Please check your server settings.
          </Text>
        </Card>
      )}

      {backendOk === true && (
        <>
          <Card style={styles.controlsCard}>
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
              <View style={{ marginTop: 12 }}>
                <Text style={{ marginBottom: 4 }}>Auto-capture interval (seconds):</Text>
                <TouchableOpacity
                  style={{
                    borderWidth: 1,
                    borderColor: '#ccc',
                    borderRadius: 8,
                    padding: 8,
                    width: 120,
                    backgroundColor: '#f0f0f0',
                  }}
                  onPress={() => setIntervalModalVisible(true)}
                >
                  <Text style={{ textAlign: 'center' }}>{autoCaptureInterval} sec ▼</Text>
                </TouchableOpacity>
                <Modal
                  visible={intervalModalVisible}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setIntervalModalVisible(false)}
                >
                  <TouchableOpacity
                    style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}
                    activeOpacity={1}
                    onPressOut={() => setIntervalModalVisible(false)}
                  >
                    <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, minWidth: 120 }}>
                      {intervalOptions.map((opt) => (
                        <TouchableOpacity
                          key={opt}
                          style={{ padding: 12, alignItems: 'center' }}
                          onPress={() => {
                            setAutoCaptureInterval(opt);
                            setIntervalModalVisible(false);
                          }}
                        >
                          <Text style={{ fontSize: 16, color: opt === autoCaptureInterval ? '#007aff' : '#222' }}>{opt} sec</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </TouchableOpacity>
                </Modal>
                {/* Auto TTS toggle */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                  <Text style={{ marginRight: 8 }}>Auto TTS</Text>
                  <Switch value={autoTTS} onValueChange={setAutoTTS} />
                </View>
              </View>
            )}
          </Card>

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="large"
                color="#007aff"
                style={styles.loadingIndicator}
              />
              <Text style={styles.loadingText}>Processing image...</Text>
            </View>
          )}

          {response && <ResponseCard response={response} />}
          {/* Play TTS button only if not autoTTS or not autoCapture */}
          {response && (!autoCapture || !autoTTS) && (
            <View style={{ marginVertical: 8 }}>
              <Button title="🔊 Play" onPress={() => playGroqTTS(response)} />
            </View>
          )}
          <HistoryList history={history} />
          <LogPanel logs={logs} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  contentContainer: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingTop: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#222",
    letterSpacing: 0.5,
  },
  statusCard: {
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  errorCard: {
    backgroundColor: "rgba(255, 71, 87, 0.08)",
  },
  controlsCard: {
    marginBottom: 16,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  loadingIndicator: {
    marginRight: 12,
  },
  loadingText: {
    fontSize: 16,
    color: "#007aff",
    fontWeight: "500",
  },
  statusText: {
    fontSize: 16,
    color: "#666",
  },
  errorText: {
    fontSize: 16,
    color: "#ff4757",
    padding: 16,
    textAlign: "center",
  },
});
