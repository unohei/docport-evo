# 変更点（v1.5 OCR追加）:
# 1. POST /api/ocr を新設（JWT検証 → R2 Presign → PDF取得 → テキスト抽出）
# 2. PyJWT で Supabase JWT（HS256）を検証
# 3. pypdf でPDFテキスト抽出（画像PDFは warnings で通知）
# 4. 既存エンドポイントへの変更なし

import io
import os
import uuid
import urllib.request

import jwt
from pypdf import PdfReader

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from r2_client import get_bucket_name, get_s3_client

app = FastAPI()

# ----------------------------
# CORS（本番 + ローカル）
# ----------------------------
ALLOW_ORIGINS = os.getenv("ALLOW_ORIGINS", "http://localhost:5173").split(",")
ALLOW_ORIGIN_REGEX = os.getenv(
    "ALLOW_ORIGIN_REGEX",
    r"^https:\/\/([a-z0-9-]+\.)?docport\.pages\.dev$",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOW_ORIGINS if o.strip()],
    allow_origin_regex=ALLOW_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------------
# JWT 検証ヘルパー
# ----------------------------
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
_bearer = HTTPBearer()


def verify_jwt(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    """
    Supabase JWT（HS256）を検証する。
    SUPABASE_JWT_SECRET は Supabase Dashboard > Settings > API の JWT Secret。
    """
    if not SUPABASE_JWT_SECRET:
        raise HTTPException(status_code=500, detail="SUPABASE_JWT_SECRET が未設定です")
    try:
        payload = jwt.decode(
            credentials.credentials,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="トークンの有効期限が切れています")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="無効なトークンです")


# ----------------------------
# ヘルスチェック
# ----------------------------
@app.get("/")
def health():
    return {"status": "ok"}


# ----------------------------
# Presign ヘルパー（既存共通処理）
# ----------------------------
def _presign_upload():
    try:
        bucket = get_bucket_name()
        s3 = get_s3_client()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    key = f"documents/{uuid.uuid4()}.pdf"
    url = s3.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": bucket,
            "Key": key,
            "ContentType": "application/pdf",
        },
        ExpiresIn=60 * 5,
    )
    return {"upload_url": url, "file_key": key}


def _presign_download(key: str):
    try:
        bucket = get_bucket_name()
        s3 = get_s3_client()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    url = s3.generate_presigned_url(
        ClientMethod="get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=60 * 5,
    )
    return {"download_url": url}


# ----------------------------
# 既存エンドポイント（変更なし）
# ----------------------------
@app.post("/api/presign-upload")
def presign_upload_api():
    return _presign_upload()


@app.get("/api/presign-download")
def presign_download_api(key: str):
    return _presign_download(key)


@app.post("/presign-upload")
def presign_upload_compat():
    return _presign_upload()


@app.get("/presign-download")
def presign_download_compat(key: str):
    return _presign_download(key)


# ----------------------------
# OCR API（v1.5 新規追加）
# ----------------------------
class OcrRequest(BaseModel):
    file_key: str


# 要配慮情報の注意喚起キーワード（断定ではなく可能性の通知のみ）
_SENSITIVE_KEYWORDS = [
    "病名", "診断", "障害", "検査結果", "投薬", "処方",
    "手術", "入院", "HIV", "感染症", "精神", "がん",
]


@app.post("/api/ocr")
def ocr_pdf(body: OcrRequest, user: dict = Depends(verify_jwt)):
    """
    POST /api/ocr
    送信前PDFのテキスト抽出API。AIの判断で送信確定はしない。

    - JWT検証済みユーザーのみ利用可
    - R2からPresigned GETでPDFを一時取得
    - pypdf でテキストレイヤーを抽出（画像PDFは warnings で通知）
    - 返却: { text, meta, warnings }
    """
    # file_key バリデーション（パストラバーサル防止）
    if not body.file_key.startswith("documents/") or not body.file_key.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="無効な file_key です")

    # Presigned GET URL を生成（有効期限60秒: OCR処理分のみ）
    try:
        bucket = get_bucket_name()
        s3 = get_s3_client()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    presigned_url = s3.generate_presigned_url(
        ClientMethod="get_object",
        Params={"Bucket": bucket, "Key": body.file_key},
        ExpiresIn=60,
    )

    # R2 から PDF を取得
    try:
        with urllib.request.urlopen(presigned_url) as resp:
            pdf_bytes = resp.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF取得失敗: {e}")

    # テキスト抽出（pypdf: テキストレイヤーのみ対応）
    text = ""
    page_count = 0
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        page_count = len(reader.pages)
        text = "\n".join(
            page.extract_text() or "" for page in reader.pages
        ).strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR処理失敗: {e}")

    # メタ情報（MVP最小構成）
    meta = {
        "page_count": page_count,
        "char_count": len(text),
        "file_key": body.file_key,
    }

    # 警告生成
    warnings = []
    if not text:
        warnings.append(
            "テキストを抽出できませんでした。スキャンPDF（画像PDF）の可能性があります。"
            "内容をご確認の上、送信可否を判断してください。"
        )
    else:
        found = [kw for kw in _SENSITIVE_KEYWORDS if kw in text]
        if found:
            warnings.append(
                f"要配慮情報の可能性があります：{', '.join(found)} 等のキーワードが含まれています。"
                "送信前に内容をご確認ください。"
            )

    return {"text": text, "meta": meta, "warnings": warnings}
