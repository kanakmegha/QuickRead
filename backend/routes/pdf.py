from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
import fitz
import json
import gc
from database import supabase_admin

router = APIRouter()

# Helper function to save to Supabase in the background
def save_to_supabase(content, filename):
    try:
        supabase_admin.storage.from_("Books").upload(
            path=f"uploads/{filename}",
            file=content,
            file_options={"content-type": "application/pdf", "upsert": "true"}
        )
    except Exception as e:
        print(f"Background Upload Error: {e}")

@router.post("/upload")
async def upload_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    content = await file.read()
    
    # 1. Start the Supabase save in the background (Doesn't block the stream!)
    background_tasks.add_task(save_to_supabase, content, file.filename)

    def stream_pdf_content():
        doc = None
        try:
            doc = fitz.open(stream=content, filetype="pdf")
            total = len(doc)
            
            for i in range(total):
                page = doc.load_page(i)
                text = page.get_text("text")
                
                # 2. Yield data IMMEDIATELY to keep the mobile connection alive
                yield json.dumps({
                    "page_index": i + 1,
                    "total_pages": total,
                    "text": text
                }) + "\n"
                
                if i % 10 == 0:
                    gc.collect()
        finally:
            if doc: doc.close()
            gc.collect()

    # 3. Add a specialized header to tell mobile browsers NOT to buffer
    return StreamingResponse(
        stream_pdf_content(), 
        media_type="application/x-ndjson",
        headers={"X-Accel-Buffering": "no"} 
    )