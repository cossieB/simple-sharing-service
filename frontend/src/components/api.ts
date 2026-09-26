import { fetchAuthSession } from "@aws-amplify/auth";
import { API_URL } from "../env";
import type { ApiResult, FileResponse } from "./types";

export class AuthError extends Error {
  constructor(message = "Session expired. Please login again.") {
    super(message);
    this.name = "AuthError";
  }
}

async function getAuthToken(): Promise<string> {
  const session = await fetchAuthSession();
  const token = session.tokens?.accessToken?.toString();

  if (!token) {
    throw new AuthError();
  }

  return token;
}

async function getErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchFiles(signal?: AbortSignal): Promise<FileResponse[]> {
  const token = await getAuthToken();

  const res = await fetch(`${API_URL}/files`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });

  if (!res.ok) {
    throw new Error(await getErrorMessage(res, "Failed to fetch files."));
  }

  const data = (await res.json()) as { files?: FileResponse[] };
  return data.files ?? [];
}

export async function uploadFile(file: File): Promise<FileResponse> {
  const token = await getAuthToken();

  const res = await fetch(`${API_URL}/files/upload-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    }),
  });

  if (!res.ok) {
    throw new Error(await getErrorMessage(res, "Failed to create upload."));
  }

  const data = (await res.json()) as {
    id: string;
    uploadUrl: string;
    s3Key: string;
  };

  const uploadRes = await fetch(data.uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
  });

  if (!uploadRes.ok) {
    throw new Error("Failed to upload the file.");
  }

  const completeRes = await fetch(`${API_URL}/files/${data.id}/complete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!completeRes.ok) {
    throw new Error(
      await getErrorMessage(completeRes, "The file uploaded but could not be finalized."),
    );
  }

  if (completeRes.status === 204) {
    return {
      id: data.id,
      s3Key: data.s3Key,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      status: "uploaded",
      userId: "",
      createdAt: new Date().toISOString(),
    };
  }

  const completed = (await completeRes.json()) as Partial<FileResponse>;
  return {
    id: completed.id ?? data.id,
    s3Key: completed.s3Key ?? data.s3Key,
    fileName: completed.fileName ?? file.name,
    contentType: completed.contentType ?? file.type ?? "application/octet-stream",
    status: completed.status ?? "uploaded",
    userId: completed.userId ?? "",
    createdAt: completed.createdAt ?? new Date().toISOString(),
  };
}

export async function fetchDownloadUrl(
  fileId: string,
): Promise<ApiResult<{ downloadUrl: string }>> {
  const token = await getAuthToken();

  const res = await fetch(`${API_URL}/files/${fileId}/download-url`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 200) {
    return { ok: true, data: await res.json() };
  }

  if (res.status === 403 || res.status === 404) {
    return {
      ok: false,
      error: await getErrorMessage(res, "Unable to download file."),
    };
  }

  throw new Error(await getErrorMessage(res, "Failed to get download link."));
}

export async function deleteFile(
  fileId: string,
): Promise<ApiResult<{ ok: true }>> {
  const token = await getAuthToken();

  const res = await fetch(`${API_URL}/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 200) {
    return { ok: true, data: await res.json() };
  }

  if (res.status === 403 || res.status === 404) {
    return {
      ok: false,
      error: await getErrorMessage(res, "Unable to delete file."),
    };
  }

  throw new Error(await getErrorMessage(res, "Failed to delete file."));
}
