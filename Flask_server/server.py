from fastapi import FastAPI, Form, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import httpx
from loguru import logger
import time
from fastapi.responses import JSONResponse
from typing import Optional, Union
import threading
import cv2
import numpy as np

app = FastAPI()

# Allow CORS for local dev/testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Example: Replace with your actual AI backend endpoint and key
AI_BACKEND_URL = "https://8080-01jvyxcckwn7v10c56ara2prnw.cloudspaces.litng.ai/v1/chat/completions"
ESP32_STREAM_URL = "http://192.168.0.237/"  # <-- Set your ESP32 MJPEG stream URL here
OPTIMIZED_PROMPT = (
    "You are an assistive vision system for the visually impaired. "
    "Given an image from a wearable or mobile camera, describe the scene in a way that maximizes situational awareness and independence. "
    "Clearly identify objects, obstacles, people, and signage. If there is text, read it aloud and explain its context. "
    "Use short, direct sentences and avoid technical jargon. Prioritize information that would help a visually impaired user navigate or understand their environment."
)

# In-memory storage for the latest ESP32 frame
latest_frame: Optional[bytes] = None
latest_frame_time: Optional[float] = None
stream_thread_started = False

class VisionRequest(BaseModel):
    instruction: str = OPTIMIZED_PROMPT

@app.on_event("startup")
def start_stream_thread():
    global stream_thread_started
    if not stream_thread_started:
        t = threading.Thread(target=esp32_stream_worker, daemon=True)
        t.start()
        stream_thread_started = True
        logger.info("Started ESP32 MJPEG stream background thread.")

def esp32_stream_worker():
    global latest_frame, latest_frame_time
    while True:
        try:
            logger.info(f"Connecting to ESP32 stream at {ESP32_STREAM_URL}")
            with httpx.stream("GET", ESP32_STREAM_URL, timeout=10) as resp:
                if resp.status_code == 200:
                    logger.info("Connected to ESP32 stream.")
                    bytes_data = b''
                    for chunk in resp.iter_bytes(chunk_size=1024):
                        bytes_data += chunk
                        a = bytes_data.find(b'\xff\xd8')
                        b = bytes_data.find(b'\xff\xd9')
                        if a != -1 and b != -1:
                            jpg = bytes_data[a:b+2]
                            bytes_data = bytes_data[b+2:]
                            # Optionally, decode to check validity
                            try:
                                frame = cv2.imdecode(np.frombuffer(jpg, dtype=np.uint8), cv2.IMREAD_COLOR)
                                if frame is not None:
                                    latest_frame = jpg
                                    latest_frame_time = time.time()
                            except Exception as e:
                                logger.warning(f"Frame decode error: {e}")
                else:
                    logger.error(f"ESP32 stream returned status {resp.status_code}")
                    time.sleep(5)
        except Exception as e:
            logger.error(f"ESP32 stream connection error: {e}")
            time.sleep(5)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    idem = f"{time.time()}-{id(request)}"
    logger.info(f"RID={idem} START request path={request.url.path}")
    try:
        response = await call_next(request)
        logger.info(f"RID={idem} COMPLETED status_code={response.status_code}")
        return response
    except Exception as e:
        logger.error(f"RID={idem} FAILED error={e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/vision")
async def vision_endpoint(
    request: Request,
    instruction: str = Form(OPTIMIZED_PROMPT)
):
    global latest_frame, latest_frame_time
    try:
        # Try to get JSON body for instruction (for new clients)
        if request.headers.get("content-type", "").startswith("application/json"):
            data = await request.json()
            instruction = data.get("instruction", instruction)
        if not latest_frame:
            logger.warning("No frame available for vision endpoint.")
            return JSONResponse(status_code=400, content={"error": "No ESP32 frame available. Please ensure ESP32 is streaming."})
        image_b64 = base64.b64encode(latest_frame).decode("utf-8")
        image_data_url = f"data:image/jpeg;base64,{image_b64}"
        payload = {
            "max_tokens": 100,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": instruction},
                        {"type": "image_url", "image_url": {"url": image_data_url}}
                    ]
                }
            ]
        }
        headers = {"Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=30) as client:
            logger.info("Sending async request to AI backend.")
            resp = await client.post(AI_BACKEND_URL, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            logger.info("AI backend response received.")
            return {"response": data["choices"][0]["message"]["content"]}
    except httpx.HTTPStatusError as e:
        logger.error(f"AI backend HTTP error: {e.response.status_code} {e.response.text}")
        return JSONResponse(status_code=502, content={"error": f"AI backend error: {e.response.status_code} {e.response.text}"})
    except Exception as e:
        logger.error(f"Unhandled error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/status")
def status():
    # Consider ESP32 connected if a frame was uploaded in the last 10 seconds
    now = time.time()
    connected = latest_frame is not None and latest_frame_time is not None and (now - latest_frame_time) < 10
    return {"esp32_connected": connected}

@app.get("/")
def root():
    return {"status": "ok"}