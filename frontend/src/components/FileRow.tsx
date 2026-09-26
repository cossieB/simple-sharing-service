import { useState } from "react";
import { deleteFile, fetchDownloadUrl } from "./api";
import { HoldToConfirmButton } from "./HoldToConfirmButton";
import type { FileResponse } from "./types";
import styles from "./FileRow.module.css";

type DownloadState = {
    isLoading: boolean;
    error?: string;
};

type FileRowProps = {
    file: FileResponse;
    onDeleted: (fileId: string) => void;
};

export function FileRow({ file, onDeleted }: FileRowProps) {
    const [downloadState, setDownloadState] = useState<DownloadState>({ isLoading: false });
    const [deleteError, setDeleteError] = useState<string | undefined>();

    async function handleDownload() {
        setDownloadState({ isLoading: true, error: undefined });

        try {
            const result = await fetchDownloadUrl(file.id);

            if (result.ok) {
                setDownloadState({ isLoading: false });
                window.open(result.data.downloadUrl, "_blank", "noopener,noreferrer");
            } else {
                setDownloadState({ isLoading: false, error: result.error });
            }
        } catch (error: any) {
            setDownloadState({ isLoading: false, error: error.message || "Failed to get download link" });
        }
    }

    async function handleDelete() {
        setDeleteError(undefined);

        try {
            const result = await deleteFile(file.id);

            if (result.ok) {
                onDeleted(file.id);
            } else {
                setDeleteError(result.error);
            }
        } catch (error: any) {
            setDeleteError(error.message || "Failed to delete file");
        }
    }

    return (
        <li className={styles.listItem}>
            <div className={styles.fileInfo}>
                <span className={styles.fileName}>{file.fileName}</span>
                <div className={styles.fileMeta}>
                    <span
                        className={
                            file.status === 'uploaded'
                                ? `${styles.badge} ${styles.badgeUploaded}`
                                : `${styles.badge} ${styles.badgePending}`
                        }
                    >
                        {file.status}
                    </span>
                    <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                </div>
            </div>

            <div className={styles.actions}>
                {(downloadState.error || deleteError) && (
                    <span className={styles.errorText}>{downloadState.error ?? deleteError}</span>
                )}

                <button
                    type="button"
                    className={styles.downloadButton}
                    disabled={downloadState.isLoading}
                    onClick={handleDownload}
                >
                    {downloadState.isLoading ? (
                        <>
                            <span className={styles.spinner} />
                            Getting link...
                        </>
                    ) : (
                        "Download"
                    )}
                </button>

                <HoldToConfirmButton
                    ariaLabel={`Hold to delete ${file.fileName}`}
                    idleLabel="Hold to delete"
                    holdingLabel="Keep holding..."
                    busyLabel={
                        <>
                            <span className={styles.spinner} />
                            Deleting...
                        </>
                    }
                    onConfirm={handleDelete}
                />
            </div>
        </li>
    );
}
