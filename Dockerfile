FROM python:3.12-slim

# Avoid externally-managed env issues
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV PIP_NO_CACHE_DIR=1

WORKDIR /app

# Copy requirements and install in venv
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# Expose port
EXPOSE 8000

# Run backend
CMD ["uvicorn", "api.app:app", "--host", "0.0.0.0", "--port", "8000"]