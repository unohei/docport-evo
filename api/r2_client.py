import os
import boto3
from dotenv import load_dotenv

load_dotenv()

BUCKET = os.getenv("R2_BUCKET_NAME")

R2_ENDPOINT = os.getenv("R2_ENDPOINT")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")

if not R2_ENDPOINT:
    raise RuntimeError("R2_ENDPOINT is missing")
if not R2_ACCESS_KEY_ID or not R2_SECRET_ACCESS_KEY:
    raise RuntimeError("R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY is missing")

s3 = boto3.client(
    "s3",
    endpoint_url=R2_ENDPOINT,
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name="auto",
)