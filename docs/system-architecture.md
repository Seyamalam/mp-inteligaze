# InteliGaze: Computer Vision Assistant for the Visually Impaired

This document provides a comprehensive overview of the InteliGaze system architecture, detailing how the ESP32 camera, FastAPI server, and React Native mobile application work together to provide AI-powered visual assistance.

## System Overview

InteliGaze is a vision assistance system consisting of three main components:

1. **ESP32 Camera Module**: Captures and streams live video
2. **FastAPI Backend Server**: Processes images and interfaces with AI vision services
3. **React Native Mobile App**: User interface for controlling the system and receiving AI responses

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ ESP32 Camera│ ──► │ FastAPI Server│ ◄── │ React Native│
│  (MJPEG     │     │ (Processing & │     │  Mobile App │
│   Stream)   │ ◄── │  AI Gateway)  │ ──► │ (UI/Control)│
└─────────────┘     └──────────────┘     └─────────────┘
```

## 1. ESP32 Camera Module

The ESP32 camera module is programmed to:
- Connect to a WiFi network
- Initialize the camera with appropriate settings
- Provide an MJPEG stream via HTTP server

### Key Components:

- **Hardware**: ESP32-CAM (AI-THINKER model)
- **Camera Configuration**: 
  - VGA resolution (if PSRAM available)
  - JPEG format with quality optimization
  - GPIO pin assignments for camera interface

### Network Connectivity:
- Connects to predefined WiFi network (SSID: "Seyam 2.4")
- Exposes MJPEG stream at `http://<ESP32_IP>/`
- No authentication required (designed for local network use)

### Stream Handling:
- Implements MJPEG streaming via HTTP multipart response
- Frame rate controlled with a 30ms delay between frames
- Camera capture failures are logged but don't interrupt stream

## 2. FastAPI Backend Server

The FastAPI server acts as the middleware between the ESP32 camera and the AI vision service, while also providing API endpoints for the mobile app.

### Key Components:

- **FastAPI Framework**: Modern Python web framework
- **Background Processing**: Threaded ESP32 stream consumption
- **AI Integration**: Interfaces with a vision model API endpoint

### Key Endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Health check / status |
| `/status` | GET | Reports ESP32 connectivity status |
| `/vision` | POST | Process current frame with AI vision |

### ESP32 Integration:

- **Stream Consumer**: Background thread that continuously:
  - Connects to ESP32 MJPEG stream (URL: `http://192.168.0.237/`)
  - Parses MJPEG format to extract individual JPEG frames
  - Stores the latest valid frame in memory
  - Monitors connectivity (considers device disconnected if no frame in 10 seconds)

### AI Vision Processing:

- **Vision API**: Connects to an AI backend at `https://8080-01jvyxcckwn7v10c56ara2prnw.cloudspaces.litng.ai/v1/chat/completions`
- **Prompt Engineering**: Uses a specialized prompt for visually impaired assistance
- **Image Handling**: Converts latest camera frame to base64 for API consumption
- **Response Handling**: Returns AI-generated description to the mobile app

### Error Handling:

- Comprehensive error handling for network, camera, and AI service issues
- Middleware for request logging with unique request IDs
- Structured error responses with appropriate HTTP status codes

## 3. React Native Mobile Application

The React Native app provides a user interface for controlling the system and receiving AI feedback.

### Key Components:

- **React Native / Expo**: Cross-platform mobile framework
- **Axios**: HTTP client for API communication
- **UI Components**: Custom components for vision assistant interface

### Main Features:

#### Connection Management:
- Automatic backend connectivity detection
- ESP32 camera status monitoring (connected/disconnected)
- Visual indicators for system status

#### Capture Modes:
- **Manual Capture**: On-demand image processing
- **Auto-Capture**: Timed interval capture (2, 3, 5, or 10 seconds)
- **Auto-TTS**: Continuous capture with text-to-speech playback

#### User Interface:
- Response display with AI-generated scene descriptions
- History tracking of previous descriptions
- Debug log panel for system events
- Text-to-speech capabilities for hands-free use

### State Management:

- Manages multiple states:
  - Backend connectivity (`backendOk`)
  - ESP32 camera status (`status`)
  - Auto-capture settings (`autoCapture`, `autoCaptureInterval`)
  - TTS playback status (`autoTTS`, `ttsPlaying`)
  - Response and history data

### Auto-Capture Logic:

Two distinct auto-capture modes:
1. **Timer-based**: Regular captures at fixed intervals
2. **TTS-chained**: Captures only after TTS playback completes

## System Data Flow

### Initialization Flow:
1. ESP32 connects to WiFi and starts MJPEG server
2. FastAPI server starts and begins ESP32 stream monitoring
3. Mobile app checks backend connectivity and ESP32 status

### Capture Flow:
1. User triggers capture (manual or automatic)
2. Mobile app sends request to `/vision` endpoint
3. Server retrieves latest frame from memory
4. Server sends frame to AI vision service with prompt
5. Server receives AI description and returns to mobile app
6. Mobile app displays response and optionally plays TTS

### Status Monitoring Flow:
1. Mobile app polls `/status` endpoint every 2 seconds
2. Server checks if latest frame is recent (within 10 seconds)
3. Mobile app updates connection status indicator

## Communication Protocols

### ESP32 ↔ Server:
- **Protocol**: HTTP MJPEG Stream
- **Direction**: One-way (ESP32 → Server)
- **Format**: Multipart JPEG images
- **Error Handling**: Server monitors for connection loss

### Server ↔ Mobile App:
- **Protocol**: HTTP REST API
- **Direction**: Bidirectional
- **Format**: JSON
- **Endpoints**: Status, Vision processing
- **Error Handling**: Status codes and error messages

### Server ↔ AI Service:
- **Protocol**: HTTP REST API
- **Direction**: Bidirectional
- **Format**: JSON with base64 image
- **Error Handling**: Timeout and status code handling

## Network Requirements

- All components must be on the same local network
- Fixed IP addresses or hostname resolution for ESP32 and server
- Internet connection required for AI vision service

## Security Considerations

Current implementation has minimal security:
- No authentication for ESP32 stream
- No encryption for local network traffic
- No user authentication in mobile app

This is acceptable for prototype/development but would need enhancement for production.

## Configuration Settings

### ESP32 Configuration:
- WiFi credentials in `camera-feed.ino`
- Camera parameters configured for optimal streaming

### Server Configuration:
- ESP32 stream URL: `http://192.168.0.237/`
- AI backend URL: `https://8080-01jvyxcckwn7v10c56ara2prnw.cloudspaces.litng.ai/v1/chat/completions`
- CORS enabled for all origins (development setting)

### Mobile App Configuration:
- Server URL: `http://192.168.0.213:8000`
- Auto-capture intervals: 2, 3, 5, or 10 seconds
