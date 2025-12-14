""" from fastapi import APIRouter, HTTPException
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
 """
 # db.py (or auth.py)
import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

# Load DB URL from .env
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise Exception("DATABASE_URL not found in environment variables!")

def get_connection():
    try:
        conn = psycopg2.connect(DATABASE_URL, sslmode="require")
        return conn
    except Exception as e:
        print("❌ Database Connection Error:", e)
        return None

def execute(query, params=None):
    conn = get_connection()
    if not conn:
        return None

    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(query, params)
        if query.strip().lower().startswith("select"):
            result = cur.fetchall()
        else:
            result = {"status": "success"}
        conn.commit()
        print("📌 Query Executed:", result)
        return result
    except Exception as e:
        print("⚠️ Query Error:", e)
        return None
    finally:
        cur.close()
        conn.close()
