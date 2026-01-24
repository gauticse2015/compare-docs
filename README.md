# Compare Docs

A Python tool and backend API service to compare documents/files (text, code, JSON, DOCX) and identify differences with severity levels (WARNING, ERROR, CRITICAL).

## Folder Structure
- `src/compare_docs/`: Core logic and module.
- `api/`: FastAPI backend service.
- `requirements.txt`: Dependencies.
- `tests/`: (Add tests here).

## Installation
1. Clone the repo.
2. Ensure pip is installed (e.g., `sudo apt update && sudo apt install python3-pip` on Ubuntu/Linux; or install via https://pip.pypa.io/en/stable/installation/).
3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

## Usage - CLI
```
python -m src.compare_docs.core <file1> <file2>
```
(Or import `from compare_docs import get_structured_diff`)

## Backend Service
1. Install deps as above (or use Docker).
2. Run service (local):
   ```
   uvicorn api.app:app --reload --port 8000
   ```
3. Docker:
   ```
   docker build -t compare-docs .
   docker run -p 8000:8000 compare-docs
   ```
3. API endpoint: POST /compare with JSON body:
   ```json
   {
     "input1": "/path/to/file1",
     "input2": "/path/to/file2",
     "input_mode": "path",
     "file_type": null
   }
   ```
   Or use contents for `input_mode: "content"`.

API docs: http://localhost:8000/docs (Swagger)

## Features
- Structured diffs with levels.
- Supports multiple file types.
- API for backend integration/deploy.
- React UI (in /ui) similar to diffchecker.com.

## UI
1. cd ui
2. npm install (if not done)
3. npm run dev
4. Open http://localhost:5173 (or shown)
(Ensure backend running for compare.)