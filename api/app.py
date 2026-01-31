from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Body, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
from typing import Optional, List, Dict, Union
import sys
import os
import json
import tempfile
import datetime
from sqlalchemy.orm import Session

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from compare_docs import get_structured_diff
from syntax_parser import parse_syntax
from .database import get_db, User, History, hash_password, verify_password, create_tables

# Create database tables
create_tables()

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
    input1: Optional[Union[str, Dict]] = None
    input2: Optional[Union[str, Dict]] = None
    input_mode: str = 'content'  # 'content' or 'path'
    file_type: Optional[str] = None
    validate_syntax: bool = False

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

class ValidateRequest(BaseModel):
    content: str
    file_type: str

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
    file1: Optional[UploadFile] = File(None),
    file2: Optional[UploadFile] = File(None),
    input1: Optional[str] = Form(None),
    input2: Optional[str] = Form(None),
    input_mode: str = Form('content'),
    file_type: Optional[str] = Form(None),
    validate_syntax: bool = Form(False)
):
    try:
        content1 = None
        content2 = None
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
        elif input1 and input2:
            if isinstance(input1, dict):
                input1 = json.dumps(input1)
            if isinstance(input2, dict):
                input2 = json.dumps(input2)
            result = get_structured_diff(input1, input2, input_mode=input_mode, file_type=file_type)
        else:
            raise HTTPException(status_code=400, detail="Provide either files or content")
        
        if validate_syntax and file_type:
            if file1 and file2:
                # For files, we need to read content again, but since temp files are deleted, perhaps skip or read from files
                # For simplicity, skip validation for uploaded files for now
                pass
            elif input1 and input2:
                valid1, errors1 = parse_syntax(input1, file_type)
                valid2, errors2 = parse_syntax(input2, file_type)
                if not valid1:
                    result['warnings'].append(f"Syntax errors in input1: {errors1}")
                if not valid2:
                    result['warnings'].append(f"Syntax errors in input2: {errors2}")
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/extract-docx-text")
def extract_docx_text(file: UploadFile = File(...)):
    try:
        from docx import Document
        import io
        # Since file.file is a SpooledTemporaryFile, we can seek to 0
        file.file.seek(0)
        doc = Document(file.file)
        text = []
        images = []
        charts = []
        for shape in doc.inline_shapes:
            if shape.type == 3:  # picture
                name = getattr(shape._inline, 'docPr', None)
                if name:
                    name = name.name
                else:
                    name = 'Unknown'
                images.append(name)
            elif shape.type == 5:  # chart
                name = getattr(shape._inline, 'docPr', None)
                if name:
                    name = name.name
                else:
                    name = 'Unknown'
                charts.append(name)
        for para in doc.paragraphs:
            para_text = ''
            style_name = para.style.name if para.style else 'Normal'
            if style_name.lower() != 'normal':
                para_text += f'[{style_name}] '
            alignment = para.alignment
            if alignment:
                para_text += f'[align:{alignment}] '
            for run in para.runs:
                run_styles = []
                if run.bold:
                    run_styles.append('bold')
                if run.italic:
                    run_styles.append('italic')
                if run.underline:
                    run_styles.append('underline')
                if run.font.color and run.font.color.rgb:
                    run_styles.append(f'color:{run.font.color.rgb}')
                if run.font.size:
                    run_styles.append(f'size:{run.font.size.pt}pt')
                if run.font.name:
                    run_styles.append(f'font:{run.font.name}')
                if run_styles:
                    para_text += f'[{"; ".join(run_styles)}]{run.text}[/style]'
                else:
                    para_text += run.text
            if para_text.strip():
                text.append(para_text + '\n')
        if images:
            text.append(f'[Images: {", ".join(images)}]\n')
        if charts:
            text.append(f'[Charts: {", ".join(charts)}]\n')
        return {"text": ''.join(text)}
    except Exception as e:
        return {"error": str(e)}

@app.post("/validate")
def validate_syntax(request: ValidateRequest):
    try:
        valid, errors = parse_syntax(request.content, request.file_type)
        return {"valid": valid, "errors": errors}
    except Exception as e:
        return {"valid": False, "errors": [{"line": 0, "col": 0, "msg": str(e)}]}

@app.get("/")
def root():
    return {"message": "Compare Docs API is running. Use POST /compare"}