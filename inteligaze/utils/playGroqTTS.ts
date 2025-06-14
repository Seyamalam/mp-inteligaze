import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';

// WARNING: Do not expose your real API key in production apps!
const GROQ_API_KEY = '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';

// Helper to convert ArrayBuffer to base64 (since Buffer is not available in React Native)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return global.btoa ? global.btoa(binary) : btoa(binary);
}

export async function playGroqTTS(text: string) {
  try {
    // 1. Call Groq TTS API
    const response = await axios.post(
      'https://api.groq.com/openai/v1/audio/speech',
      {
        model: 'playai-tts',
        voice: 'Fritz-PlayAI',
        input: text,
        response_format: 'wav',
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      }
    );

    // 2. Save audio to a temporary file
    const fileUri = FileSystem.cacheDirectory + 'tts.wav';
    const base64Audio = arrayBufferToBase64(response.data);
    await FileSystem.writeAsStringAsync(
      fileUri,
      base64Audio,
      { encoding: FileSystem.EncodingType.Base64 }
    );

    // 3. Play audio using expo-av
    const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
    await sound.playAsync();

    // Optionally unload the sound after playback
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch (error) {
    console.error('Groq TTS error:', error);
    throw new Error('Failed to play Groq TTS audio');
  }
}