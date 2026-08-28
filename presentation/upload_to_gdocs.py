"""Upload script-v2.docx to Google Drive and convert to Google Docs format."""

import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

KEY_FILE  = os.path.join(os.path.dirname(__file__), "..", "service-account.json")
DOCX_PATH = os.path.join(os.path.dirname(__file__), "script-v2.docx")
SCOPES    = ["https://www.googleapis.com/auth/drive"]

creds  = service_account.Credentials.from_service_account_file(KEY_FILE, scopes=SCOPES)
drive  = build("drive", "v3", credentials=creds)

# Upload as Google Doc (mimeType conversion on import)
media = MediaFileUpload(
    DOCX_PATH,
    mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
)
file = drive.files().create(
    body={
        "name": "SparkLabs 서류 추적기 — 발표 스크립트 v2",
        "mimeType": "application/vnd.google-apps.document",
    },
    media_body=media,
    fields="id,webViewLink",
).execute()

file_id = file["id"]

# Make it readable by anyone with the link
drive.permissions().create(
    fileId=file_id,
    body={"type": "anyone", "role": "reader"},
).execute()

print(f"\nGoogle Doc created!")
print(f"Link: {file['webViewLink']}\n")
