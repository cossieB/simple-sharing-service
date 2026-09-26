import { useEffect, useState } from "react";
import { fetchFiles } from "../components/api";
import { FileRow } from "../components/FileRow";
import { Upload } from "../components/Upload";
import type { FileResponse } from "../components/types";
import styles from "./files.module.css";

export function FilesList() {
  const [files, setFiles] = useState<FileResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadFiles() {
      try {
        setLoadError(undefined);
        const data = await fetchFiles(abortController.signal);
        setFiles(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error(error);
        setLoadError(
          error instanceof Error ? error.message : "Failed to fetch files.",
        );
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadFiles();
    return () => abortController.abort();
  }, []);

  function handleFileDeleted(fileId: string) {
    setFiles((prev) => prev.filter((file) => file.id !== fileId));
  }

  function handleUploaded(file: FileResponse) {
    setFiles((prev) => [file, ...prev.filter((item) => item.id !== file.id)]);
    setIsUploadOpen(false);
  }

  if (isLoading) {
    return <div className={styles.stateText}>Loading files...</div>;
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.heading}>Your Files</h1>
            <p className={styles.subheading}>
              {files.length} {files.length === 1 ? "file" : "files"}
            </p>
          </div>
          <button
            type="button"
            className={styles.uploadButton}
            onClick={() => setIsUploadOpen(true)}
          >
            Upload file
          </button>
        </header>

        {loadError && (
          <div className={styles.errorBanner} role="alert">
            <span>{loadError}</span>
            {loadError && (
              <button
                type="button"
                className={styles.retryButton}
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            )}
          </div>
        )}

        {files.length === 0 ? (
          <section className={styles.emptyState}>
            <strong>No files yet</strong>
            <span>Upload your first file to get started.</span>
            <button
              type="button"
              className={styles.uploadButton}
              onClick={() => setIsUploadOpen(true)}
            >
              Upload a file
            </button>
          </section>
        ) : (
          <ul className={styles.list}>
            {files.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                onDeleted={handleFileDeleted}
              />
            ))}
          </ul>
        )}
      </div>

      {isUploadOpen && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsUploadOpen(false);
            }
          }}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 id="upload-title">Upload file</h2>
                <p>Choose a file up to 16 MB.</p>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setIsUploadOpen(false)}
                aria-label="Close upload dialog"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-x-lg" viewBox="0 0 16 16">
                  <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z" />
                </svg>
              </button>
            </div>

            <Upload onUploaded={handleUploaded} />
          </section>
        </div>
      )}
    </main>
  );
}
