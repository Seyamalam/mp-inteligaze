import requests
with open("image.png", "rb") as f:
    files = {"file": ("image.png", f, "image/png")}
    data = {"instruction": "What do you see?"}
    r = requests.post("http://127.0.0.1:8000/vision", files=files, data=data)
    print(r.json())