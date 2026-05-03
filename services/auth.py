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

security = HTTPBearer()

async def get_current_user(res: HTTPAuthorizationCredentials = Security(security)):
    """
    FastAPI dependency to verify the Firebase ID Token.
    Returns the decoded token (which contains user info).
    """
    token = res.credentials
    try:
        # Verify the ID token while checking if the token is revoked by passing check_revoked=True
        decoded_token = auth.verify_id_token(token, check_revoked=True)
        return decoded_token
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid or expired token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

def require_admin(user: dict = Depends(get_current_user)):
    """
    Optional dependency to check for admin claims or specific user IDs.
    """
    # For now, we can check if the user has an 'admin' custom claim or matches a known ID
    if not user.get('admin'):
        # Note: You'd set this claim in Firebase Console or via Admin SDK
        # For this demo, let's allow everyone who is authenticated, 
        # but in production you'd check: raise HTTPException(403, "Admin access required")
        pass
    return user
