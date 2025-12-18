from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import supabase

router = APIRouter(prefix="/auth", tags=["auth"])


# -------------------------
# Models
# -------------------------
class AuthRequest(BaseModel):
    email: str
    password: str


# -------------------------
# Routes
# -------------------------
@router.post("/signup")
def signup(user: AuthRequest):
    try:
        response = supabase.auth.sign_up({
            "email": user.email,
            "password": user.password
        })

        if response.user is None:
            raise HTTPException(
                status_code=400,
                detail="Signup failed"
            )

        return {
            "message": "Signup successful. Please verify your email."
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login")
def login(user: AuthRequest):
    try:
        response = supabase.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password
        })

        if response.session is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )

        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token,
            "user": response.user.email
        }

    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/health")
def auth_health():
    return {"status": "auth service running"}
