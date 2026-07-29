FROM python:3.10-slim

# सिस्टम पैकेजेस - सिर्फ जरूरी टूल्स
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# 1. Python पैकेजेस इंस्टॉल करें
RUN pip install --no-cache-dir -r requirements.txt

# 2. Playwright Chromium ब्राउज़र और उसकी जरूरी Linux Dependencies इंस्टॉल करें
RUN playwright install --with-deps chromium

COPY . .

# Render के डायनामिक $PORT वेरिएबल का इस्तेमाल (डिफ़ॉल्ट 10000)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}"]