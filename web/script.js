const video = document.getElementById('videoFeed');
const canvas = document.getElementById('canvas');
const baseURL = document.getElementById('baseURL');
const instructionText = document.getElementById('instructionText');
const responseText = document.getElementById('responseText');
const intervalSelect = document.getElementById('intervalSelect');
const startButton = document.getElementById('startButton');
const sourceWebcam = document.getElementById('sourceWebcam');
const sourceEsp32 = document.getElementById('sourceEsp32');
const esp32IpContainer = document.getElementById('esp32IpContainer');
const esp32IpInput = document.getElementById('esp32Ip');

instructionText.value = "What do you see?"; // default instruction

let stream;
let intervalId;
let isProcessing = false;
let currentSource = 'webcam'; // 'webcam' or 'esp32'

// Add an <img> element for ESP32 stills
let esp32Img = null;

function showEsp32ImageElement() {
    if (!esp32Img) {
        esp32Img = document.createElement('img');
        esp32Img.id = 'esp32Feed';
        esp32Img.crossOrigin = "anonymous"; // <-- ADD THIS LINE
        esp32Img.style.width = video.style.width;
        esp32Img.style.height = video.style.height;
        video.parentNode.insertBefore(esp32Img, video);
    }
    video.classList.add('hidden');
    esp32Img.classList.remove('hidden');
}

function hideEsp32ImageElement() {
    if (esp32Img) {
        esp32Img.classList.add('hidden');
    }
    video.classList.remove('hidden');
}

// Event listeners for radio buttons
sourceWebcam.addEventListener('change', () => {
    if (sourceWebcam.checked) {
        currentSource = 'webcam';
        esp32IpContainer.classList.add('hidden');
        stopEsp32Stream(); // Stop ESP32 stream if it was running
        hideEsp32ImageElement();
        initCamera(); // Initialize webcam
    }
});

sourceEsp32.addEventListener('change', () => {
    if (sourceEsp32.checked) {
        currentSource = 'esp32';
        esp32IpContainer.classList.remove('hidden');
        if (stream) { // Stop webcam stream if it was running
            stream.getTracks().forEach(track => track.stop());
            stream = null;
            video.srcObject = null; // Clear video element
        }
        showEsp32ImageElement();
        if (esp32IpInput.value) {
            // Will be handled by handleStart
            responseText.value = "Ready to connect to ESP32 /capture endpoint.";
        } else {
            if (esp32Img) esp32Img.src = '';
        }
    }
});

// Listen for changes to the ESP32 IP input
esp32IpInput.addEventListener('input', () => {
    if (sourceEsp32.checked && esp32IpInput.value) {
        responseText.value = "Ready to connect to ESP32 /capture endpoint.";
        if (esp32Img) esp32Img.src = '';
    } else if (sourceEsp32.checked && !esp32IpInput.value) {
        if (esp32Img) esp32Img.src = '';
    }
});

// Returns response text (string)
async function sendChatCompletionRequest(instruction, imageBase64URL) {
    const response = await fetch(`${baseURL.value}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            max_tokens: 100,
            messages: [
                {
                    role: 'user', content: [
                        { type: 'text', text: instruction },
                        {
                            type: 'image_url', image_url: {
                                url: imageBase64URL,
                            }
                        }
                    ]
                },
            ]
        })
    });
    if (!response.ok) {
        const errorData = await response.text();
        return `Server error: ${response.status} - ${errorData}`;
    }
    const data = await response.json();
    return data.choices[0].message.content;
}

// 1. Ask for camera permission on load
async function initCamera() {
    if (currentSource === 'esp32') {
        if (esp32IpInput.value) {
            video.src = `http://${esp32IpInput.value}/`; // Set video source to ESP32 stream
            responseText.value = "Attempting to connect to ESP32 stream...";
            video.play().catch(e => {
                console.error("Error playing ESP32 stream:", e);
                responseText.value = "Error starting ESP32 stream. Check IP and network.";
                alert("Error starting ESP32 stream. Check IP and network.");
            });
        } else {
            responseText.value = "Please enter the ESP32 IP address.";
            alert("Please enter the ESP32 IP address.");
        }
        return; // Don't try to get user media for ESP32
    }

    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        video.srcObject = stream;
        video.src = null; // Ensure ESP32 stream src is cleared
        responseText.value = "I see an idiot who should kill himself.";
    } catch (err) {
        console.error("Error accessing camera:", err);
        responseText.value = `Error accessing camera: ${err.name} - ${err.message}. Please ensure permissions are granted and you are on HTTPS or localhost.`;
        alert(`Error accessing camera: ${err.name}. Make sure you've granted permission and are on HTTPS or localhost.`);
    }
}

function stopEsp32Stream() {
    if (esp32Img) esp32Img.src = '';
    // No explicit stop command for /capture, just stop updating
}

