# ============================================
# Family Law Assistant — Backend Dockerfile
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

# ✅ IMPORTANT: Force CPU-only PyTorch (prevents CUDA downloads)
ENV UV_INDEX_URL=https://download.pytorch.org/whl/cpu

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

# Put venv on PATH
ENV PATH="/app/.venv/bin:$PATH"

# Runtime env settings
ENV PYTHONUNBUFFERED=1
ENV TOKENIZERS_PARALLELISM=false

# Copy application source code
COPY . .

# Create directories required by app
RUN mkdir -p logs event_traces data/chunked data/embeddings

# Expose API port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start FastAPI server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--timeout-keep-alive", "120"]