import os
from functools import lru_cache

import boto3

# ----------------------------
# dotenv は「ローカル開発時だけ」読む
#  - Render など本番では .env を読まない
# ----------------------------
def _maybe_load_dotenv():
    # Render では RENDER=true の環境変数が入ることが多い
    # それ以外でも ENV=production を使うならそれで判定
    is_render = bool(os.getenv("RENDER"))
    is_production = os.getenv("ENV", "").lower() == "production"
    if is_render or is_production:
        return

    # ローカルだけ dotenv 読む（dotenv が無いなら何もしない）
    try:
        from dotenv import load_dotenv  # python-dotenv
        load_dotenv()
    except Exception:
        pass


_maybe_load_dotenv()


def _get_env(name: str, *, fallback: str | None = None) -> str | None:
    v = os.getenv(name)
    if v is not None and v.strip() != "":
        return v.strip()
    if fallback:
        v2 = os.getenv(fallback)
        if v2 is not None and v2.strip() != "":
            return v2.strip()
    return None


def get_bucket_name() -> str:
    # 正：R2_BUCKET_NAME（あなたの現行コードに合わせる）
    # 誤って R2_BUCKET にすることが多いのでフォールバック
    bucket = _get_env("R2_BUCKET_NAME", fallback="R2_BUCKET")
    if not bucket:
        raise RuntimeError("R2_BUCKET_NAME is missing (set in Render Environment)")
    return bucket


@lru_cache(maxsize=1)
def get_s3_client():
    """
    R2(S3互換)クライアントを遅延生成。
    import 時点で落ちないので、Render デプロイが安定する。
    """
    endpoint = _get_env("R2_ENDPOINT")
    access_key = _get_env("R2_ACCESS_KEY_ID")
    secret_key = _get_env("R2_SECRET_ACCESS_KEY")

    if not endpoint:
        raise RuntimeError("R2_ENDPOINT is missing (set in Render Environment)")
    if not access_key or not secret_key:
        raise RuntimeError("R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY is missing")

    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
    )