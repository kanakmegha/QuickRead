# backend/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from routes.pdf import router as pdf_router
import logging
import os
from routes.auth import router as auth_router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://quick-read-five.vercel.app","https://localhost:80/"],  # allow all origins (for dev)
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Include the PDF router
app.include_router(pdf_router, prefix="", tags=["pdf"])
app.include_router(auth_router, prefix="/auth", tags=["auth"])

@app.get("/")
def home():
    return {"status": "Backend is running 🚀"}
@app.get("/health")
def health_check():
	logger.info("Health check requested")
	return {"status": "ok"}

@app.get("/debug")
def debug_info():
	logger.info("Debug info requested")
	return {
		"status": "ok",
		"env_vars": list(os.environ.keys()),
		"supabase_connect": True  # Placeholder for Supabase check
	}