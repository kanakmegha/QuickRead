# backend/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from routes.pdf import router as pdf_router
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost",
        "http://127.0.0.1",
        "https://quickread-frontend.vercel.app",  # Your Vercel domain
        "https://*.vercel.app",  # All Vercel domains
        os.getenv("FRONTEND_URL", "http://localhost:3000")  # Environment variable for frontend URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the PDF router
app.include_router(pdf_router, prefix="", tags=["pdf"])

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