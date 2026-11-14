export interface DriveFolder {
  id: string;
  name: string;
  webViewLink?: string;
  createdTime?: string;
}

export interface DriveUploadedFile {
  id: string;
  name: string;
  webViewLink?: string;
  size?: string;
}

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

export async function listDriveFolders(accessToken: string): Promise<DriveFolder[]> {
  const q = encodeURIComponent(
    "mimeType = 'application/vnd.google-apps.folder' and trashed = false"
  );
  const fields = encodeURIComponent('files(id,name,webViewLink,createdTime)');
  const orderBy = encodeURIComponent('modifiedTime desc');

  const res = await fetch(
    `${DRIVE_FILES_API}?q=${q}&fields=${fields}&orderBy=${orderBy}&pageSize=50`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google Drive error (${res.status}): ${errText || res.statusText}`);
  }

  const data = await res.json();
  return data.files || [];
}

export async function createDriveFolder(
  accessToken: string,
  folderName: string
): Promise<DriveFolder> {
  const res = await fetch(`${DRIVE_FILES_API}?fields=id,name,webViewLink,createdTime`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName.trim() || 'M3U8 Downloads',
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Failed to create Drive folder (${res.status}): ${errText || res.statusText}`);
  }

  return await res.json();
}

export async function findOrCreateDriveFolder(
  accessToken: string,
  folderName = 'M3U8 Downloads'
): Promise<DriveFolder> {
  const safeName = folderName.trim() || 'M3U8 Downloads';
  const escapedName = safeName.replace(/'/g, "\\'");
  const q = encodeURIComponent(
    `mimeType = 'application/vnd.google-apps.folder' and name = '${escapedName}' and trashed = false`
  );
  const fields = encodeURIComponent('files(id,name,webViewLink,createdTime)');

  const res = await fetch(`${DRIVE_FILES_API}?q=${q}&fields=${fields}&pageSize=1`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Failed to query Drive folders (${res.status}): ${errText || res.statusText}`);
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0];
  }

  return await createDriveFolder(accessToken, safeName);
}

export async function verifyDriveFolderExists(
  accessToken: string,
  folderId: string
): Promise<DriveFolder | null> {
  if (!folderId) return null;
  const res = await fetch(
    `${DRIVE_FILES_API}/${encodeURIComponent(folderId)}?fields=id,name,webViewLink,trashed`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (res.status === 404) return null;
  if (!res.ok) return null;

  const folder = await res.json();
  if (folder.trashed) return null;
  return folder;
}

export async function uploadVideoToDrive(
  accessToken: string,
  blob: Blob,
  filename: string,
  folderId: string | undefined,
  onProgress?: (percent: number) => void
): Promise<DriveUploadedFile> {
  const metadata: Record<string, any> = {
    name: filename,
    mimeType: blob.type || 'video/mp2t',
  };
  if (folderId) {
    metadata.parents = [folderId];
  }

  // Step 1: Initiate resumable upload session
  const initRes = await fetch(
    `${DRIVE_UPLOAD_API}?uploadType=resumable&fields=id,name,webViewLink,size`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': blob.type || 'video/mp2t',
        'X-Upload-Content-Length': String(blob.size),
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!initRes.ok) {
    const errText = await initRes.text().catch(() => '');
    throw new Error(`Failed to start Google Drive upload (${initRes.status}): ${errText || initRes.statusText}`);
  }

  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) {
    throw new Error('Google Drive upload session did not return a Location header.');
  }

  // Step 2: Stream Blob via XHR so we get real-time upload progress
  return await new Promise<DriveUploadedFile>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', blob.type || 'video/mp2t');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const pct = Math.min(100, Math.round((event.loaded / event.total) * 100));
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed = JSON.parse(xhr.responseText);
          onProgress?.(100);
          resolve(parsed);
        } catch {
          reject(new Error('Invalid response from Google Drive upload.'));
        }
      } else {
        reject(
          new Error(
            `Google Drive upload failed (HTTP ${xhr.status}): ${xhr.responseText || xhr.statusText}`
          )
        );
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error while uploading video to Google Drive.'));
    };

    xhr.send(blob);
  });
}
