#!/bin/bash

# Start backend
echo "Starting backend..."
uvicorn api.app:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend to be ready..."
for i in {1..30}; do
  if curl -s http://localhost:8000/ > /dev/null; then
    echo "Backend is ready."
    break
  fi
  sleep 1
done

# Start frontend
echo "Starting frontend..."
cd ui
npm run dev &
FRONTEND_PID=$!

# Wait for processes
wait $BACKEND_PID $FRONTEND_PID