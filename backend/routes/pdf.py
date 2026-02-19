import os
import json
import io
import gc
import logging
import asyncio
import fitz  # PyMuPDF
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from database import supabase_admin

router = APIRouter()
logger = logging.getLogger(__name__)

BUCKET_NAME = "Books"

async def extract_background(filename: str, content: bytes):
    """Extracts text in the background and saves to Supabase as JSON."""
    doc = None
    try:
        logger.info(f"Background extraction started for: {filename}")
        doc = fitz.open(stream=io.BytesIO(content), filetype="pdf")
        
        extracted_data = []
        for i in range(len(doc)):
            # Process in thread to avoid blocking
            page = await asyncio.to_thread(doc.load_page, i)
            text = await asyncio.to_thread(page.get_text, "text")
            extracted_data.append(text)
            
            if i % 20 == 0:
                gc.collect()
        
        # Save results to Supabase
        json_content = json.dumps({"pages": extracted_data})
        storage_path = f"extracted/{filename}.json"
        
        supabase_admin.storage.from_(BUCKET_NAME).upload(
            path=storage_path,
            file=json_content.encode('utf-8'),
            file_options={"content-type": "application/json", "upsert": "true"}
        )
        logger.info(f"Background extraction finished for: {filename}")
        
    except Exception as e:
        logger.error(f"Background Extraction Error for {filename}: {e}")
    finally:
        if doc:
            doc.close()
        gc.collect()

@router.post("/upload")
async def upload_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    content = await file.read()
    filename = file.filename
    
    # 1. Save original PDF to Supabase
    try:
        storage_path = f"uploads/{filename}"
        supabase_admin.storage.from_(BUCKET_NAME).upload(
            path=storage_path, 
            file=content, 
            file_options={"content-type": "application/pdf", "upsert": "true"}
        )
    except Exception as e:
        logger.warning(f"Original PDF upload issue: {e}")

    # 2. Trigger background extraction
    background_tasks.add_task(extract_background, filename, content)

    return {"filename": filename, "status": "processing"}

@router.get("/status/{filename}")
async def get_status(filename: str):
    """Checks if the extracted JSON exists in Supabase."""
    try:
        path = f"extracted/{filename}.json"
        # Try to get info about the file. If it exists, we're done.
        res = supabase_admin.storage.from_(BUCKET_NAME).get_public_url(path)
        # Note: get_public_url doesn't check existence, so we use list()
        files = supabase_admin.storage.from_(BUCKET_NAME).list("extracted")
        exists = any(f['name'] == f"{filename}.json" for f in files)
        
        return {"status": "ready" if exists else "processing"}
    except Exception as e:
        logger.error(f"Status check error: {e}")
        return {"status": "error", "message": str(e)}

@router.get("/result/{filename}")
async def get_result(filename: str):
    """Returns the final extracted JSON data."""
    try:
        path = f"extracted/{filename}.json"
        response = supabase_admin.storage.from_(BUCKET_NAME).download(path)
        return json.loads(response.decode('utf-8'))
    except Exception as e:
        logger.error(f"Result fetch error: {e}")
        raise HTTPException(status_code=404, detail="Result not found or not ready")