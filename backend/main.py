from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.pdf import router as pdf_router
from routes.auth import router as auth_router
import logging

logging.basicConfig(level=logging.INFO)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://quick-read-five.vercel.app",
        "http://localhost:3000",
        "http://localhost:80"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pdf_router, tags=["pdf"])
app.include_router(auth_router, prefix="/auth", tags=["auth"])

@app.get("/")
def home():
    return {"status": "Backend is running 🚀"}

@app.get("/health")
def health():
    return {"status": "ok"}