function captureImage() {
    if (currentSource === 'webcam') {
        if (!stream || !video.videoWidth || video.readyState < video.HAVE_ENOUGH_DATA) {
            console.warn("Webcam stream not ready for capture.");
            return null;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.8);
    } else if (currentSource === 'esp32') {
        if (!esp32Img || !esp32Img.src) {
            console.warn("ESP32 image not ready for capture.");
            return null;
        }
        // Draw the latest ESP32 image onto the canvas
        // Wait for the image to be loaded
        if (!esp32Img.complete) {
            console.warn("ESP32 image not fully loaded yet.");
            return null;
        }
        // Set canvas size to image size
        canvas.width = esp32Img.naturalWidth;
        canvas.height = esp32Img.naturalHeight;
        const context = canvas.getContext('2d');
        context.drawImage(esp32Img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.8);
    }
}

async function sendData() {
    if (!isProcessing) return; // Ensure we don't have overlapping requests if processing takes longer than interval

    const instruction = instructionText.value;
    const imageBase64URL = captureImage();

    if (!imageBase64URL) {
        responseText.value = "Failed to capture image. Stream might not be active.";
        // Optionally stop processing if image capture fails consistently
        // handleStop();
        return;
    }

    const payload = {
        instruction: instruction,
        imageBase64URL: imageBase64URL
    };

    try {
        const response = await sendChatCompletionRequest(payload.instruction, payload.imageBase64URL);
        responseText.value = response;
    } catch (error) {
        console.error('Error sending data:', error);
        responseText.value = `Error: ${error.message}`;
    }
}

let esp32IntervalId = null;

function startEsp32ImagePolling(ip, intervalMs) {
    if (!esp32Img) return;
    if (esp32IntervalId) clearInterval(esp32IntervalId);
    const updateImage = () => {
        esp32Img.src = `http://${ip}/capture?_t=${Date.now()}`; // Prevent caching
    };
    updateImage(); // Initial fetch
    esp32IntervalId = setInterval(updateImage, intervalMs);
}

function stopEsp32ImagePolling() {
    if (esp32IntervalId) {
        clearInterval(esp32IntervalId);
        esp32IntervalId = null;
    }
    if (esp32Img) esp32Img.src = '';
}

function handleStart() {
    if (currentSource === 'webcam' && !stream) {
        responseText.value = "Webcam not available. Cannot start.";
        alert("Webcam not available. Please grant permission first.");
        return;
    }
    if (currentSource === 'esp32' && !esp32IpInput.value) {
        responseText.value = "ESP32 IP address not provided. Cannot start.";
        alert("ESP32 IP address not provided. Please enter the IP and try again.");
        return;
    }

    if (currentSource === 'esp32') {
        showEsp32ImageElement();
        hideEsp32ImageElement(); // Hide video
        // Start polling images from ESP32
        const intervalMs = parseInt(intervalSelect.value, 10);
        startEsp32ImagePolling(esp32IpInput.value, intervalMs);
    } else {
        hideEsp32ImageElement();
    }

    isProcessing = true;
    startButton.textContent = "Stop";
    startButton.classList.remove('start');
    startButton.classList.add('stop');

    instructionText.disabled = true;
    intervalSelect.disabled = true;
    sourceWebcam.disabled = true;
    sourceEsp32.disabled = true;
    esp32IpInput.disabled = true;

    responseText.value = "Processing started...";

    const intervalMs = parseInt(intervalSelect.value, 10);

    // Initial immediate call
    // Wait a bit for the ESP32 image to potentially start if just initiated
    const initialDelay = currentSource === 'esp32' ? 1000 : 0;
    setTimeout(() => {
        sendData();
        // Then set interval
        intervalId = setInterval(sendData, intervalMs);
    }, initialDelay);
}

function handleStop() {
    isProcessing = false;
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    stopEsp32ImagePolling();
    startButton.textContent = "Start";
    startButton.classList.remove('stop');
    startButton.classList.add('start');

    instructionText.disabled = false;
    intervalSelect.disabled = false;
    sourceWebcam.disabled = false;
    sourceEsp32.disabled = false;
    esp32IpInput.disabled = false;

    if (responseText.value.startsWith("Processing started...")) {
        responseText.value = "Processing stopped.";
    }
    // Don't stop the ESP32 stream here, user might want to keep viewing it.
    // If webcam was active, it remains active.
}

startButton.addEventListener('click', () => {
    if (isProcessing) {
        handleStop();
    } else {
        handleStart();
    }
});

// Initialize camera when the page loads (defaults to webcam)
window.addEventListener('DOMContentLoaded', () => {
    initCamera(); // Initial call will try to init webcam
    esp32IpContainer.classList.add('hidden'); // Hide IP input initially
});

// Optional: Stop stream when page is closed/navigated away to release camera
window.addEventListener('beforeunload', () => {
    if (stream) { // Webcam stream
        stream.getTracks().forEach(track => track.stop());
    }
    // For ESP32, no explicit client-side stop needed beyond clearing src if desired
    // video.src = '';
    if (intervalId) {
        clearInterval(intervalId);
    }
});
