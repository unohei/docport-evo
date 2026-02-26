# 変更点（v1.9 OCR を画像OCR専用に刷新）:
# 1. pypdf を撤廃し pypdfium2 でPDFをページ画像化（最大3ページ、10MB上限）
# 2. OCR は Gemini（優先）または OpenAI Vision API を使用（どちらも未設定なら500）
# 3. /api/ocr も presign-download 同様に documents テーブルで hospital_id アクセス権チェックを実施
#
# 変更点（v2.0 OCRテキストの構造化JSON生成を追加）:
# 1. _structure_referral_text: OCR済みテキストを gpt-4o で医療紹介状の構造化JSONへ変換
# 2. /api/ocr のレスポンスに structured フィールドを追加（失敗時は null、OCR全体は落とさない）
# 3. 既存のVision OCR処理・認証ロジックは一切変更なし

import base64
import io
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

import pypdfium2 as pdfium
from jose import jwt as jose_jwt
from jose.exceptions import ExpiredSignatureError, JWTClaimsError, JWTError

from fastapi import Body, Depends, FastAPI, HTTPException
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
# アップロード許可 MIME マップ（許可リスト方式・単一の真実）
# フロント → FastAPI に content_type を渡し、ここで検証してから presign を発行する。
# 拡張子だけに依存せず MIME で判定する（二重防御の最終判断はここ）
# ----------------------------
ALLOWED_MIME_EXT: dict[str, str] = {
    "application/pdf":                                                              "pdf",
    "image/png":                                                                    "png",
    "image/jpeg":                                                                   "jpg",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":      "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":            "xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":    "pptx",
}


class PresignUploadRequest(BaseModel):
    content_type: str = "application/pdf"   # MIME タイプ（未送信時は PDF）
    filename: str = ""                      # オリジナルファイル名（ログ用）


# ----------------------------
# Presign 内部ヘルパー
# ----------------------------
def _presign_upload(content_type: str = "application/pdf") -> dict:
    # MIME 許可リスト検証（拡張子は MIME から決定する）
    if content_type not in ALLOWED_MIME_EXT:
        raise HTTPException(
            status_code=400,
            detail=f"許可されていないファイル形式です: {content_type}。"
                   f"対応形式: {', '.join(ALLOWED_MIME_EXT.keys())}",
        )
    ext = ALLOWED_MIME_EXT[content_type]

    try:
        bucket = get_bucket_name()
        s3 = get_s3_client()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    key = f"documents/{uuid.uuid4()}.{ext}"
    url = s3.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": bucket,
            "Key": key,
            "ContentType": content_type,   # presigned URL に ContentType を含めることで PUT 時の MIME を強制
        },
        ExpiresIn=60 * 10,  # 10分（アップロード操作）
    )
    return {"upload_url": url, "file_key": key, "content_type": content_type, "file_ext": ext}


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
    body: PresignUploadRequest | None = Body(default=None),
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    user: dict = Depends(verify_jwt),
):
    """ログイン済みユーザーのみ署名 URL を発行（JWT 必須）。
    body 未送信（後方互換クライアント）の場合は application/pdf として扱う。"""
    req = body if body is not None else PresignUploadRequest()
    return _presign_upload(req.content_type)


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
    body: PresignUploadRequest | None = Body(default=None),
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    user: dict = Depends(verify_jwt),
):
    """compat: Vite proxy 経由のローカル開発用（同じ認可）"""
    req = body if body is not None else PresignUploadRequest()
    return _presign_upload(req.content_type)


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
# OCR 設定
# ----------------------------
_MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024   # 10MB
_MAX_OCR_PAGES = 3                        # ページ上限
_OCR_TIMEOUT_SECS = 30                    # 処理全体のタイムアウト（秒）

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# 要配慮情報の注意喚起キーワード（断定ではなく可能性の通知のみ）
_SENSITIVE_KEYWORDS = [
    "病名", "診断", "障害", "検査結果", "投薬", "処方",
    "手術", "入院", "HIV", "感染症", "精神", "がん",
]

