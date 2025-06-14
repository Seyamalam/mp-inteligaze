import sys
import cv2
import numpy as np
import requests
import base64
import threading
from PyQt6.QtWidgets import (
    QApplication, QWidget, QLabel, QPushButton, QVBoxLayout, QHBoxLayout,
    QLineEdit, QTextEdit, QStatusBar, QCheckBox, QSpinBox, QGroupBox, QGridLayout
)
from PyQt6.QtGui import QImage, QPixmap
from PyQt6.QtCore import QTimer, Qt, QThread, pyqtSignal

ESP32_URL = "http://192.168.0.237/"
BACKEND_URL = "https://8080-01jvyxcckwn7v10c56ara2prnw.cloudspaces.litng.ai"
DEFAULT_INSTRUCTION = "You are an assistive vision system for the visually impaired. Given an image from a wearable camera, describe the scene in a way that maximizes situational awareness and independence. Clearly identify objects, obstacles, people, and signage. If there is text in the scene, read it aloud and explain its context (e.g., sign, label, document). Use short, direct sentences and avoid technical jargon. Prioritize information that would help a visually impaired user navigate or understand their environment."

def fetch_mjpeg_frame(url):
    response = requests.get(url, stream=True, timeout=10)
    bytes_data = bytes()
    for chunk in response.iter_content(chunk_size=1024):
        bytes_data += chunk
        a = bytes_data.find(b'\xff\xd8')
        b = bytes_data.find(b'\xff\xd9')
        if a != -1 and b != -1:
            jpg = bytes_data[a:b+2]
            bytes_data = bytes_data[b+2:]
            frame = cv2.imdecode(np.frombuffer(jpg, dtype=np.uint8), cv2.IMREAD_COLOR)
            yield frame

class BackendThread(QThread):
    result_signal = pyqtSignal(str)
    status_signal = pyqtSignal(str)
    log_signal = pyqtSignal(str)

    def __init__(self, backend_url, instruction, frame):
        super().__init__()
        self.backend_url = backend_url
        self.instruction = instruction
        self.frame = frame

    def run(self):
        self.status_signal.emit("Encoding image and sending request...")
        self.log_signal.emit("Encoding image and sending request...")
        _, buffer = cv2.imencode('.jpg', self.frame)
        image_base64 = base64.b64encode(buffer).decode('utf-8')
        image_data_url = f"data:image/jpeg;base64,{image_base64}"

        payload = {
            "max_tokens": 100,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        { "type": "text", "text": self.instruction },
                        { "type": "image_url", "image_url": { "url": image_data_url } }
                    ]
                }
            ]
        }
        headers = {"Content-Type": "application/json"}
        try:
            self.status_signal.emit("Sending request to backend...")
            self.log_signal.emit("Sending request to backend...")
            response = requests.post(f"{self.backend_url}/v1/chat/completions", json=payload, headers=headers)
            self.status_signal.emit("Request sent. Waiting for response...")
            self.log_signal.emit("Request sent. Waiting for response...")
            if response.ok:
                data = response.json()
                result = data["choices"][0]["message"]["content"]
                self.result_signal.emit(result)
                self.status_signal.emit("Backend response received.")
                self.log_signal.emit("Backend response received.")
            else:
                self.result_signal.emit(f"Backend error: {response.status_code} {response.text}")
                self.status_signal.emit("Backend error.")
                self.log_signal.emit(f"Backend error: {response.status_code} {response.text}")
        except Exception as e:
            self.result_signal.emit(f"Request failed: {e}")
            self.status_signal.emit("Request failed.")
            self.log_signal.emit(f"Request failed: {e}")

