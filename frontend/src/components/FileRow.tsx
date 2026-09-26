import { useState } from "react";
import { deleteFile, fetchDownloadUrl } from "./api";
import { HoldToConfirmButton } from "./HoldToConfirmButton";
import type { FileResponse } from "./types";
import styles from "./FileRow.module.css";

type DownloadState = {
    isLoading: boolean;
    url?: string;
    error?: string;
};

type ShareState = {
    isLoading: boolean;
    error?: string;
};

type FileRowProps = {
    file: FileResponse;
    onDeleted: (fileId: string) => void;
};

export function FileRow({ file, onDeleted }: FileRowProps) {
    const [downloadState, setDownloadState] = useState<DownloadState>({ isLoading: false });
    const [shareState, setShareState] = useState<ShareState>({ isLoading: false });
    const [deleteError, setDeleteError] = useState<string | undefined>();

    async function handleDownload() {
        setDownloadState({ isLoading: true });
        setShareState({ isLoading: false });

        try {
            const result = await fetchDownloadUrl(file.id);

            if (result.ok) {
                setDownloadState({ isLoading: false, url: result.data.downloadUrl });
            }
            else {
                setDownloadState({ isLoading: false, error: result.error });
            }
        } catch (error) {
            setDownloadState({
                isLoading: false,
                error: error instanceof Error ? error.message : "Failed to get download link",
            });
        }
    }

    async function handleShare() {
        if (!downloadState.url || !navigator.share) {
            setShareState({
                isLoading: false,
                error: "Sharing is not supported by this browser.",
            });
            return;
        }

        setShareState({ isLoading: true });

        try {
            await navigator.share({
                title: file.fileName,
                text: `${file.fileName} — download link expires in 1 hour.`,
                url: downloadState.url,
            });
            setShareState({ isLoading: false });
        } catch (error) {
            // Closing the native share sheet is not an error.
            if (error instanceof DOMException && error.name === "AbortError") {
                setShareState({ isLoading: false });
                return;
            }

            setShareState({
                isLoading: false,
                error: error instanceof Error ? error.message : "Failed to share the link",
            });
        }
    }

    async function handleDelete() {
        setDeleteError(undefined);

        try {
            const result = await deleteFile(file.id);

            if (result.ok) {
                onDeleted(file.id);
            } 
            else {
                setDeleteError(result.error);
            }
        } catch (error) {
            setDeleteError(error instanceof Error ? error.message : "Failed to delete file");
        }
    }

    const actionError = downloadState.error ?? shareState.error ?? deleteError;

    return (
        <li className={styles.listItem}>
            <div className={styles.fileInfo}>
                <span className={styles.fileName}>{file.fileName}</span>
                <div className={styles.fileMeta}>
                    <span
                        className={
                            file.status === "uploaded"
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
                {actionError && <span className={styles.errorText}>{actionError}</span>}

                {downloadState.url && (
                    <div className={styles.linkInfo}>
                        <span className={styles.expiryText}>Download link expires in 1 hour.</span>
                        <button
                            type="button"
                            className={styles.shareButton}
                            disabled={shareState.isLoading}
                            onClick={handleShare}
                        >
                            {shareState.isLoading ? "Sharing..." : "Share"}
                        </button>
                    </div>
                )}

                <button
                    type="button"
                    className={styles.downloadButton}
                    disabled={downloadState.isLoading}
                    onClick={downloadState.url ? () => {
                        window.open(downloadState.url, "_blank", "noopener,noreferrer");
                    }: handleDownload}
                >
                    {downloadState.isLoading ? (
                        <>
                            <span className={styles.spinner} />
                            Getting link...
                        </>
                    ) : downloadState.url ? "Open" : "Download"}
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
