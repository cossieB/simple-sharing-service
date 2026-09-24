import { useState, type DragEvent } from "react"
import styles from "./upload.module.css"
import { useAuthenticator } from "@aws-amplify/ui-react";
import { fetchAuthSession } from "@aws-amplify/auth";

type DragState = "idle" | "dragover" | "invalid";

export function UploadRoute() {
    const [dragState, setDragState] = useState<DragState>("idle");
    const [file, setFile] = useState<File>()
    const [isUploading, setIsUploading] = useState(false);
    const auth = useAuthenticator()

    async function handleSubmit() {
        if (!file) return;
        setIsUploading(true)
        const session = await fetchAuthSession();
        const token = session.tokens?.accessToken.toString();
        if (!token) {
            alert("Session expired. Please login again");
            auth.signOut()
        }
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/files/upload-url`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    fileName: file.name,
                    contentType: file.type,
                    size: file.size
                })
            })
            if (!res.ok) {
                console.error(res)
                return alert("Failed to upload")
            }
            const data: { id: string, uploadUrl: string, s3Key: string } = await res.json();
            await fetch(data.uploadUrl, {
                method: "PUT",
                body: file,
                headers: {
                    "Content-Type": file.type,
                },
            })
        }
        catch (error) {
            console.error(error)
        }
        finally {
            setIsUploading(false)
        }
    }

    const handleFiles = (files: FileList | null | undefined) => {
        if (!files || !files.length) return;
        const file = files.item(0)!
        if (file.size > 16 * 1024 * 1024) return alert("File too big")
        setFile(files.item(0) ?? undefined)
    };

    const handleDragEnter = (e: DragEvent<HTMLInputElement>) => {
        e.preventDefault();
        setDragState("dragover")
    };

    const className = ["file-drop", dragState !== "idle" && dragState]
        .filter(Boolean)
        .join(" ");
    return (
        <div className={styles.uploadContainer}>
            <label
                className={className}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragState("idle");
                    handleFiles(e.dataTransfer?.files);
                }}
            >
                <input
                    type="file" name="" id=""
                    onDragEnter={handleDragEnter}
                    onChange={(e) => {
                        handleFiles(e.target.files);
                        e.target.value = "";
                    }}
                    onDragLeave={(e) => {
                        e.preventDefault();
                        setDragState("idle");
                    }}
                />
                {file && <span className="file-title"> {file.name} </span>}
                <span className="file-hint">Drop file here (max 16MB)</span>
            </label>
            <button
                disabled={!file || isUploading}
                onClick={handleSubmit}
            >
                Upload
            </button>
        </div>
    )
}