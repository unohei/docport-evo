# 変更点（v1.8 JWT検証をES256/JWKSに対応）:
# 1. PyJWT(HS256) を廃止し python-jose で JWKS から公開鍵取得・ES256 検証に切り替え
# 2. SUPABASE_JWT_SECRET は不要になった（環境変数から削除可）
# 3. JWKS は1時間キャッシュし、kid 不一致時は強制再取得（key rotation 対応）
# ---- 以下は前バージョンからの継続 ----
# presign-upload/download 全4エンドポイントに Supabase JWT 検証を追加
# presign-download は documents.file_key で hospital_id 一致チェック（RLS + FastAPI 二重防御）
# CORS は allow_origin_regex のみで制御（allow_origins は使用しない）

import io
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

from jose import jwt as jose_jwt
from jose.exceptions import ExpiredSignatureError, JWTClaimsError, JWTError
from pypdf import PdfReader

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from r2_client import get_bucket_name, get_s3_client

app = FastAPI()

# ----------------------------
# CORS（本番 + ローカル）
# allow_origins は使用しない。allow_origin_regex のみで制御する。
# デフォルト: docport.pages.dev / docport-evo.pages.dev / localhost:5173
# ----------------------------
_DEFAULT_ORIGIN_REGEX = (
    r"^("
    r"https://docport\.pages\.dev"
    r"|https://docport-evo\.pages\.dev"
    r"|http://localhost:5173"
    r")$"
)
ALLOW_ORIGIN_REGEX = os.getenv("ALLOW_ORIGIN_REGEX", _DEFAULT_ORIGIN_REGEX)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],           # allow_origin_regex に一本化するため空にする
    allow_origin_regex=ALLOW_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------------
# Supabase 設定
# ----------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL", "")        # 例: https://xxxx.supabase.co
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

_bearer = HTTPBearer()


# ----------------------------
# JWKS キャッシュ（TTL: 1時間）
# ----------------------------
_jwks_keys: dict = {}     # kid -> JWK dict
_jwks_fetched_at: float = 0.0
_JWKS_CACHE_TTL = 3600    # seconds


def _refresh_jwks() -> None:
    """
    Supabase の JWKS エンドポイントから公開鍵を取得してモジュール変数に格納する。
    urllib のみ使用（新規ライブラリ不要）。
    """
    global _jwks_keys, _jwks_fetched_at
    if not SUPABASE_URL:
        raise HTTPException(status_code=500, detail="SUPABASE_URL が未設定です")
    url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"JWKS 取得失敗: {e.code}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"JWKS 取得エラー: {e}")

    _jwks_keys = {k["kid"]: k for k in data.get("keys", []) if "kid" in k}
    _jwks_fetched_at = time.time()


def _get_signing_key(kid: str) -> dict:
    """
    kid に対応する JWK dict を返す（TTL キャッシュ付き）。
    キャッシュにない場合は強制再取得（key rotation 対応）。
    """
    global _jwks_keys, _jwks_fetched_at

    # TTL 切れなら再取得
    if time.time() - _jwks_fetched_at > _JWKS_CACHE_TTL:
        _refresh_jwks()

    if kid in _jwks_keys:
        return _jwks_keys[kid]

    # キャッシュにない → key rotation の可能性があるので強制再取得
    _refresh_jwks()
    if kid not in _jwks_keys:
        raise HTTPException(
            status_code=401,
            detail="対応する公開鍵が見つかりません（kid 不一致）",
        )
    return _jwks_keys[kid]


# ----------------------------
# JWT 検証ヘルパー（ES256/JWKS）
# ----------------------------
def verify_jwt(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    """
    Supabase JWT（ES256）を JWKS 経由で検証する。
    - kid から公開鍵を取得（TTL キャッシュ付き）
    - audience: authenticated
    - issuer: https://<SUPABASE_URL>/auth/v1
    FastAPI の依存注入で同一リクエスト内は _bearer の結果がキャッシュされる。
    """
    token = credentials.credentials

    # ヘッダーから kid / alg を取得（未検証）
    try:
        header = jose_jwt.get_unverified_header(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="無効なトークンです（ヘッダー解析失敗）")

    kid = header.get("kid")
    alg = header.get("alg", "ES256")

    if not kid:
        raise HTTPException(status_code=401, detail="JWT に kid がありません")

    jwk_key = _get_signing_key(kid)
    issuer = f"{SUPABASE_URL.rstrip('/')}/auth/v1"

    try:
        # python-jose は {"keys": [...]} 形式の JWKS dict を直接受け取れる
        payload = jose_jwt.decode(
            token,
            {"keys": [jwk_key]},
            algorithms=[alg],
            audience="authenticated",
            issuer=issuer,
        )
        return payload
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="トークンの有効期限が切れています")
    except JWTClaimsError as e:
        raise HTTPException(status_code=401, detail=f"トークンのクレームが無効です: {e}")
    except JWTError:
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
# Presign エンドポイント（JWT 認可）
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


@app.post("/ocr")
def ocr_compat(body: OcrRequest, user: dict = Depends(verify_jwt)):
    """compat: Vite proxy 経由のローカル開発用（/api/ocr と同じ処理）"""
    return ocr_pdf(body, user)


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
