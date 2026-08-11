/**
 * Dev helper: list what's inside a Google Drive folder, with IDs.
 *
 * Usage (from the project root):
 *   node --env-file=.env.local scripts/list-drive.mjs
 *   node --env-file=.env.local scripts/list-drive.mjs <someOtherFolderId>
 *
 * Handy for finding the ID of a subfolder so you can point the app at it.
 */

import { google } from "googleapis";

const folderId = process.argv[2] ?? process.env.GOOGLE_DRIVE_FOLDER_ID;

if (!folderId) {
  console.error("No folder id. Set GOOGLE_DRIVE_FOLDER_ID or pass one as an argument.");
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});

const drive = google.drive({ version: "v3", auth });

const response = await drive.files.list({
  q: `'${folderId}' in parents and trashed = false`,
  fields: "files(id, name, mimeType)",
  pageSize: 200,
  orderBy: "folder,name",
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
});

const entries = response.data.files ?? [];

console.log(`Folder ${folderId} contains ${entries.length} item(s):\n`);

for (const entry of entries) {
  const isFolder = entry.mimeType === "application/vnd.google-apps.folder";
  console.log(`${isFolder ? "[DIR ]" : "[file]"}  ${entry.id}  ${entry.name}`);
}
