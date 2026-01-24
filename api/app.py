from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from compare_docs import get_structured_diff

app = FastAPI(title="Compare Docs API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CompareRequest(BaseModel):
    input1: str
    input2: str
    input_mode: str = 'path'  # 'path' or 'content'
    file_type: Optional[str] = None

@app.post("/compare")
def compare_docs_api(request: CompareRequest):
    try:
        result = get_structured_diff(
            request.input1, 
            request.input2, 
            input_mode=request.input_mode, 
            file_type=request.file_type
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def root():
    return {"message": "Compare Docs API is running. Use POST /compare"}