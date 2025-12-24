import fitz  # PyMuPDF
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import json
import asyncio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    async def stream_pdf_content():
        # Read file into memory
        content = await file.read()
        doc = fitz.open(stream=content, filetype="pdf")
        
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text = page.get_text()
            
            # Send each page as a JSON chunk
            yield json.dumps({
                "page": page_num + 1,
                "text": text,
                "total_pages": len(doc)
            }) + "\n"
            
            # Tiny sleep to ensure the stream stays open and smooth
            await asyncio.sleep(0.01)

    return StreamingResponse(stream_pdf_content(), media_type="application/x-ndjson")