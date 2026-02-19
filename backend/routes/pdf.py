import os
import json
import io
import gc
import logging
import fitz  # PyMuPDF
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from database import supabase_admin

router = APIRouter()
logger = logging.getLogger(__name__)

BUCKET_NAME = "Books"

def background_upload(file_path: str, content: bytes):
    try:
        supabase_admin.storage.from_(BUCKET_NAME).upload(
            path=file_path, 
            file=content, 
            file_options={"content-type": "application/pdf", "upsert": "true"}
        )
    except Exception as e:
        logger.error(f"Background Supabase Upload Error: {e}")

@router.post("/upload")
async def upload_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    content = await file.read()
    storage_path = f"uploads/{file.filename}"
    
    # 1. Start Supabase upload in background so it doesn't block the stream
    background_tasks.add_task(background_upload, storage_path, content)

    def stream_pdf_content():
        doc = None
        try:
            # Open PDF from memory
            doc = fitz.open(stream=content, filetype="pdf")
            total_pages = len(doc)

            for i in range(total_pages):
                page = doc.load_page(i)
                text = page.get_text("text")

                # Only yield once per page
                yield json.dumps({
                    "page_index": i + 1,
                    "total_pages": total_pages,
                    "text": text
                }) + "\n"

                # Periodically collect garbage
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