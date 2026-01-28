# compare-docs
This tool is to compare two docs and find a diff between them

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

## Database Setup
This application uses PostgreSQL for data storage. Follow the steps below to set up PostgreSQL.

### 1. Local PostgreSQL Setup (Ubuntu/Debian)
1. Install PostgreSQL:
   ```
   sudo apt update
   sudo apt install postgresql postgresql-contrib
   ```
2. Start the PostgreSQL service:
   ```
   sudo systemctl start postgresql
   sudo systemctl enable postgresql
   ```
3. Create a database and user:
   ```
   sudo -u postgres psql
   CREATE DATABASE compare_docs;
   CREATE USER compare_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE compare_docs TO compare_user;
   \q
   ```
4. Set the DATABASE_URL environment variable:
   ```
   export DATABASE_URL="postgresql://compare_user:your_password@localhost/compare_docs"
   ```

### 2. PostgreSQL in Docker Container
1. Pull and run PostgreSQL Docker image:
   ```
   docker run --name postgres-db -e POSTGRES_DB=compare_docs -e POSTGRES_USER=compare_user -e POSTGRES_PASSWORD=your_password -p 5432:5432 -d postgres:13
   ```
2. Verify the container is running:
   ```
   docker ps
   ```
3. Set the DATABASE_URL environment variable:
   ```
   export DATABASE_URL="postgresql://compare_user:your_password@localhost/compare_docs"
   ```

### 3. Connecting to an Existing PostgreSQL Server
1. Ensure you have access to the PostgreSQL server (host, port, database name, username, password).
2. Set the DATABASE_URL environment variable with the connection details:
   ```
   export DATABASE_URL="postgresql://username:password@host:port/database_name"
   ```
   - Replace `username`, `password`, `host`, `port`, and `database_name` with your server details.
   - Default port is 5432 if not specified.

### Database Initialization and Migration
After setting up the database and setting DATABASE_URL:
1. Create the tables:
   ```
   python -m api.setup_db
   ```
2. Run the migration script to import existing data:
   ```
   python -m api.migrate
   ```

## Usage - CLI
```
python -m src.compare_docs.core <file1> <file2>
```
(Or import `from compare_docs import get_structured_diff`)

## Backend Service
1. Install deps as above (or use Docker).
2. Set up PostgreSQL database and set DATABASE_URL env var (e.g., `export DATABASE_URL="postgresql://user:password@localhost/compare_docs"`).
3. Initialize database tables: `python -m api.setup_db`
4. Run migration to import existing data: `python -m api.migrate`
5. Run service (local):
   ```
   uvicorn api.app:app --reload --port 8000
   ```
5. Docker:
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

## Syntax Check Feature
The application includes a syntax checker for various programming languages:

- **Supported Languages**: Python (multi-error detection), Java, JavaScript, JSON, XML, YAML
- **API Endpoint**: POST /validate
  ```json
  {
    "content": "code here",
    "file_type": "python"
  }
  ```
- **Response**:
  ```json
  {
    "valid": false,
    "errors": [
      {"line": 5, "col": 10, "msg": "undefined name 'foo'"},
      {"line": 12, "col": 1, "msg": "expected an indented block"}
    ]
  }
  ```
- **UI Access**: Navigate to "Syntax Check" in the React UI, paste/upload code, and check for errors.

## Features
- Structured diffs with levels.
- Supports multiple file types.
- Syntax checking for programming languages (Python, Java, JavaScript, JSON, XML, YAML).
- API for backend integration/deploy.
- React UI (in /ui) with compare and syntax check screens.

## Limitations
- History contents are stored in local file storage. If the application is moved to a different machine or environment, previous histories may not be accessible due to file path dependencies. For production, consider migrating to cloud blob storage (e.g., AWS S3).

## UI
1. cd ui
2. npm install (if not done)
3. npm run dev
4. Open http://localhost:5173 (or shown)
(Ensure backend running for compare.)