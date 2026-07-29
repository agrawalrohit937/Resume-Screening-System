FROM python:3.10-slim

# सिस्टम पैकेजेस (बिना भारी LaTeX के) - सिर्फ जरूरी टूल्स
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render के डायनामिक $PORT वेरिएबल का इस्तेमाल (डिफ़ॉल्ट 10000)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}"]