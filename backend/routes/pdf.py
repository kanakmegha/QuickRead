import os
import uuid
import gc
import tempfile
import logging
import pdfplumber
from fastapi import APIRouter, UploadFile, File, HTTPException
from database import supabase_admin 

router = APIRouter()
logger = logging.getLogger(__name__)

BUCKET_NAME = "Books"
MAX_MB = 15  
# We set a strict limit for the Free Tier to prevent 503/Protocol errors
PAGE_LIMIT = 50 

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    # Basic validation
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    # 1. Create a temporary file path
    fd, temp_path = tempfile.mkstemp(suffix=".pdf")
    
    try:
        size = 0
        # ✅ STREAM UPLOAD TO DISK (Small chunks to save RAM)
        with os.fdopen(fd, 'wb') as tmp:
            while True:
                chunk = await file.read(1024 * 64) 
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_MB * 1024 * 1024:
                    raise HTTPException(status_code=413, detail="File too large for Render Free Tier")
                tmp.write(chunk)

        logger.info(f"💾 File saved: {file.filename}. Starting storage upload...")
        gc.collect()

        # 2. UPLOAD TO SUPABASE STORAGE
        storage_path = f"uploads/{uuid.uuid4()}-{file.filename}"
        with open(temp_path, "rb") as f:
            supabase_admin.storage.from_(BUCKET_NAME).upload(
                storage_path,
                f,
                {"content-type": "application/pdf"}
            )

        # 3. EXTRACTION WITH MEMORY CLEARING
        sentences = []
        with pdfplumber.open(temp_path) as pdf:
            total_pages = len(pdf.pages)
            pages_to_process = min(total_pages, PAGE_LIMIT)
            
            logger.info(f"📄 Processing {pages_to_process} pages...")

            for i in range(pages_to_process):
                page = pdf.pages[i]
                text = page.extract_text()
                
                if text:
                    for s in text.split("."):
                        cleaned = s.strip()
                        # Only keep meaningful sentences
                        if len(cleaned) > 5:
                            sentences.append({"sentence": cleaned})
                
                # ✅ CRITICAL: Destroy the page object manually after use
                pdf.pages[i] = None 
                
                if i % 10 == 0:
                    gc.collect() # Force clear RAM every 10 pages

        # 4. DATABASE METADATA INSERT
        try:
            supabase_admin.table("user_uploads").insert({
                "file_name": file.filename,
                "storage_path": storage_path,
                "total_pages": total_pages
            }).execute()
        except Exception as db_err:
            logger.error(f"⚠️ DB Insert failed (skipping): {db_err}")

        # Final cleanup before sending response
        gc.collect()

        return {
            "status": "success",
            "storage_path": storage_path,
            "total_pages": total_pages,
            "processed_pages": pages_to_process,
            "sentences": sentences[:2000] # Truncate list to keep JSON response size safe
        }

    except Exception as e:
        logger.error(f"❌ Server Error: {str(e)}", exc_info=True)
        # Check if the error is a broken pipe/protocol error
        raise HTTPException(status_code=500, detail="Server is overwhelmed. Try a smaller file.")

    finally:
        # Cleanup temp file and clear garbage
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass
        gc.collect()