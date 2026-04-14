# ============================================
# Family Law Assistant — Backend Dockerfile
# ============================================
# Multi-stage build: keeps final image lean
# Python 3.11 (matches .python-version)
# ============================================

# ── Stage 1: Builder ─────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

# System deps needed for building Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install uv (fast Python package manager)
RUN pip install --no-cache-dir uv

# Copy dependency files first (Docker layer caching)
COPY pyproject.toml uv.lock ./

# Install production dependencies only
RUN uv sync --frozen --no-dev --no-editable

# ── Stage 2: Runtime ─────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Minimal runtime deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Put venv on PATH so `python`, `uvicorn`, etc. resolve to venv binaries
ENV PATH="/app/.venv/bin:$PATH"
# Prevent Python from buffering stdout/stderr (important for Docker logs)
ENV PYTHONUNBUFFERED=1
# Disable tokenizer parallelism warnings from HuggingFace
ENV TOKENIZERS_PARALLELISM=false

# Copy application source code
COPY . .

# Create directories the app expects at runtime
RUN mkdir -p logs event_traces data/chunked data/embeddings

# Expose the API port
EXPOSE 8000

# Health check — Render and other platforms use this
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start the server
# - Single worker: embedding model loads in-process (~90MB RAM), 
#   multiple workers would duplicate it
# - timeout 120: embedding model can take time to load on first start
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--timeout-keep-alive", "120"]