# アラートキーワード定義（severity: high / medium / low）
# evidence に前後30文字スニペット付きで返す（断定禁止トーン）
_ALERT_KEYWORDS = [
    {"id": "hiv",        "label": "HIV/AIDS",   "severity": "high",   "keywords": ["HIV", "AIDS"]},
    {"id": "mental",     "label": "精神疾患",     "severity": "high",   "keywords": ["精神", "うつ病", "統合失調"]},
    {"id": "cancer",     "label": "悪性腫瘍",     "severity": "high",   "keywords": ["がん", "癌", "腫瘍", "悪性"]},
    {"id": "diagnosis",  "label": "病名・診断",   "severity": "medium", "keywords": ["病名", "診断"]},
    {"id": "test",       "label": "検査結果",     "severity": "medium", "keywords": ["検査結果", "検査値", "検査所見"]},
    {"id": "meds",       "label": "投薬・処方",   "severity": "medium", "keywords": ["投薬", "処方", "処方薬"]},
    {"id": "infect",     "label": "感染症",       "severity": "medium", "keywords": ["感染症", "感染"]},
    {"id": "disability", "label": "障害",         "severity": "medium", "keywords": ["障害"]},
    {"id": "surgery",    "label": "手術",         "severity": "low",    "keywords": ["手術", "術後"]},
    {"id": "admit",      "label": "入院",         "severity": "low",    "keywords": ["入院"]},
]

_OCR_PROMPT = (
    "以下の医療文書の画像に含まれるテキストをすべて正確に抽出してください。"
    "レイアウトをできる限り維持し、文字を漏れなく出力してください。"
)

# ----------------------------
# 構造化 設定
# ----------------------------
_STRUCTURE_TIMEOUT_SECS = 20   # Vision OCR とは別タイムアウト（失敗しても OCR 全体は落とさない）

_STRUCTURE_PROMPT = """\
以下は医療紹介状から抽出したテキストです。
次のJSONフォーマットで情報を抽出してください。
- 不明・記載なしの項目は null にしてください
- テキストに明示されていない情報は推測しないでください
- 余計な説明文や前置きは不要です。JSONのみ出力してください

{
  "patient_name": null,
  "patient_id": null,
  "birth_date": null,
  "referrer_hospital": null,
  "referrer_doctor": null,
  "referral_to_hospital": null,
  "referral_date": null,
  "chief_complaint": null,
  "suspected_diagnosis": null,
  "allergies": null,
  "medications": null
}
"""


# ----------------------------
# OCR 内部ヘルパー
# ----------------------------
def _render_pdf_to_png_list(pdf_bytes: bytes) -> tuple[list[bytes], int]:
    """
    pypdfium2 でPDFをページ画像化する。
    - 最大 _MAX_OCR_PAGES ページまで処理
    - scale=2.0（約144 DPI）でレンダリング（OCR精度向上）
    - 戻り値: (PNG bytes のリスト, 総ページ数)
    """
    pdf = pdfium.PdfDocument(pdf_bytes)
    total_pages = len(pdf)
    pages_to_render = min(total_pages, _MAX_OCR_PAGES)

    png_list: list[bytes] = []
    for i in range(pages_to_render):
        page = pdf[i]
        bitmap = page.render(scale=2.0)
        pil_image = bitmap.to_pil()
        buf = io.BytesIO()
        pil_image.save(buf, format="PNG")
        png_list.append(buf.getvalue())

    return png_list, total_pages


def _call_gemini_ocr(png_list: list[bytes], timeout: float) -> str:
    """
    Gemini Vision API でページ画像をまとめてOCRする。
    全ページを1リクエストで送信してテキストを取得する。
    """
    parts: list[dict] = []
    for png in png_list:
        parts.append({
            "inline_data": {
                "mime_type": "image/png",
                "data": base64.b64encode(png).decode(),
            }
        })
    parts.append({"text": _OCR_PROMPT})

    payload = json.dumps({"contents": [{"parts": parts}]}).encode()
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    )
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=int(timeout)) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        raise HTTPException(status_code=502, detail=f"Gemini API エラー ({e.code}): {body}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini API 接続エラー: {e}")

    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as e:
        raise HTTPException(status_code=502, detail=f"Gemini レスポンス解析失敗: {e}")


def _call_openai_ocr(png_list: list[bytes], timeout: float) -> str:
    """
    OpenAI Vision API（gpt-4o）でページ画像をまとめてOCRする。
    全ページを1リクエストで送信してテキストを取得する。
    """
    content: list[dict] = []
    for png in png_list:
        content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:image/png;base64,{base64.b64encode(png).decode()}"
            },
        })
    content.append({"type": "text", "text": _OCR_PROMPT})

    payload = json.dumps({
        "model": "gpt-4o",
        "messages": [{"role": "user", "content": content}],
        "max_tokens": 4096,
    }).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=int(timeout)) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        raise HTTPException(status_code=502, detail=f"OpenAI API エラー ({e.code}): {body}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OpenAI API 接続エラー: {e}")

    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        raise HTTPException(status_code=502, detail=f"OpenAI レスポンス解析失敗: {e}")


