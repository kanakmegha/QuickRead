from fastapi import APIRouter, UploadFile, File
from fastapi.responses import StreamingResponse
import fitz  # PyMuPDF
import json
import asyncio

# This is the line the error is looking for!
router = APIRouter(prefix="/pdf", tags=["pdf"])

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    async def stream_pdf_content():
        content = await file.read()
        doc = fitz.open(stream=content, filetype="pdf")
        
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text = page.get_text()
            
            yield json.dumps({
                "page": page_num + 1, 
                "text": text, 
                "total_pages": len(doc)
            }) + "\n"
            await asyncio.sleep(0.01)

    return StreamingResponse(stream_pdf_content(), media_type="application/x-ndjson")