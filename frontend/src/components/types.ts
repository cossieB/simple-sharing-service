export type FileResponse = {
    contentType: string;
    createdAt: string;
    fileName: string;
    id: string;
    s3Key: string;
    status: 'uploaded' | 'pending';
    userId: string;
};

export type ApiResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: string };