# ----------------------------
# テキスト正規化ヘルパー
# ----------------------------
def _strip_code_fences(text: str) -> str:
    """
    OCR結果がコードフェンス（```...```）で全体を囲まれている場合に本文のみを返す。
    Gemini / OpenAI が Markdown 形式で応答するケースへの対処。
    例: ```plaintext\n本文\n``` → 本文
    部分的なフェンスや複数フェンスは除去しない（全体を囲む1ブロックのみ対象）。
    """
    t = text.strip()
    if not t.startswith("```"):
        return t
    first_newline = t.find("\n")
    if first_newline < 0:
        return t
    if not t.endswith("```"):
        return t
    inner = t[first_newline + 1 : len(t) - 3]
    return inner.strip()


# ----------------------------
# アラート生成ヘルパー
# ----------------------------
def _generate_alerts(text: str) -> list[dict]:
    """
    テキストから要配慮キーワードを検索し、注意喚起リストを返す。
    - 断定禁止：「可能性があります」「確認してください」トーンのみ
    - evidence: キーワード前後30文字のスニペット（最大3件/アラート）
    - フロントエンドでのハイライト表示を前提に keyword フィールドも返す
    """
    alerts: list[dict] = []
    for entry in _ALERT_KEYWORDS:
        evidence: list[dict] = []
        seen: set[int] = set()
        for kw in entry["keywords"]:
            pos = 0
            while len(evidence) < 3:
                idx = text.find(kw, pos)
                if idx < 0:
                    break
                if idx not in seen:
                    seen.add(idx)
                    s = max(0, idx - 30)
                    e = min(len(text), idx + len(kw) + 30)
                    snippet = text[s:e]
                    if s > 0:
                        snippet = "…" + snippet
                    if e < len(text):
                        snippet = snippet + "…"
                    evidence.append({"page": 1, "snippet": snippet, "keyword": kw})
                pos = idx + 1
        if evidence:
            alerts.append({
                "id":       entry["id"],
                "label":    entry["label"],
                "severity": entry["severity"],
                "keyword":  entry["keywords"][0],
                "evidence": evidence,
            })
    return alerts


# ----------------------------
# 構造化 内部ヘルパー
# ----------------------------
def _structure_referral_text(
    text: str,
    timeout: float = _STRUCTURE_TIMEOUT_SECS,
) -> dict | None:
    """
    OCRで抽出したテキストを OpenAI gpt-4o で医療紹介状の構造化JSONに変換する。
    - OPENAI_API_KEY 未設定、text が空、API エラーの場合はすべて None を返す
    - 失敗してもOCRレスポンス全体は落とさない（graceful degradation）
    """
    if not OPENAI_API_KEY or not text.strip():
        return None

    payload = json.dumps({
        "model": "gpt-4o",
        "temperature": 0,
        "messages": [
            {
                "role": "user",
                "content": f"{_STRUCTURE_PROMPT}\nテキスト:\n{text}",
            }
        ],
        "max_tokens": 1024,
    }).encode()

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=int(timeout)) as resp:
            data = json.loads(resp.read())
        raw = data["choices"][0]["message"]["content"].strip()
        # Markdownコードブロック（```json...```）も含め、最初の { ～ 最後の } を抽出してパース
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start < 0 or end <= start:
            return None
        return json.loads(raw[start:end])
    except Exception:
        return None


# ----------------------------
# OCR 実装（/api/ocr と /ocr の共通処理）
# ----------------------------
class OcrRequest(BaseModel):
    file_key: str
    mode: str = "full"  # "full" | "text_only"（text_only は structured をスキップ）


