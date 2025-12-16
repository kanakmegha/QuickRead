import os
import logging
import uuid
import time  # For timing logs
import pdfplumber
from concurrent.futures import ThreadPoolExecutor, as_completed  # For parallel processing
from fastapi import APIRouter, UploadFile, File, HTTPException
from database import supabase_admin  # Use admin client for server-side uploads/DB

# Configure logger for more verbose output (adjust level in your main.py or uvicorn)
logging.basicConfig(level=logging.INFO)  # Or DEBUG for ultra-verbose
logger = logging.getLogger(__name__)
router = APIRouter()

TEMP_DIR = "temp"
BUCKET_NAME = "Books"  # Match your dashboard exactly (case-sensitive!)

def process_page(page):
    """Extract text from a single page."""
    try:
        text = page.extract_text()
        return text if text else ""
    except Exception as e:
        logger.error(f"❌ Page extraction failed: {e}")
        return ""

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    start_time = time.time()  # Overall timer
    logger.info(f"🚀 Upload started for file: {file.filename} (size: {file.size} bytes)")

    if not file.filename.lower().endswith(".pdf"):
        logger.warning(f"⚠️ Invalid file type: {file.filename}")
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    os.makedirs(TEMP_DIR, exist_ok=True)
    temp_path = os.path.join(TEMP_DIR, file.filename)
    logger.info(f"📁 Temp path: {temp_path}")

    try:
        # 1️⃣ Save file temporarily
        step_start = time.time()
        content = await file.read()  # Read once into memory
        with open(temp_path, "wb") as f:
            f.write(content)
        step_time = time.time() - step_start
        logger.info(f"✅ Temp save complete: {step_time:.2f}s | File size on disk: {os.path.getsize(temp_path)} bytes")

        # Generate unique path to avoid overwrites (e.g., "uploads/uuid-filename.pdf")
        unique_filename = f"uploads/{uuid.uuid4()}-{file.filename}"
        logger.info(f"📍 Unique storage path: {unique_filename}")
        
        # 2️⃣ Upload to Supabase Storage
        step_start = time.time()
        with open(temp_path, "rb") as f:
            upload_response = supabase_admin.storage.from_(BUCKET_NAME).upload(
                unique_filename,  # Use unique path
                f,
                options={
                    "content_type": "application/pdf",  # Correct snake_case key
                    "upsert": True  # Overwrite if somehow conflicts
                }
            )
        step_time = time.time() - step_start
        logger.info(f"📤 Upload response time: {step_time:.2f}s | Full response: {upload_response}")

        if upload_response.get("error"):
            error_msg = upload_response["error"].get("message", "Unknown upload error")
            error_details = upload_response["error"].get("details", "No details")
            logger.error(f"❌ Supabase upload failed: {error_msg} | Details: {error_details} | Code: {upload_response['error'].get('code')}")
            raise HTTPException(status_code=500, detail=f"Upload failed: {error_msg}")

        logger.info(f"✅ Uploaded to {BUCKET_NAME}/{unique_filename} | Path: {upload_response.get('data', {}).get('path')}")

        # 3️⃣ Create signed URL (1 year = 31536000 seconds)
        step_start = time.time()
        signed_response = supabase_admin.storage.from_(BUCKET_NAME).create_signed_url(
            unique_filename,
            31536000  # 1 year in seconds
        )
        step_time = time.time() - step_start
        logger.info(f"🔗 Signed URL response time: {step_time:.2f}s | Full response: {signed_response}")

        if signed_response.get("error"):
            error_msg = signed_response["error"].get("message", "Unknown signed URL error")
            logger.error(f"❌ Signed URL failed: {error_msg} | Full error: {signed_response['error']}")
            raise HTTPException(status_code=500, detail=f"Signed URL failed: {error_msg}")
        signed_url = signed_response["signedURL"]
        logger.info(f"✅ Signed URL generated: {signed_url[:100]}...")  # Truncate for logs

        # 4️⃣ Extract text in parallel
        step_start = time.time()
        texts = []
        with pdfplumber.open(temp_path) as pdf:
            pages = pdf.pages  # Get all pages upfront (fast)
            logger.info(f"📄 PDF opened: {len(pages)} pages detected")

        if not pages:
            logger.warning("⚠️ No pages found in PDF")
            raise HTTPException(status_code=422, detail="No pages found in PDF")

        # Parallel processing
        max_workers = min(8, len(pages))  # Tune: 4-16 based on CPU/traffic
        logger.info(f"🔄 Starting parallel extraction: {len(pages)} pages, {max_workers} workers")
        texts = [None] * len(pages)  # Preserve order

        def extract_single(page_idx):
            try:
                page = pages[page_idx]
                text = process_page(page)
                logger.debug(f"📝 Page {page_idx + 1} extracted: {len(text)} chars")
                return page_idx, text
            except Exception as e:
                logger.error(f"❌ Extraction failed for page {page_idx}: {e}")
                return page_idx, ""

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all tasks
            future_to_idx = {
                executor.submit(extract_single, idx): idx for idx in range(len(pages))
            }
            completed = 0
            # Collect in completion order, but store in original order
            for future in as_completed(future_to_idx):
                idx, text = future.result()
                texts[idx] = text
                completed += 1
                if completed % 10 == 0 or completed == len(pages):  # Log progress every 10
                    logger.info(f"⏳ Extraction progress: {completed}/{len(pages)} pages done")

        step_time = time.time() - step_start
        total_chars = sum(len(t or "") for t in texts)
        logger.info(f"✅ Extraction complete: {step_time:.2f}s | Total chars: {total_chars} | Pages processed: {len(pages)}")

        full_text = " ".join(texts).strip()
        if not full_text:
            logger.warning("⚠️ No readable text extracted from any page")
            raise HTTPException(status_code=422, detail="No readable text found")

        # Sentence splitting
        sentences = [{"sentence": s.strip()} for s in full_text.split('.') if s.strip()]
        logger.info(f"🔢 Sentences extracted: {len(sentences)}")

        # 5️⃣ Store metadata (use unique_filename for storage_path)
        step_start = time.time()
        db_response = supabase_admin.table("user_uploads").insert({
            "file_name": file.filename,
            "storage_path": unique_filename,  # Full path for accuracy
            "total_pages": len(texts)
        }).execute()
        step_time = time.time() - step_start
        logger.info(f"💾 DB insert time: {step_time:.2f}s | Full response: {db_response}")

        if db_response.get("error"):
            error_msg = db_response["error"].get("message", "Unknown DB error")
            error_details = db_response["error"].get("details", "No details")
            logger.error(f"❌ DB insert failed: {error_msg} | Details: {error_details} | Code: {db_response['error'].get('code')}")
            raise HTTPException(status_code=500, detail="Metadata storage failed")

        logger.info(f"✅ Metadata stored: {db_response.data}")

        # 6️⃣ Return to frontend
        total_time = time.time() - start_time
        logger.info(f"🎉 Upload & process complete: {total_time:.2f}s total | Sentences: {len(sentences)} | URL: {signed_url[:50]}...")
        return {
            "status": "success",
            "sentences": sentences,
            "pdf_url": signed_url,
            "debug": {  # Optional: Include timings in response for frontend debug
                "total_time": round(total_time, 2),
                "upload_time": round(step_time, 2),  # Last step_time was DB, but adjust if needed
                "extraction_time": round(step_time, 2),  # Reuse for demo
                "pages": len(pages),
                "total_chars": total_chars
            }
        }

    except HTTPException:
        total_time = time.time() - start_time
        logger.error(f"🔴 HTTP Exception after {total_time:.2f}s: Re-raising")
        raise  # Re-raise FastAPI exceptions
    except Exception as e:
        total_time = time.time() - start_time
        logger.error(f"❌ Unexpected error after {total_time:.2f}s: {e}", exc_info=True)  # Full traceback for debugging
        raise HTTPException(status_code=500, detail=f"PDF processing failed: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
            logger.info(f"🧹 Temp file cleaned up: {temp_path}")
        logger.info(f"🏁 Endpoint finished: {time.time() - start_time:.2f}s total")