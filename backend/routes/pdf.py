import os
import logging
import uuid  # For unique paths
import pdfplumber
from fastapi import APIRouter, UploadFile, File, HTTPException
from database import supabase  # Assuming this is your initialized client with service key

logger = logging.getLogger(__name__)
router = APIRouter()

TEMP_DIR = "temp"
BUCKET_NAME = "Books"  # Standardize here—match your dashboard exactly (case-sensitive!)

def process_page(page):
    text = page.extract_text()
    return text if text else ""

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    os.makedirs(TEMP_DIR, exist_ok=True)
    temp_path = os.path.join(TEMP_DIR, file.filename)

    try:
        # 1️⃣ Save file temporarily (or stream directly if <6MB)
        content = await file.read()  # Read once into memory
        with open(temp_path, "wb") as f:
            f.write(content)

        # Generate unique path to avoid overwrites (e.g., "uploads/uuid-filename.pdf")
        unique_filename = f"uploads/{uuid.uuid4()}-{file.filename}"
        
        # 2️⃣ Upload to Supabase Storage
        with open(temp_path, "rb") as f:
            upload_response = supabase.storage.from_(BUCKET_NAME).upload(
                unique_filename,  # Use unique path
                f,
                options={
                    "content_type": "application/pdf",  # Snake_case key!
                    "upsert": True  # Overwrite if somehow conflicts
                }
            )

        if upload_response.get("error"):
            error_msg = upload_response["error"].get("message", "Unknown upload error")
            logger.error(f"❌ Supabase upload failed: {error_msg} | Response: {upload_response}")
            raise HTTPException(status_code=500, detail=f"Upload failed: {error_msg}")

        logger.info(f"✅ Uploaded to {BUCKET_NAME}/{unique_filename}")

        # 3️⃣ Create signed URL (1 year = 31536000 seconds)
        signed_response = supabase.storage.from_(BUCKET_NAME).create_signed_url(  # Same bucket!
            unique_filename,
            60 * 60 * 24 * 365
        )
        if signed_response.get("error"):
            error_msg = signed_response["error"].get("message", "Unknown signed URL error")
            logger.error(f"❌ Signed URL failed: {error_msg}")
            raise HTTPException(status_code=500, detail=f"Signed URL failed: {error_msg}")
        signed_url = signed_response["signedURL"]

        # 4️⃣ Extract text
        texts = []
        with pdfplumber.open(temp_path) as pdf:
            for page in pdf.pages:
                texts.append(process_page(page))

        full_text = " ".join(texts).strip()
        if not full_text:
            raise HTTPException(status_code=422, detail="No readable text found")

        sentences = [{"sentence": s.strip()} for s in full_text.split('.') if s.strip()]

        # 5️⃣ Store metadata (use unique_filename for storage_path)
        db_response = supabase.table("user_uploads").insert({
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
        logger.error(f"❌ Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="PDF processing failed")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)