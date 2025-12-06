from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import supabase

router = APIRouter()

class AuthRequest(BaseModel):
    email: str
    password: str


@router.post("/signup")
def signup(user: AuthRequest):
    auth = supabase.auth.sign_up({
        "email": user.email,
        "password": user.password
    })

    if auth.get("error"):
        raise HTTPException(status_code=400, detail=str(auth["error"]))

    return {"message": "Signup success. Please check email to confirm account."}


@router.post("/login")
def login(user: AuthRequest):
    auth = supabase.auth.sign_in_with_password({
        "email": user.email,
        "password": user.password
    })

    if auth.get("error"):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {"token": auth["session"]["access_token"]}
