from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import sys
import os
import json
import tempfile

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from compare_docs import get_structured_diff

# File-based storage
USERS_FILE = "users.json"
HISTORIES_FILE = "histories.json"

def load_users() -> List[Dict]:
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r') as f:
            return json.load(f)
    return []

def save_users(users: List[Dict]):
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f, indent=2)

def load_histories() -> Dict[str, List[Dict]]:
    if os.path.exists(HISTORIES_FILE):
        with open(HISTORIES_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_histories(histories: Dict[str, List[Dict]]):
    with open(HISTORIES_FILE, 'w') as f:
        json.dump(histories, f, indent=2)

app = FastAPI(title="Compare Docs API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CompareRequest(BaseModel):
    input1: Optional[str] = None
    input2: Optional[str] = None
    input_mode: str = 'content'  # 'content' or 'path'
    file_type: Optional[str] = None

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ResetRequest(BaseModel):
    email: str
    new_password: str

class HistoryItem(BaseModel):
    leftContent: str
    rightContent: str
    result: Dict
    timestamp: str

class SaveHistoryRequest(BaseModel):
    email: str
    history: HistoryItem

@app.post("/register")
def register(user: RegisterRequest):
    users = load_users()
    if any(u['email'] == user.email for u in users):
        raise HTTPException(status_code=400, detail="User already exists")
    users.append({"name": user.name, "email": user.email, "password": user.password})
    save_users(users)
    return {"message": "User registered successfully"}

@app.post("/login")
def login(req: LoginRequest):
    users = load_users()
    user = next((u for u in users if u['email'] == req.email and u['password'] == req.password), None)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"user": user}

@app.post("/reset-password")
def reset_password(req: ResetRequest):
    users = load_users()
    user = next((u for u in users if u['email'] == req.email), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user['password'] = req.new_password
    save_users(users)
    return {"message": "Password reset successfully"}

@app.post("/save-history")
def save_history(request: SaveHistoryRequest):
    histories = load_histories()
    email = request.email
    if email not in histories:
        histories[email] = []
    histories[email].append(request.history.dict())
    save_histories(histories)
    return {"message": "History saved"}

@app.get("/get-history")
def get_history(email: str):
    histories = load_histories()
    return histories.get(email, [])

@app.post("/compare")
def compare_docs_api(
    input1: Optional[str] = None,
    input2: Optional[str] = None,
    file1: Optional[UploadFile] = File(None),
    file2: Optional[UploadFile] = File(None),
    input_mode: str = 'content',
    file_type: Optional[str] = None
):
    try:
        if file1 and file2:
            # Save uploaded files to temp
            with tempfile.NamedTemporaryFile(delete=False) as temp1:
                temp1.write(file1.file.read())
                temp1_path = temp1.name
            with tempfile.NamedTemporaryFile(delete=False) as temp2:
                temp2.write(file2.file.read())
                temp2_path = temp2.name
            try:
                result = get_structured_diff(temp1_path, temp2_path, input_mode='path', file_type=file_type)
            finally:
                os.unlink(temp1_path)
                os.unlink(temp2_path)
            return result
        elif input1 and input2:
            result = get_structured_diff(input1, input2, input_mode='content', file_type=file_type)
            return result
        else:
            raise HTTPException(status_code=400, detail="Provide either files or content")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def root():
    return {"message": "Compare Docs API is running. Use POST /compare"}