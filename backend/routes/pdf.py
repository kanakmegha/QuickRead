# backend/routes/pdf.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from pdfplumber import open as pdf_open
import logging
import os
import re

router = APIRouter()
logger = logging.getLogger(__name__)

def process_page(page):
	text = page.extract_text() or ""
	lines = text.split('\n')
	processed_lines = []
	
	for line in lines:
		line = line.strip()
		if len(line) <= 20 or line.isdigit():
			continue
		line = re.sub(r'[~\|\\\{\}\[\]\^_\*`]', '', line)
		line = re.sub(r'\s+', ' ', line)
		line = re.sub(r'[\u0000-\u001F\u007F-\u009F]', '', line)
		if line:
			processed_lines.append(line)
	
	return ' '.join(processed_lines)

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
	file_path = f"temp/{file.filename}"
	try:
		if not file.filename.endswith(".pdf"):
			logger.error("Invalid file type")
			raise HTTPException(status_code=400, detail="Only PDF files are allowed")
		
		# Save file temporarily
		os.makedirs(os.path.dirname(file_path), exist_ok=True)
		with open(file_path, "wb") as f:
			f.write(await file.read())
		
		# Extract text sequentially (reliable across platforms)
		with pdf_open(file_path) as pdf:
			texts = []
			for idx, page in enumerate(pdf.pages):
				try:
					texts.append(process_page(page))
				except Exception as e:
					logger.warning(f"Failed to process page {idx}: {e}")
			text = ' '.join(texts)
			text = ' '.join(text.split())
		
		logger.info(f"Extracted text (first 500 chars): {text[:500]}")
		return {"text": text}
	except HTTPException:
		raise
	except Exception as e:
		logger.error(f"[PDF ERROR] Failed to process PDF: {e}")
		raise HTTPException(status_code=500, detail="Failed to process PDF")
	finally:
		# Clean up temporary file
		if os.path.exists(file_path):
			os.remove(file_path)