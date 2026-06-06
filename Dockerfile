# ── Stage 1: build React frontend ──────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python backend + bundled frontend ──────────────────────────────
FROM python:3.11-slim

# ffmpeg is required by torchaudio / demucs for audio decoding
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (layer-cached)
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the htdemucs model weights so first request is fast
RUN python -c "from demucs.pretrained import get_model; get_model('htdemucs')" 2>&1 | tee /tmp/model-download.log && echo "Model download done"

# Copy backend
COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
