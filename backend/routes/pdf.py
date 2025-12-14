import os
import logging
import pdfplumber
from fastapi import APIRouter, UploadFile, File, HTTPException
from database import supabase

logger = logging.getLogger(__name__)
router = APIRouter()

TEMP_DIR = "temp"

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
        # 1️⃣ Save file temporarily
        with open(temp_path, "wb") as f:
            f.write(await file.read())

        # 2️⃣ Upload to Supabase Storage (books bucket)
        with open(temp_path, "rb") as f:
            upload_response = supabase.storage.from_("books").upload(
                file.filename,
                f,
                file_options={"content-type": "application/pdf"}
            )

        if upload_response.get("error"):
            raise Exception(upload_response["error"])

        # 3️⃣ Create signed URL (1 year)
        signed_url = supabase.storage.from_("books").create_signed_url(
            file.filename,
            60 * 60 * 24 * 365
        )["signedURL"]

        # 4️⃣ Extract text
        texts = []
        with pdfplumber.open(temp_path) as pdf:
            for page in pdf.pages:
                texts.append(process_page(page))

        full_text = " ".join(texts).strip()
        if not full_text:
            raise HTTPException(status_code=422, detail="No readable text found")

        sentences = [{"sentence": s.strip()} for s in full_text.split('.') if s.strip()]

        # 5️⃣ Store metadata ONLY
        db_response = supabase.table("user_uploads").insert({
            "file_name": file.filename,
            "storage_path": file.filename,
            "total_pages": len(texts)
        }).execute()

        logger.info(f"✅ Stored metadata: {db_response.data}")

        # 6️⃣ Return to frontend
        return {
            "status": "success",
            "sentences": sentences,
            "pdf_url": signed_url
        }

    except Exception as e:
        logger.error(f"❌ Upload failed: {e}")
        raise HTTPException(status_code=500, detail="PDF upload failed")

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
