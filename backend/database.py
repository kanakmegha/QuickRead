from supabase import create_client
import os

SUPABASE_URL = os.getenv("SUPABASE_URL")

SUPABASE_ANON_KEY = os.getenv("SUPABASE_PUBLISHABLE_DEFAULT_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL is not set")

if not SUPABASE_ANON_KEY:
    raise RuntimeError("SUPABASE_PUBLISHABLE_DEFAULT_KEY is not set")

if not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is not set")

# 🔐 Client for storage (safe for uploads)
supabase_storage = create_client(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
)

# 🔥 Admin client for DB writes
supabase_admin = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
)
