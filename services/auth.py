import os
import json
import firebase_admin
from firebase_admin import credentials, auth
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

load_dotenv()

# Initialize Firebase Admin SDK
# If FIREBASE_SERVICE_ACCOUNT env var is set, use it. 
# Otherwise, it might be running in an environment with default credentials or we skip init if already done.
if not firebase_admin._apps:
    service_account_info = os.getenv("FIREBASE_SERVICE_ACCOUNT")
    if service_account_info:
        try:
            cert_dict = json.loads(service_account_info)
            cred = credentials.Certificate(cert_dict)
            firebase_admin.initialize_app(cred)
        except Exception as e:
            print(f"Failed to initialize Firebase with service account: {e}")
            # Fallback for local testing if needed, or just initialize default
            firebase_admin.initialize_app()
    else:
        # Try default credentials or just initialize (for local if configured via CLI)
        try:
            firebase_admin.initialize_app()
        except:
            print("Firebase Admin could not be initialized. Security will fail.")

security = HTTPBearer(auto_error=False)

async def get_current_user(res: HTTPAuthorizationCredentials = Security(security)):
    """
    FastAPI dependency to verify the Firebase ID Token.
    Returns the decoded token (which contains user info).
    """
    if os.getenv("SKIP_AUTH") == "True" and os.getenv("ENVIRONMENT") != "production":
        return {"uid": "test_user_123", "email": "test@example.com", "name": "Test User", "type": "guest", "admin": True}

    if not res:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = res.credentials
    decoded_token = await verify_token(token)
    if decoded_token:
        return decoded_token

    raise HTTPException(
        status_code=401,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

async def verify_token(token: str):
    """Verify a Firebase ID token and return decoded claims, or None."""
    try:
        return auth.verify_id_token(token, check_revoked=True)
    except Exception:
        return None

def require_admin(user: dict = Depends(get_current_user)):
    """
    Optional dependency to check for admin claims or specific user IDs.
    """
    if not user.get('admin'):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
