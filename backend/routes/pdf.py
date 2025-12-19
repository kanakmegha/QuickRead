import os
import json
import io
import gc
import logging
import fitz  # PyMuPDF: The speed demon
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from database import supabase_admin

router = APIRouter()
logger = logging.getLogger(__name__)

BUCKET_NAME = "Books"

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    content = await file.read()
    
    # 1. Background Upload to Supabase
    try:
        storage_path = f"uploads/{file.filename}"
        supabase_admin.storage.from_(BUCKET_NAME).upload(
            storage_path, 
            content, 
            {"content-type": "application/pdf", "upsert": "true"}
        )
    except Exception as e:
        logger.error(f"Supabase Upload Error: {e}")

    # 2. Optimized Streaming with PyMuPDF
    def stream_pdf_content():
        doc = None
        try:
            # Open PDF directly from the bytes in memory
            doc = fitz.open(stream=content, filetype="pdf")
            total_pages = len(doc)
            
            for i in range(total_pages):
                page = doc.load_page(i)
                text = page.get_text("text") # Extremely fast extraction
                
                yield json.dumps({
                    "page_index": i + 1,
                    "total_pages": total_pages,
                    "text": text
                }) + "\n"
                
                # Help memory management for Render Free Tier
                if i % 20 == 0:
                    gc.collect()
                        
        except Exception as e:
            logger.error(f"Extraction Error: {e}")
            yield json.dumps({"error": f"Interrupted: {str(e)}"}) + "\n"
        finally:
            if doc:
                doc.close()
            gc.collect()

    return StreamingResponse(
        stream_pdf_content(), 
        media_type="application/x-ndjson"
    )