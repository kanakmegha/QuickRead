import os
import logging
import pdfplumber
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from database import supabase
from utils.auth import verify_user

logger = logging.getLogger(__name__)
router = APIRouter()

def process_page(page):
    text = page.extract_text()
    return text if text else ""

@router.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    user=Depends(verify_user)
):
    user_id = user.user.id  # logged-in user's ID
    logger.info(f"📤 Upload request from user: {user_id}")

    file_path = f"temp/{user_id}_{file.filename}"

    try:
        # Validate file type
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")

        # Save temporarily
        os.makedirs("temp", exist_ok=True)
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())

        # Extract PDF text
        texts = []
        with pdfplumber.open(file_path) as pdf:
            for idx, page in enumerate(pdf.pages):
                try:
                    texts.append(process_page(page))
                except Exception as e:
                    logger.warning(f"⚠ Error processing page {idx}: {e}")

        full_text = " ".join(texts)
        full_text = " ".join(full_text.split())

        if not full_text:
            raise HTTPException(status_code=422, detail="No readable text found in this PDF")

        # Convert into sentence list
        sentences = [{"sentence": s.strip()} for s in full_text.split('.') if s.strip()]

        logger.info(f"📝 Extracted {len(sentences)} sentences")

        # Save PDF metadata in Supabase
        try:
            supabase.table("user_uploads").insert({
                "user_id": user_id,
                "file_name": file.filename,
                "pages_count": len(texts)
            }).execute()
        except Exception as e:
            logger.error(f"⚠ Failed to log upload in DB: {e}")

        return {
            "status": "success",
            "total_sentences": len(sentences),
            "sentences": sentences
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ PDF Processing Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process PDF")

    finally:
        if os.path.exists(file_path):
            os.remove(file_path)
