import os
import uuid
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from r2_client import s3, BUCKET

app = FastAPI()

# ----------------------------
# CORS（本番 + ローカル）
# ----------------------------
# 例:
#   ALLOW_ORIGINS="http://localhost:5173,https://docport.pages.dev"
ALLOW_ORIGINS = os.getenv("ALLOW_ORIGINS", "http://localhost:5173").split(",")

# docport.pages.dev の preview URL も許可したい場合は正規表現で許可
# 例: https://24exxxx.docport.pages.dev など
ALLOW_ORIGIN_REGEX = os.getenv(
    "ALLOW_ORIGIN_REGEX",
    r"^https:\/\/([a-z0-9-]+\.)?docport\.pages\.dev$"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOW_ORIGINS if o.strip()],
    allow_origin_regex=ALLOW_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health():
    return {"status": "ok"}

# ----------------------------
# API: /api で受ける（本番用）
# 互換のため /presign-* も残す
# ----------------------------

def _presign_upload():
    if not BUCKET:
        raise RuntimeError("R2_BUCKET_NAME is missing")
    key = f"documents/{uuid.uuid4()}.pdf"
    url = s3.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": BUCKET,
            "Key": key,
            "ContentType": "application/pdf",
        },
        ExpiresIn=60 * 5,
    )
    return {"upload_url": url, "file_key": key}

def _presign_download(key: str):
    if not BUCKET:
        raise RuntimeError("R2_BUCKET_NAME is missing")
    url = s3.generate_presigned_url(
        ClientMethod="get_object",
        Params={"Bucket": BUCKET, "Key": key},
        ExpiresIn=60 * 5,
    )
    return {"download_url": url}

# 本番でフロントが叩く想定のパス
@app.post("/api/presign-upload")
def presign_upload_api():
    return _presign_upload()

@app.get("/api/presign-download")
def presign_download_api(key: str):
    return _presign_download(key)

# 既存互換（ローカルで使ってたなら残す）
@app.post("/presign-upload")
def presign_upload_compat():
    return _presign_upload()

@app.get("/presign-download")
def presign_download_compat(key: str):
    return _presign_download(key)