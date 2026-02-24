# 変更点（v1.6 presign認可追加）:
# 1. presign-upload/download 全4エンドポイントに Supabase JWT 検証を追加
# 2. presign-download は documents.file_key で hospital_id 一致チェック（RLS + FastAPI 二重防御）
# 3. 新規環境変数: SUPABASE_URL / SUPABASE_ANON_KEY（Supabase REST API 呼び出し用）
# 4. GET /health エンドポイント追加（Render ウォームアップ用）

import io
import json
import os
import urllib.error
import urllib.parse
import urllib.request
import uuid

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
# Supabase REST API 呼び出し用（user JWT を渡すため RLS が有効に機能する）
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

_bearer = HTTPBearer()


def verify_jwt(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    """
    Supabase JWT（HS256）を検証する。
    SUPABASE_JWT_SECRET は Supabase Dashboard > Settings > API の JWT Secret。
    FastAPI 内部の依存注入で同一リクエスト内は _bearer の結果がキャッシュされる。
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
# Supabase REST API ヘルパー
# ----------------------------
def _supabase_get(path: str, jwt_token: str) -> list:
    """
    user JWT を使って Supabase REST API を GET する（RLS が有効に機能する）。
    service_role キーは使わない。
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(
            status_code=500,
            detail="SUPABASE_URL / SUPABASE_ANON_KEY が未設定です",
        )
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{path}"
    req = urllib.request.Request(
        url,
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {jwt_token}",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Supabase API エラー: {e.code}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Supabase 接続エラー: {e}")


def _get_hospital_id(user_id: str, jwt_token: str) -> str:
    """profiles テーブルから呼び出し元ユーザーの hospital_id を取得する"""
    uid_encoded = urllib.parse.quote(user_id, safe="")
    rows = _supabase_get(
        f"profiles?id=eq.{uid_encoded}&select=hospital_id",
        jwt_token,
    )
    if not rows or not rows[0].get("hospital_id"):
        raise HTTPException(
            status_code=403,
            detail="プロフィールが見つかりません（hospital_id 未設定）",
        )
    return rows[0]["hospital_id"]


def _assert_download_access(file_key: str, hospital_id: str, jwt_token: str) -> None:
    """
    documents テーブルを user JWT で照会し、
    from_hospital_id OR to_hospital_id がユーザーの病院と一致するか確認する。
    RLS でも弾かれるが、FastAPI 側でも明示チェック（二重防御）。
    """
    # パストラバーサル防止（基本バリデーション）
    if not file_key.startswith("documents/") or not file_key.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="無効な file_key です")

    key_encoded = urllib.parse.quote(file_key, safe="")
    rows = _supabase_get(
        f"documents?file_key=eq.{key_encoded}&select=from_hospital_id,to_hospital_id",
        jwt_token,
    )

    # RLS で弾かれた場合も rows が空になるため、存在有無を区別しない（情報漏洩防止）
    if not rows:
        raise HTTPException(status_code=403, detail="ドキュメントへのアクセス権がありません")

    doc = rows[0]
    if (
        doc.get("from_hospital_id") != hospital_id
        and doc.get("to_hospital_id") != hospital_id
    ):
        raise HTTPException(status_code=403, detail="ドキュメントへのアクセス権がありません")


# ----------------------------
# ヘルスチェック
# ----------------------------
@app.get("/")
def health_root():
    return {"status": "ok"}


@app.get("/health")
def health():
    """Render ウォームアップ用（認証不要）"""
    return {"status": "ok"}


# ----------------------------
# Presign 内部ヘルパー
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
# Presign エンドポイント（JWT 認可追加）
# ----------------------------
@app.post("/api/presign-upload")
def presign_upload_api(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    user: dict = Depends(verify_jwt),
):
    """ログイン済みユーザーのみ署名 URL を発行（JWT 必須）"""
    return _presign_upload()


@app.get("/api/presign-download")
def presign_download_api(
    key: str,
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    user: dict = Depends(verify_jwt),
):
    """JWT 検証 + documents の hospital_id チェック後に署名 URL を発行"""
    jwt_token = credentials.credentials
    user_id = user.get("sub", "")
    hospital_id = _get_hospital_id(user_id, jwt_token)
    _assert_download_access(key, hospital_id, jwt_token)
    return _presign_download(key)


@app.post("/presign-upload")
def presign_upload_compat(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    user: dict = Depends(verify_jwt),
):
    """compat: Vite proxy 経由のローカル開発用（同じ認可）"""
    return _presign_upload()


@app.get("/presign-download")
def presign_download_compat(
    key: str,
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    user: dict = Depends(verify_jwt),
):
    """compat: Vite proxy 経由のローカル開発用（同じ認可）"""
    jwt_token = credentials.credentials
    user_id = user.get("sub", "")
    hospital_id = _get_hospital_id(user_id, jwt_token)
    _assert_download_access(key, hospital_id, jwt_token)
    return _presign_download(key)


# ----------------------------
# OCR API（v1.5 変更なし）
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
