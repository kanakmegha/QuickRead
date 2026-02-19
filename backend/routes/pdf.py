import os
import json
import io
import gc
import logging
import asyncio
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

import io

@router.post("/upload")
async def upload_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    logger.info(f"Upload started: {file.filename}")
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    content = await file.read()
    logger.info(f"File read into memory: {len(content)} bytes")
    storage_path = f"uploads/{file.filename}"
    
    background_tasks.add_task(background_upload, storage_path, content)

    async def stream_pdf_content():
        doc = None
        try:
            logger.info("Starting stream...")
            doc = fitz.open(stream=io.BytesIO(content), filetype="pdf")
            total_pages = len(doc)
            logger.info(f"PDF opened, total pages: {total_pages}")

            for i in range(total_pages):
                # Run CPU-bound extraction in a thread to avoid blocking the event loop
                page = await asyncio.to_thread(doc.load_page, i)
                text = await asyncio.to_thread(page.get_text, "text")

                yield json.dumps({
                    "page_index": i + 1,
                    "total_pages": total_pages,
                    "text": text
                }) + "\n"

                # Yield control back to the event loop
                await asyncio.sleep(1e-4)
                
                if i % 20 == 0:
                    gc.collect()
                        
        except Exception as e:
            logger.error(f"Extraction Error: {e}")
            yield json.dumps({"error": f"Processing interrupted: {str(e)}"}) + "\n"
        finally:
            if doc:
                doc.close()
            gc.collect()
            logger.info("Stream finished")

    return StreamingResponse(stream_pdf_content(), media_type="application/x-ndjson")