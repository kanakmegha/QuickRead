from fastapi import APIRouter, UploadFile, File
import fitz  # PyMuPDF
import json
import gc

# THIS LINE IS MISSING:
router = APIRouter()

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    content = await file.read()
    
    def stream_fast():
        # Open the PDF directly from memory
        doc = fitz.open(stream=content, filetype="pdf")
        total_pages = len(doc)
        
        for i in range(total_pages):
            page = doc.load_page(i) # Load page
            text = page.get_text()  # Extract text (Lightning fast!)
            
            yield json.dumps({
                "page_index": i + 1,
                "total_pages": total_pages,
                "text": text
            }) + "\n"
            
            # PyMuPDF is very clean with memory, but we'll help it
            if i % 50 == 0:
                gc.collect()
        
        doc.close()

    return StreamingResponse(stream_fast(), media_type="application/x-ndjson")