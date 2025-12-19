import os
import json
import io
import gc
import logging
import fitz  # PyMuPDF
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from database import supabase_admin

# 1. INITIALIZE THE ROUTER HERE (This was missing or too low in the file)
router = APIRouter()
logger = logging.getLogger(__name__)

BUCKET_NAME = "Books"

# 2. NOW YOU CAN USE THE DECORATOR
@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    content = await file.read()
    
    # Supabase logic with the 'upsert' fix we discussed
    try:
        storage_path = f"uploads/{file.filename}"
        supabase_admin.storage.from_(BUCKET_NAME).upload(
            path=storage_path, 
            file=content, 
            file_options={"content-type": "application/pdf", "upsert": "true"}
        )
    except Exception as e:
        logger.error(f"Supabase Note: {e}")

    def stream_pdf_content():
        doc = None
        try:
            doc = fitz.open(stream=content, filetype="pdf")
            total_pages = len(doc)
            
            for i in range(total_pages):
                page = doc.load_page(i)
                text = page.get_text("text")
                
                if text:
                    yield json.dumps({
                        "page_index": i + 1,
                        "total_pages": total_pages,
                        "text": text
                    }) + "\n"
                
                if i % 20 == 0:
                    gc.collect()
                        
        except Exception as e:
            logger.error(f"Extraction Error: {e}")
            yield json.dumps({"error": "Processing interrupted"}) + "\n"
        finally:
            if doc:
                doc.close()
            gc.collect()

    return StreamingResponse(stream_pdf_content(), media_type="application/x-ndjson")