from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.pdf import router as pdf_router
from routes.auth import router as auth_router
import logging

logging.basicConfig(level=logging.INFO)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # This allows ALL Vercel preview URLs to work
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from auth_router import router as auth_router  # your previous auth code
from upload_router import router as upload_router  # this file

app.include_router(auth_router)
app.include_router(upload_router)
@app.get("/")
def home():
    return {"status": "Backend is running 🚀"}
@app.options("/{path:path}")
async def preflight_handler(path: str):
    return Response(status_code=status.HTTP_200_OK)
@app.get("/health")
def health():
    return {"status": "ok"}
