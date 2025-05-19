# backend/routes/summary.py
from fastapi import APIRouter, HTTPException
from transformers import pipeline
import spacy
import logging

router = APIRouter()
logger = logging.getLogger(__name__)
summarizer = pipeline("summarization")
nlp = spacy.load("en_core_web_sm")

@router.post("/summarize")
async def summarize_text(data: dict):
    try:
        text = data.get("text", "")
        if not text:
            raise HTTPException(status_code=400, detail="No text provided")
        
        # Summarize
        summary = summarizer(text[:1000], max_length=200, min_length=50)[0]["summary_text"]
        logger.info(f"Raw summary: {summary}")
        
        # Extract entities
        doc = nlp(summary)
        entities = [{"text": ent.text, "label": ent.label_} for ent in doc.ents]
        
        # Generate mindmap structure (simplified)
        mindmap = {
            "nodes": [{"id": "Summary", "text": summary}],
            "edges": [{"from": "Summary", "to": ent["text"]} for ent in entities]
        }
        
        return {"summary": summary, "entities": entities, "mindmap": mindmap}
    except Exception as e:
        logger.error(f"[SUMMARY ERROR] Failed to summarize: {e}")
        raise HTTPException(status_code=500, detail="Failed to summarize")