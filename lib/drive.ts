/**
 * Reads the list of filenames sitting in a Google Drive folder.
 *
 * The app authenticates as a "service account" - a robot Google account that
 * belongs to this app. The Drive folder has to be shared with that robot's
 * email address, otherwise it sees nothing.
 *
 * Credentials can arrive two ways:
 *
 *   GOOGLE_APPLICATION_CREDENTIALS  path to the .json key file  (local dev)
 *   GOOGLE_SERVICE_ACCOUNT_JSON     the whole .json as a string (Vercel)
 *
 * Hosting platforms have no filesystem to drop a key file into, so in
 * production the key is pasted in as an environment variable instead.
 *
 * Either way, GOOGLE_DRIVE_FOLDER_ID says which folder to watch.
 */

import { google, type drive_v3 } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

/**
 * Read an environment variable, trimming whitespace and treating blank as unset.
 * Values pasted into a hosting dashboard often pick up a stray newline, which
 * would otherwise be silently baked into a folder id or a JSON key.
 */
function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/** True when we have both a folder to look at and some way to log in. */
export function isDriveConfigured(): boolean {
  const hasCredentials =
    Boolean(readEnv("GOOGLE_SERVICE_ACCOUNT_JSON")) ||
    Boolean(readEnv("GOOGLE_APPLICATION_CREDENTIALS"));

  return Boolean(readEnv("GOOGLE_DRIVE_FOLDER_ID")) && hasCredentials;
}

function buildAuth() {
  const inlineKey = readEnv("GOOGLE_SERVICE_ACCOUNT_JSON");

  if (inlineKey) {
    let credentials;
    try {
      credentials = JSON.parse(inlineKey);
    } catch {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
    }
    return new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
  }

  return new google.auth.GoogleAuth({
    keyFile: readEnv("GOOGLE_APPLICATION_CREDENTIALS"),
    scopes: SCOPES,
  });
}

export async function listDriveFilenames(): Promise<string[]> {
  const folderId = readEnv("GOOGLE_DRIVE_FOLDER_ID");

  if (!folderId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID is not set");
  }

  const drive = google.drive({ version: "v3", auth: buildAuth() });

  const filenames: string[] = [];
  let pageToken: string | undefined = undefined;

  // Drive returns results in pages, so keep asking until there are no more.
  do {
    // Typing the params explicitly stops TypeScript chasing its own tail:
    // pageToken is read from the response that this call produces.
    const params: drive_v3.Params$Resource$Files$List = {
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(name)",
      pageSize: 100,
      pageToken,
      // Needed if the folder lives in a Shared Drive rather than My Drive.
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    };

    const response = await drive.files.list(params);

    for (const file of response.data.files ?? []) {
      if (file.name) filenames.push(file.name);
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return filenames;
}
