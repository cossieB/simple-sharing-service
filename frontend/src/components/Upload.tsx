import { useState, type DragEvent } from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { AuthError, uploadFile } from "./api";
import type { FileResponse } from "./types";
import styles from "./Upload.module.css";

type DragState = "idle" | "dragover";

type UploadProps = {
    onUploaded: (file: FileResponse) => void;
};

const MAX_FILE_SIZE = 16 * 1024 * 1024;

export function Upload({ onUploaded }: UploadProps) {
    const [dragState, setDragState] = useState<DragState>("idle");
    const [file, setFile] = useState<File>();
    const [error, setError] = useState<string>();
    const [isUploading, setIsUploading] = useState(false);
    const { signOut } = useAuthenticator();

    function handleFiles(files: FileList | null | undefined) {
        const selectedFile = files?.item(0);
        if (!selectedFile) return;

        setError(undefined);

        if (selectedFile.size > MAX_FILE_SIZE) {
            setFile(undefined);
            setError("That file is too large. The maximum size is 16 MB.");
            return;
        }

        setFile(selectedFile);
    }

    async function handleSubmit() {
        if (!file || isUploading) return;

        setError(undefined);
        setIsUploading(true);

        try {
            const uploadedFile = await uploadFile(file);
            onUploaded(uploadedFile);
        } catch (error) {
            console.error(error);

            if (error instanceof AuthError) {
                setError(error.message);
                signOut();
                return;
            }

            setError(error instanceof Error ? error.message : "Failed to upload the file.");
        } finally {
            setIsUploading(false);
        }
    }

    function handleDragEnter(event: DragEvent<HTMLLabelElement>) {
        event.preventDefault();
        setDragState("dragover");
    }

    function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
        event.preventDefault();
        setDragState("idle");
    }

    const className = ["file-drop", dragState === "dragover" && "dragover"]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={styles.uploadContainer}>
            <label
                className={className}
                onDragEnter={handleDragEnter}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={handleDragLeave}
                onDrop={(event) => {
                    event.preventDefault();
                    setDragState("idle");
                    handleFiles(event.dataTransfer.files);
                }}
            >
                <input
                    type="file"
                    onChange={(event) => {
                        handleFiles(event.target.files);
                        event.target.value = "";
                    }}
                />
                {file ? (
                    <span className="file-title">{file.name}</span>
                ) : (
                    <span className="file-title">Choose a file</span>
                )}
                <span className="file-hint">Drop a file here or click to browse</span>
            </label>

            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}

            <div className={styles.actions}>
                <button
                    type="button"
                    className={styles.uploadButton}
                    disabled={!file || isUploading}
                    onClick={() => void handleSubmit()}
                >
                    {isUploading ? "Uploading..." : "Upload"}
                </button>
            </div>
        </div>
    );
}
