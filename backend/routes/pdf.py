import os
import uuid
import pdfplumber
import tempfile
import gc  # <--- Essential for manual memory clearing
from fastapi import APIRouter, UploadFile, File, HTTPException
from database import supabase_admin # Use admin for storage
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

BUCKET_NAME = "Books" 
MAX_MB = 10  # Keep limit strict for Render Free Tier

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    # 1. Create a truly temporary file
    fd, temp_path = tempfile.mkstemp(suffix=".pdf")
    
    try:
        size = 0
        with os.fdopen(fd, 'wb') as tmp:
            # ✅ STREAM CHUNKS: This keeps RAM usage at nearly 0 during upload
            while True:
                chunk = await file.read(1024 * 64)  # 64KB chunks are safer for RAM
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_MB * 1024 * 1024:
                    raise HTTPException(status_code=413, detail="File too large")
                tmp.write(chunk)

        # Force clear memory after the upload stream is finished
        gc.collect() 

        # 2. Upload to Supabase Storage FIRST
        # This gets the file off Render's temporary disk/RAM as soon as possible
        storage_path = f"uploads/{uuid.uuid4()}.pdf"
        with open(temp_path, "rb") as f:
            upload_response = supabase_admin.storage.from_(BUCKET_NAME).upload(
                storage_path,
                f,
                {"content-type": "application/pdf"}
            )
        
        # Check for upload errors
        if hasattr(upload_response, 'error') and upload_response.error:
            raise Exception(f"Supabase Upload Error: {upload_response.error}")

        # 3. SEQUENTIAL EXTRACTION (The "Memory Saver" part)
        sentences = []
        with pdfplumber.open(temp_path) as pdf:
            total_pages = len(pdf.pages)
            logger.info(f"Processing {total_pages} pages...")

            for i in range(total_pages):
                page = pdf.pages[i]
                text = page.extract_text()
                
                if text:
                    # Process sentences immediately to keep the string small
                    for s in text.split("."):
                        cleaned = s.strip()
                        if cleaned:
                            sentences.append({"sentence": cleaned})
                
                # IMPORTANT: Clear the page reference and run GC every 5 pages
                # This prevents memory from "piling up"
                if i % 5 == 0:
                    gc.collect()

        # Final cleanup before sending response
        gc.collect()

        return {
            "status": "success",
            "storage_path": storage_path,
            "sentences": sentences,
            "page_count": total_pages
        }

    except Exception as e:
        logger.error(f"❌ PDF process failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Cleanup the temp file immediately
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass
        gc.collect() # Final sweep