@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    content = await file.read()
    
    def stream_pdf_content():
        doc = None
        try:
            # IMMEDIATELY open the PDF
            doc = fitz.open(stream=content, filetype="pdf")
            total_pages = len(doc)
            
            # STEP 1: Stream the first page immediately so the Phone doesn't time out
            for i in range(total_pages):
                page = doc.load_page(i)
                text = page.get_text("text")
                
                yield json.dumps({
                    "page_index": i + 1,
                    "total_pages": total_pages,
                    "text": text
                }) + "\n"
                
                # STEP 2: On the very first page, trigger the Supabase save 
                # but don't let it stop the loop!
                if i == 0:
                    try:
                        storage_path = f"uploads/{file.filename}"
                        # We do this quickly or as a background task
                        supabase_admin.storage.from_(BUCKET_NAME).upload(
                            storage_path, content, {"content-type": "application/pdf", "upsert": "true"}
                        )
                    except: pass 

                if i % 20 == 0: gc.collect()
        finally:
            if doc: doc.close()
            gc.collect()

    return StreamingResponse(stream_pdf_content(), media_type="application/x-ndjson")