import requests

SERVER_URL = 'http://127.0.0.1:8000'  # Change to your FastAPI server address if needed

# 1. Test backend health
try:
    r = requests.get(f'{SERVER_URL}/')
    print('Health check:', r.status_code, r.json())
except Exception as e:
    print('Health check failed:', e)

# 2. Test ESP32 status
try:
    r = requests.get(f'{SERVER_URL}/status')
    print('ESP32 status:', r.status_code, r.json())
except Exception as e:
    print('ESP32 status check failed:', e)

# 3. Test vision endpoint
try:
    data = {'instruction': 'What do you see?'}
    r = requests.post(f'{SERVER_URL}/vision', data=data)
    print('Vision response:', r.status_code, r.json())
except Exception as e:
    print('Vision endpoint failed:', e) 