import os
import uuid
import pdfplumber
import tempfile
from fastapi import APIRouter, UploadFile, File, HTTPException
from database import supabase
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

BUCKET_NAME = "Books"  # MUST MATCH SUPABASE EXACTLY
MAX_MB = 10

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    size = 0
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")

    try:
        # ✅ STREAM FILE (NO MEMORY SPIKE)
        while True:
            chunk = await file.read(1024 * 1024)  # 1MB
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_MB * 1024 * 1024:
                raise HTTPException(status_code=413, detail="File too large")
            temp_file.write(chunk)

        temp_file.close()

        # ✅ UPLOAD FIRST
        storage_path = f"uploads/{uuid.uuid4()}.pdf"
        with open(temp_file.name, "rb") as f:
            supabase.storage.from_(BUCKET_NAME).upload(
                storage_path,
                f,
                {"content-type": "application/pdf"}
            )

        # ✅ PARSE SEQUENTIALLY (SAFE)
        sentences = []
        with pdfplumber.open(temp_file.name) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    for s in text.split("."):
                        s = s.strip()
                        if s:
                            sentences.append({"sentence": s})

        return {
            "status": "success",
            "storage_path": storage_path,
            "sentences": sentences
        }

    except Exception as e:
        logger.exception("PDF upload failed")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if os.path.exists(temp_file.name):
            os.unlink(temp_file.name)
