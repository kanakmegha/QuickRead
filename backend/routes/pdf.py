import io, gc, logging, pdfplumber
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from database import supabase_admin

router = APIRouter()
BUCKET_NAME = "Books"

@router.post("/upload_to_storage")
async def upload_to_storage(file: UploadFile = File(...)):
    # STEP 1: Just upload the file to Supabase and return the path
    # This keeps the initial request very fast
    content = await file.read()
    storage_path = f"uploads/{file.filename}"
    try:
        supabase_admin.storage.from_(BUCKET_NAME).upload(
            storage_path, content, {"content-type": "application/pdf", "upsert": "true"}
        )
        return {"storage_path": storage_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/extract_batch")
async def extract_batch(path: str, start_page: int, batch_size: int = 5):
    # STEP 2: Extract only a small 'window' of pages
    try:
        # Download the file from Supabase
        file_data = supabase_admin.storage.from_(BUCKET_NAME).download(path)
        
        pages_text = []
        with pdfplumber.open(io.BytesIO(file_data)) as pdf:
            total = len(pdf.pages)
            end_page = min(start_page + batch_size, total)
            
            for i in range(start_page, end_page):
                text = pdf.pages[i].extract_text() or ""
                pages_text.append(text)
            
            return {
                "pages": pages_text,
                "total_pages": total,
                "next_start": end_page if end_page < total else None
            }
    except Exception as e:
        gc.collect()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        gc.collect()