class MainWindow(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("ESP32-CAM AI Assistant")
        self.setGeometry(100, 100, 900, 700)

        # UI Elements
        self.video_label = QLabel("Connecting to ESP32-CAM...")
        self.video_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.video_label.setStyleSheet("background: #222; border-radius: 10px;")
        self.instruction_input = QLineEdit(DEFAULT_INSTRUCTION)
        self.send_button = QPushButton("Send to Backend")
        self.stop_button = QPushButton("Stop")
        self.reconnect_button = QPushButton("Reconnect Stream")
        self.response_box = QTextEdit()
        self.response_box.setReadOnly(True)
        self.status_bar = QStatusBar()
        self.auto_send_checkbox = QCheckBox("Auto-send")
        self.interval_spinbox = QSpinBox()
        self.interval_spinbox.setRange(100, 10000)
        self.interval_spinbox.setValue(1000)
        self.interval_spinbox.setSuffix(" ms")
        self.log_box = QTextEdit()
        self.log_box.setReadOnly(True)
        self.log_box.setMaximumHeight(120)
        self.log_box.setStyleSheet("background: #181818; color: #cfcfcf; font-size: 12px;")

        # Group controls for clarity
        controls_group = QGroupBox("Controls")
        controls_layout = QGridLayout()
        controls_layout.addWidget(QLabel("Instruction:"), 0, 0)
        controls_layout.addWidget(self.instruction_input, 0, 1, 1, 3)
        controls_layout.addWidget(self.auto_send_checkbox, 1, 0)
        controls_layout.addWidget(QLabel("Interval:"), 1, 1)
        controls_layout.addWidget(self.interval_spinbox, 1, 2)
        controls_layout.addWidget(self.send_button, 2, 0)
        controls_layout.addWidget(self.stop_button, 2, 1)
        controls_layout.addWidget(self.reconnect_button, 2, 2)
        controls_group.setLayout(controls_layout)

        # Main layout
        vbox = QVBoxLayout()
        vbox.addWidget(self.video_label, stretch=4)
        vbox.addWidget(controls_group)
        vbox.addWidget(QLabel("Backend Response:"))
        vbox.addWidget(self.response_box, stretch=2)
        vbox.addWidget(QLabel("Logs:"))
        vbox.addWidget(self.log_box)
        vbox.addWidget(self.status_bar)
        self.setLayout(vbox)

        # Video stream
        self.frame = None
        self.stream_thread = None
        self.timer = QTimer()
        self.timer.timeout.connect(self.update_frame)
        self.timer.start(30)  # ~30 FPS

        # Backend
        self.send_button.clicked.connect(self.send_to_backend)
        self.stop_button.clicked.connect(self.stop_all)
        self.reconnect_button.clicked.connect(self.reconnect_stream)
        self.backend_thread = None

        # Auto-send
        self.auto_send_timer = QTimer()
        self.auto_send_timer.timeout.connect(self.auto_send_backend)
        self.auto_send_checkbox.stateChanged.connect(self.toggle_auto_send)

        # Start MJPEG stream in a thread
        self.mjpeg_gen = None
        self.start_stream()

    def start_stream(self):
        def mjpeg_generator():
            while True:
                try:
                    for frame in fetch_mjpeg_frame(ESP32_URL):
                        yield frame
                except Exception as e:
                    self.status_bar.showMessage(f"Stream error: {e}")
                    self.append_log(f"Stream error: {e}")
                    yield None
        self.mjpeg_gen = mjpeg_generator()
        self.append_log("(Re)started MJPEG stream.")

    def update_frame(self):
        try:
            frame = next(self.mjpeg_gen)
            if frame is not None:
                self.frame = frame
                rgb_image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                h, w, ch = rgb_image.shape
                bytes_per_line = ch * w
                qt_image = QImage(rgb_image.data, w, h, bytes_per_line, QImage.Format.Format_RGB888)
                pixmap = QPixmap.fromImage(qt_image).scaled(
                    self.video_label.width(), self.video_label.height(), Qt.AspectRatioMode.KeepAspectRatio)
                self.video_label.setPixmap(pixmap)
                self.status_bar.showMessage("Streaming from ESP32-CAM...")
            else:
                self.status_bar.showMessage("No frame received.")
        except Exception as e:
            self.status_bar.showMessage(f"Stream error: {e}")
            self.append_log(f"Stream error: {e}")

    def send_to_backend(self):
        if self.frame is None:
            self.status_bar.showMessage("No frame to send.")
            self.append_log("No frame to send.")
            return
        # Prevent overlapping backend requests
        if self.backend_thread and self.backend_thread.isRunning():
            self.status_bar.showMessage("Backend request in progress...")
            self.append_log("Backend request in progress...")
            return
        instruction = self.instruction_input.text()
        self.status_bar.showMessage("Sending to backend...")
        self.append_log("Sending to backend...")
        self.send_button.setEnabled(False)
        self.backend_thread = BackendThread(BACKEND_URL, instruction, self.frame)
        self.backend_thread.result_signal.connect(self.display_response)
        self.backend_thread.status_signal.connect(self.status_bar.showMessage)
        self.backend_thread.log_signal.connect(self.append_log)
        self.backend_thread.finished.connect(lambda: self.send_button.setEnabled(True))
        self.backend_thread.start()

    def auto_send_backend(self):
        self.send_to_backend()

    def toggle_auto_send(self, state):
        if self.auto_send_checkbox.isChecked():
            interval = self.interval_spinbox.value()
            self.auto_send_timer.start(interval)
            self.send_button.setEnabled(False)
            self.status_bar.showMessage("Auto-send enabled.")
            self.append_log("Auto-send enabled.")
        else:
            self.auto_send_timer.stop()
            self.send_button.setEnabled(True)
            self.status_bar.showMessage("Auto-send disabled.")
            self.append_log("Auto-send disabled.")

    def stop_all(self):
        self.auto_send_timer.stop()
        self.send_button.setEnabled(True)
        self.auto_send_checkbox.setChecked(False)
        self.status_bar.showMessage("Stopped all backend requests and auto-send.")
        self.append_log("Stopped all backend requests and auto-send.")

    def reconnect_stream(self):
        self.start_stream()
        self.status_bar.showMessage("Reconnected to ESP32-CAM stream.")
        self.append_log("Reconnected to ESP32-CAM stream.")

    def display_response(self, text):
        self.response_box.setPlainText(text)
        self.append_log(f"Backend response: {text}")

    def append_log(self, message):
        self.log_box.append(message)

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())