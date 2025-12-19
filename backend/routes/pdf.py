import io, gc, logging, pdfplumber
from fastapi import APIRouter, UploadFile, File, HTTPException
from database import supabase_admin

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF allowed")

    try:
        # Read file into memory
        content = await file.read()
        
        extracted_pages = []
        
        # Open PDF and extract text as fast as possible
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                extracted_pages.append(text if text else "")
                # Critical: help the garbage collector
                page.flush_cache() 
        
        # Manually clear the 'content' from RAM now that we have the text
        del content
        gc.collect()

        # Return a standard JSON response (not a stream)
        # Standard JSON is much more "Mobile Stable"
        return {
            "success": True,
            "pages": extracted_pages,
            "total": len(extracted_pages)
        }

    except Exception as e:
        logger.error(f"Extraction Error: {e}")
        raise HTTPException(status_code=500, detail="Server busy or PDF too complex")
    finally:
        gc.collect()