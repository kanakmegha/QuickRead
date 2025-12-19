from fastapi import APIRouter, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
import fitz
import json
import gc
from database import supabase_admin

router = APIRouter()

# Logic: Totally separate the Supabase work from the Phone's work
def upload_to_supabase_logic(content, filename):
    try:
        supabase_admin.storage.from_("Books").upload(
            path=f"uploads/{filename}",
            file=content,
            file_options={"upsert": "true"}
        )
    except:
        pass

@router.post("/upload")
async def upload_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    # 1. Read the file
    content = await file.read()
    
    # 2. Push Supabase to the background IMMEDIATELY
    background_tasks.add_task(upload_to_supabase_logic, content, file.filename)

    def stream_pdf_content():
        doc = None
        try:
            # 3. Open PDF instantly
            doc = fitz.open(stream=content, filetype="pdf")
            total = len(doc)
            
            for i in range(total):
                page = doc.load_page(i)
                text = page.get_text("text")
                
                # 4. Use "ndjson" format - send line by line
                data = json.dumps({
                    "page_index": i + 1,
                    "total_pages": total,
                    "text": text
                }) + "\n"
                
                yield data
                
                # Cleanup every few pages to save Render RAM
                if i % 5 == 0:
                    gc.collect()
                    
        except Exception as e:
            yield json.dumps({"error": str(e)}) + "\n"
        finally:
            if doc: doc.close()
            gc.collect()

    # 5. Critical Headers for Mobile Stability
    return StreamingResponse(
        stream_pdf_content(),
        media_type="application/x-ndjson",
        headers={
            "Connection": "keep-alive",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Tells Render not to buffer
        }
    )