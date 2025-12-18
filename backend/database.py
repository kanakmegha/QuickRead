import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
# Use the SERVICE_ROLE_KEY for the admin client
# This allows the backend to upload files and manage the DB without RLS restrictions
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") 

if not url or not key:
    raise ValueError("Supabase URL or Service Role Key is missing from environment variables")

# We name this 'supabase_admin' so it matches the import in pdf.py
supabase_admin: Client = create_client(url, key)

# (Optional) If you also use the 'supabase' name elsewhere, you can keep it:
supabase = supabase_admin