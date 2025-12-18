import os
import uuid
import gc
import tempfile
import logging
import pdfplumber
from fastapi import APIRouter, UploadFile, File, HTTPException
from database import supabase_admin # Ensure this name matches your database.py

router = APIRouter()
logger = logging.getLogger(__name__)

BUCKET_NAME = "Books"
MAX_MB = 15  # Limit file size to 15MB for Free Tier safety
# Limit how many pages to process to avoid crashing during JSON response generation
PAGE_LIMIT = 100 

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    # 1. Create a safe temporary file
    fd, temp_path = tempfile.mkstemp(suffix=".pdf")
    
    try:
        size = 0
        # ✅ STREAM UPLOAD TO DISK
        with os.fdopen(fd, 'wb') as tmp:
            while True:
                chunk = await file.read(1024 * 64) # 64KB chunks
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_MB * 1024 * 1024:
                    raise HTTPException(status_code=413, detail="File too large for free tier")
                tmp.write(chunk)

        logger.info(f"✅ File saved to temp: {size} bytes. Starting Supabase upload...")
        gc.collect()

        # 2. UPLOAD TO SUPABASE STORAGE FIRST
        # This ensures the file is saved even if the text extraction crashes
        storage_path = f"uploads/{uuid.uuid4()}-{file.filename}"
        with open(temp_path, "rb") as f:
            supabase_admin.storage.from_(BUCKET_NAME).upload(
                storage_path,
                f,
                {"content-type": "application/pdf"}
            )

        # 3. EXTREME MEMORY-SAFE EXTRACTION
        sentences = []
        
        # Get total page count first
        with pdfplumber.open(temp_path) as pdf:
            total_pages = len(pdf.pages)
        
        # Process pages one by one, opening and closing the file each time
        # This prevents the memory "leak" inherent in large PDF objects
        pages_to_process = min(total_pages, PAGE_LIMIT)
        logger.info(f"🚀 Processing {pages_to_process} of {total_pages} pages...")

        for i in range(pages_to_process):
            try:
                with pdfplumber.open(temp_path) as pdf:
                    page_text = pdf.pages[i].extract_text()
                    if page_text:
                        # Split text into sentences immediately
                        for s in page_text.split("."):
                            cleaned = s.strip()
                            if cleaned and len(cleaned) > 2:
                                sentences.append({"sentence": cleaned})
                
                # Manual cleanup every few pages
                if i % 10 == 0:
                    gc.collect()
                    logger.info(f"⏳ Progress: {i}/{pages_to_process} pages done")
            except Exception as page_err:
                logger.warning(f"⚠️ Skipping page {i} due to error: {page_err}")

        # Final cleanup
        gc.collect()

        # 4. STORE METADATA IN DATABASE
        supabase_admin.table("user_uploads").insert({
            "file_name": file.filename,
            "storage_path": storage_path,
            "total_pages": total_pages
        }).execute()

        logger.info(f"🎉 Success! Extracted {len(sentences)} sentences.")

        return {
            "status": "success",
            "storage_path": storage_path,
            "total_pages": total_pages,
            "processed_pages": pages_to_process,
            "sentences": sentences
        }

    except Exception as e:
        logger.error(f"❌ Critical Failure: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

    finally:
        # ABSOLUTE CLEANUP
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
                logger.info("🧹 Temp file removed.")
            except:
                pass
        gc.collect()