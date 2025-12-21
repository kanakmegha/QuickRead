from fastapi import APIRouter, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
import fitz
import json
import gc
from database import supabase_admin

router = APIRouter()

def background_supabase_upload(content, filename):
    try:
        supabase_admin.storage.from_("Books").upload(
            path=f"uploads/{filename}",
            file=content,
            file_options={"upsert": "true", "content-type": "application/pdf"}
        )
    except Exception as e:
        print(f"Supabase Background Error: {e}")

@router.post("/upload")
async def upload_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    content = await file.read()
    
    # LOGIC: Start Supabase in background so mobile connection 
    # can focus 100% on the text extraction immediately.
    background_tasks.add_task(background_supabase_upload, content, file.filename)

    def stream_pdf_content():
        doc = None
        try:
            doc = fitz.open(stream=content, filetype="pdf")
            total = len(doc)
            for i in range(total):
                page = doc.load_page(i)
                yield json.dumps({
                    "page_index": i + 1,
                    "total_pages": total,
                    "text": page.get_text("text")
                }) + "\n"
                if i % 20 == 0: gc.collect()
        finally:
            if doc: doc.close()
            gc.collect()

    return StreamingResponse(stream_pdf_content(), media_type="application/x-ndjson")