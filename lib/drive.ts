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
import { get, put } from "@vercel/blob";
import { readEnv as readCleanEnv, readEnvList } from "./env";
import { listUploadedFiles } from "./storage";

// Full drive access: needed to create folders and set sharing permissions.
// The service account is an internal-only robot; no external code reaches it.
const SCOPES = ["https://www.googleapis.com/auth/drive"];

const SPARKLABS_DOMAIN = readCleanEnv("ALLOWED_EMAIL_DOMAIN") || "sparklabs.co.kr";
// Individual email exceptions (e.g. interns with Gmail) that also need folder access.
const EXTRA_EMAILS = readEnvList("ALLOWED_EMAILS");

/**
 * Read an environment variable, trimming whitespace and treating blank as unset.
 * Values pasted into a hosting dashboard often pick up a stray newline, which
 * would otherwise be silently baked into a folder id or a JSON key.
 */
function readEnv(name: string): string | undefined {
  // Thin wrapper over the shared reader, which also strips byte-order marks.
  // The undefined-when-blank shape is what the callers below expect.
  return readCleanEnv(name) || undefined;
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

const DRIVE_CONFIG_PATH = "config/drive-config.json";

type DriveConfig = {
  parentFolderId?: string;
};

async function readDriveConfig(): Promise<DriveConfig> {
  const found = await get(DRIVE_CONFIG_PATH, { access: "private", useCache: false });
  if (!found?.stream) return {};
  try {
    const parsed: unknown = JSON.parse(await new Response(found.stream).text());
    return typeof parsed === "object" && parsed !== null ? (parsed as DriveConfig) : {};
  } catch {
    return {};
  }
}

async function writeDriveConfig(config: DriveConfig): Promise<void> {
  await put(DRIVE_CONFIG_PATH, JSON.stringify(config, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

/** Grants writer access to the SparkLabs domain + any individual exception emails. */
export async function reshareFolder(folderId: string): Promise<void> {
  const drive = google.drive({ version: "v3", auth: buildAuth() });
  await shareFolder(drive, folderId);
}

async function shareFolder(drive: drive_v3.Drive, folderId: string): Promise<void> {
  // Domain-wide: every @sparklabs.co.kr Google Workspace account.
  await drive.permissions.create({
    fileId: folderId,
    requestBody: { type: "domain", role: "writer", domain: SPARKLABS_DOMAIN },
    supportsAllDrives: true,
  });

  // Individual exceptions (e.g. Gmail interns) from ALLOWED_EMAILS.
  for (const email of EXTRA_EMAILS) {
    await drive.permissions.create({
      fileId: folderId,
      requestBody: { type: "user", role: "writer", emailAddress: email },
      supportsAllDrives: true,
      // Don't send a notification email on every folder creation.
      sendNotificationEmail: false,
    });
  }
}

/** Returns the ID of the shared SparkLabs parent folder, creating it if needed. */
async function getOrCreateParentFolder(
  drive: drive_v3.Drive,
): Promise<string> {
  const config = await readDriveConfig();
  if (config.parentFolderId) return config.parentFolderId;

  const res = await drive.files.create({
    requestBody: {
      name: "SparkLabs 서류 추적기",
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
    supportsAllDrives: true,
  });

  const folderId = res.data.id;
  if (!folderId) throw new Error("Drive did not return a parent folder id");

  await shareFolder(drive, folderId);
  await writeDriveConfig({ ...config, parentFolderId: folderId });
  return folderId;
}

/**
 * Uploads a file from a ReadableStream into an existing Drive folder.
 *
 * Used to mirror website uploads into the deal's Drive folder automatically.
 * Errors are caught by the caller — a Drive failure should never break the
 * main upload flow.
 */
export async function uploadFileToDriveFolder(
  folderId: string,
  filename: string,
  contentType: string,
  body: ReadableStream,
): Promise<void> {
  const drive = google.drive({ version: "v3", auth: buildAuth() });
  const { Readable } = await import("stream");

  await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: {
      mimeType: contentType || "application/octet-stream",
      body: Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]),
    },
    supportsAllDrives: true,
    fields: "id",
  });
}

/**
 * Creates a Drive folder for a company inside the shared SparkLabs parent
 * folder, shares it with the whole SparkLabs domain (writer access), and
 * returns the folder ID.
 *
 * The parent folder ("SparkLabs 서류 추적기") is created automatically the
 * first time this is called and reused for every subsequent company.
 * Its ID is stored in Blob at config/drive-config.json.
 *
 * Access is domain-only — no public link, no other accounts.
 */
export async function deleteDealFolder(folderId: string): Promise<void> {
  const drive = google.drive({ version: "v3", auth: buildAuth() });
  await drive.files.delete({ fileId: folderId, supportsAllDrives: true });
}

/**
 * Creates a named subfolder inside an existing Drive folder and returns its ID.
 * Does NOT share the subfolder — it inherits access from the parent.
 */
export async function getOrCreateSubfolder(parentFolderId: string, name: string): Promise<string> {
  const drive = google.drive({ version: "v3", auth: buildAuth() });
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  const id = res.data.id;
  if (!id) throw new Error(`Drive did not return an id for subfolder "${name}"`);
  return id;
}

/**
 * Uploads all files currently in Blob for a deal into the correct Drive subfolder.
 * Execution startup uploads go to execFolderId; everything else goes to initialFolderId.
 * Falls back to folderId when a subfolder ID is absent.
 */
export async function syncExistingFilesToDrive(
  dealId: string,
  folderId: string,
  subfolders?: { initial?: string; exec?: string },
): Promise<void> {
  const files = await listUploadedFiles(dealId);
  for (const file of files) {
    try {
      const found = await get(file.pathname, { access: "private", useCache: false });
      if (!found?.stream) continue;
      const isExecStartup = file.filename.startsWith("execution/startup/");
      const targetFolder = isExecStartup
        ? (subfolders?.exec ?? folderId)
        : (subfolders?.initial ?? folderId);
      const displayName = isExecStartup
        ? file.filename.slice("execution/startup/".length)
        : file.filename;
      await uploadFileToDriveFolder(targetFolder, displayName, "application/octet-stream", found.stream);
    } catch {
      // best-effort per file
    }
  }
}

export async function createDealFolder(companyName: string, fundFolderId?: string): Promise<string> {
  const drive = google.drive({ version: "v3", auth: buildAuth() });

  const parentFolderId = fundFolderId ?? await getOrCreateParentFolder(drive);

  const folderRes = await drive.files.create({
    requestBody: {
      name: companyName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  const folderId = folderRes.data.id;
  if (!folderId) throw new Error("Drive did not return a folder id");

  // Set permissions explicitly on each subfolder so it's accessible even when
  // opened directly (not via the parent).
  await shareFolder(drive, folderId);

  return folderId;
}
