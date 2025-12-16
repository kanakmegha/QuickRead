import os
import logging
import uuid
import pdfplumber
from concurrent.futures import ThreadPoolExecutor, as_completed  # For parallel processing
from fastapi import APIRouter, UploadFile, File, HTTPException
from database import supabase_admin  # Use admin client for server-side uploads/DB

logger = logging.getLogger(__name__)
router = APIRouter()

TEMP_DIR = "temp"
BUCKET_NAME = "Books"  # Match your dashboard exactly (case-sensitive!)

def process_page(page):
    """Extract text from a single page."""
    text = page.extract_text()
    return text if text else ""

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    os.makedirs(TEMP_DIR, exist_ok=True)
    temp_path = os.path.join(TEMP_DIR, file.filename)

    try:
        # 1️⃣ Save file temporarily
        content = await file.read()  # Read once into memory
        with open(temp_path, "wb") as f:
            f.write(content)

        # Generate unique path to avoid overwrites (e.g., "uploads/uuid-filename.pdf")
        unique_filename = f"uploads/{uuid.uuid4()}-{file.filename}"
        
        # 2️⃣ Upload to Supabase Storage
        with open(temp_path, "rb") as f:
            upload_response = supabase_admin.storage.from_(BUCKET_NAME).upload(
                unique_filename,  # Use unique path
                f,
                options={
                    "content_type": "application/pdf",  # Correct snake_case key
                    "upsert": True  # Overwrite if somehow conflicts
                }
            )

        if upload_response.get("error"):
            error_msg = upload_response["error"].get("message", "Unknown upload error")
            logger.error(f"❌ Supabase upload failed: {error_msg} | Response: {upload_response}")
            raise HTTPException(status_code=500, detail=f"Upload failed: {error_msg}")

        logger.info(f"✅ Uploaded to {BUCKET_NAME}/{unique_filename}")

        # 3️⃣ Create signed URL (1 year = 31536000 seconds)
        signed_response = supabase_admin.storage.from_(BUCKET_NAME).create_signed_url(
            unique_filename,
            31536000  # 1 year in seconds
        )
        if signed_response.get("error"):
            error_msg = signed_response["error"].get("message", "Unknown signed URL error")
            logger.error(f"❌ Signed URL failed: {error_msg}")
            raise HTTPException(status_code=500, detail=f"Signed URL failed: {error_msg}")
        signed_url = signed_response["signedURL"]

        # 4️⃣ Extract text in parallel
        texts = []
        with pdfplumber.open(temp_path) as pdf:
            pages = pdf.pages  # Get all pages upfront (fast)

        if not pages:
            raise HTTPException(status_code=422, detail="No pages found in PDF")

        # Parallel processing
        max_workers = min(8, len(pages))  # Tune: 4-16 based on CPU/traffic
        texts = [None] * len(pages)  # Preserve order

        def extract_single(page_idx):
            page = pages[page_idx]
            return page_idx, process_page(page)

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all tasks
            future_to_idx = {
                executor.submit(extract_single, idx): idx for idx in range(len(pages))
            }
            # Collect in completion order, but store in original order
            for future in as_completed(future_to_idx):
                idx, text = future.result()
                texts[idx] = text

        full_text = " ".join(texts).strip()
        if not full_text:
            raise HTTPException(status_code=422, detail="No readable text found")

        sentences = [{"sentence": s.strip()} for s in full_text.split('.') if s.strip()]

        # 5️⃣ Store metadata (use unique_filename for storage_path)
        db_response = supabase_admin.table("user_uploads").insert({
            "file_name": file.filename,
            "storage_path": unique_filename,  # Full path for accuracy
            "total_pages": len(texts)
        }).execute()

        if db_response.get("error"):  # Add check for DB insert
            logger.error(f"❌ DB insert failed: {db_response['error']}")
            raise HTTPException(status_code=500, detail="Metadata storage failed")

        logger.info(f"✅ Stored metadata: {db_response.data}")

        # 6️⃣ Return to frontend
        return {
            "status": "success",
            "sentences": sentences,
            "pdf_url": signed_url
        }

    except HTTPException:
        raise  # Re-raise FastAPI exceptions
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}", exc_info=True)  # Full traceback for debugging
        raise HTTPException(status_code=500, detail="PDF processing failed")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)