def _ocr_impl(
    body: OcrRequest,
    credentials: HTTPAuthorizationCredentials,
    user: dict,
) -> dict:
    """
    画像OCR実装。
    1. file_key バリデーション
    2. JWT + hospital_id 確認（送信前PDF＝まだ documents 未登録のため DB照合はしない）
    3. R2 から PDF 取得（Presigned GET）+ サイズチェック
    4. pypdfium2 でページ画像化（最大3ページ）
    5. Gemini or OpenAI Vision API で OCR
    6. OpenAI gpt-4o で構造化JSON生成（失敗時は structured=null）
    7. 結果テキスト + メタ + 警告 + 構造化JSON を返す
    """
    start_time = time.time()

    # ---- タイムアウト残時間チェック（内部ヘルパー） ----
    def _remaining() -> float:
        elapsed = time.time() - start_time
        remaining = _OCR_TIMEOUT_SECS - elapsed
        if remaining <= 2.0:
            raise HTTPException(status_code=504, detail="OCR処理がタイムアウトしました")
        return remaining

    # ---- file_key バリデーション（パストラバーサル防止） ----
    if not body.file_key.startswith("documents/") or not body.file_key.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="無効な file_key です")

    # ---- JWT + hospital_id 確認 ----
    # OCR は「送信前」専用のため documents テーブルにまだレコードが存在しない。
    # _assert_download_access（DB照合）は行わず、有効な JWT + hospital_id を持つ
    # ログイン済みユーザーであることのみ確認する。
    jwt_token = credentials.credentials
    user_id = user.get("sub", "")
    _get_hospital_id(user_id, jwt_token)  # hospital_id 未設定ユーザーを弾く

    _remaining()

    # ---- R2 から PDF を取得（Presigned GET、有効期限60秒） ----
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

    try:
        with urllib.request.urlopen(presigned_url, timeout=10) as resp:
            pdf_bytes = resp.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF取得失敗: {e}")

    # ---- サイズチェック ----
    if len(pdf_bytes) > _MAX_PDF_SIZE_BYTES:
        mb = len(pdf_bytes) / 1024 / 1024
        raise HTTPException(
            status_code=400,
            detail=f"PDFサイズが上限（10MB）を超えています（{mb:.1f}MB）",
        )

    _remaining()

    # ---- pypdfium2 でページ画像化 ----
    try:
        png_list, total_pages = _render_pdf_to_png_list(pdf_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF画像化失敗: {e}")

    if not png_list:
        raise HTTPException(status_code=400, detail="PDFにページが含まれていません")

    # ---- APIキー確認 ----
    if not GEMINI_API_KEY and not OPENAI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="APIキーが未設定です（GEMINI_API_KEY または OPENAI_API_KEY を設定してください）",
        )

    remaining = _remaining()

    # ---- OCR 実行（Gemini 優先、なければ OpenAI） ----
    if GEMINI_API_KEY:
        text = _call_gemini_ocr(png_list, timeout=remaining)
    else:
        text = _call_openai_ocr(png_list, timeout=remaining)

    # ---- テキスト正規化（コードフェンス除去） ----
    text = _strip_code_fences(text)

    elapsed_ms = int((time.time() - start_time) * 1000)

    # ---- メタ情報 ----
    meta = {
        "page_count": total_pages,
        "char_count": len(text.strip()),
        "file_key": body.file_key,
        "elapsed_ms": elapsed_ms,
    }

    # ---- 警告生成 ----
    warnings: list[str] = []
    stripped = text.strip()
    if not stripped:
        warnings.append(
            "画像OCRでもテキストを抽出できませんでした。"
            "内容をご確認の上、送信可否を判断してください。"
        )
    else:
        found = [kw for kw in _SENSITIVE_KEYWORDS if kw in stripped]
        if found:
            warnings.append(
                f"要配慮情報の可能性があります：{', '.join(found)} 等のキーワードが含まれています。"
                "送信前に内容をご確認ください。"
            )

    # ---- 構造化JSON生成（mode=full のみ実行。text_only はスキップして null） ----
    structured = (
        None if body.mode == "text_only" else _structure_referral_text(stripped)
    )

    # ---- アラート生成（キーワードマッチ方式、断定禁止） ----
    alerts = _generate_alerts(stripped) if stripped else []

    return {"text": stripped, "meta": meta, "warnings": warnings, "structured": structured, "alerts": alerts}


# ----------------------------
# OCR エンドポイント
# ----------------------------
@app.post("/api/ocr")
def ocr_pdf(
    body: OcrRequest,
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    user: dict = Depends(verify_jwt),
):
    """
    POST /api/ocr
    送信前PDFの画像OCR API。AIの判断で送信確定はしない。

    - JWT検証済みユーザーのみ利用可
    - documents テーブルで hospital_id アクセス権チェック（RLS + FastAPI 二重防御）
    - R2 から Presigned GET でPDF取得（10MB上限）
    - pypdfium2 でページ画像化（最大3ページ）
    - Gemini / OpenAI Vision API で画像OCR
    - OpenAI gpt-4o で構造化JSON生成（OPENAI_API_KEY 未設定時は structured=null）
    - 返却: { text, meta, warnings, structured }
    """
    return _ocr_impl(body, credentials, user)


@app.post("/ocr")
def ocr_compat(
    body: OcrRequest,
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    user: dict = Depends(verify_jwt),
):
    """compat: Vite proxy 経由のローカル開発用（/api/ocr と同じ処理）"""
    return _ocr_impl(body, credentials, user)
