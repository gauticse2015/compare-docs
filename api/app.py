from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import sys
import os
import json
import tempfile
import datetime
from sqlalchemy.orm import Session

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from compare_docs import get_structured_diff
from .database import get_db, User, History, hash_password, verify_password, create_tables

# Blob storage setup
CONTENTS_DIR = "contents"
os.makedirs(CONTENTS_DIR, exist_ok=True)

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
def register(user: RegisterRequest, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="User already exists")
    hashed_password = hash_password(user.password)
    new_user = User(name=user.name, email=user.email, password_hash=hashed_password, created_at=datetime.datetime.utcnow())
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully"}

@app.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == req.email).first()
    if not db_user or not verify_password(req.password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"user": {"id": db_user.id, "name": db_user.name, "email": db_user.email}}

@app.post("/reset-password")
def reset_password(req: ResetRequest, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == req.email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    db_user.password_hash = hash_password(req.new_password)
    db_user.updated_at = datetime.datetime.utcnow()
    db.commit()
    return {"message": "Password reset successfully"}

@app.post("/save-history")
def save_history(request: SaveHistoryRequest, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == request.email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Create history record
    new_history = History(user_id=db_user.id, result=request.history.result, timestamp=datetime.datetime.utcnow())
    db.add(new_history)
    db.commit()
    db.refresh(new_history)

    # Save contents to files
    user_dir = os.path.join(CONTENTS_DIR, str(db_user.id))
    os.makedirs(user_dir, exist_ok=True)

    left_path = os.path.join(user_dir, f"{new_history.id}_left.txt")
    right_path = os.path.join(user_dir, f"{new_history.id}_right.txt")

    with open(left_path, 'w', encoding='utf-8') as f:
        f.write(request.history.leftContent)
    with open(right_path, 'w', encoding='utf-8') as f:
        f.write(request.history.rightContent)

    # Update paths in DB
    new_history.left_content_path = left_path
    new_history.right_content_path = right_path
    db.commit()

    return {"message": "History saved"}

@app.get("/get-history")
def get_history(email: str, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == email).first()
    if not db_user:
        return []

    db_histories = db.query(History).filter(History.user_id == db_user.id).order_by(History.timestamp.desc()).all()

    result = []
    for h in db_histories:
        left_content = ""
        right_content = ""
        if h.left_content_path and os.path.exists(h.left_content_path):
            with open(h.left_content_path, 'r', encoding='utf-8') as f:
                left_content = f.read()
        if h.right_content_path and os.path.exists(h.right_content_path):
            with open(h.right_content_path, 'r', encoding='utf-8') as f:
                right_content = f.read()
        result.append({
            "leftContent": left_content,
            "rightContent": right_content,
            "result": h.result,
            "timestamp": h.timestamp.isoformat() if h.timestamp else None
        })
    return result

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