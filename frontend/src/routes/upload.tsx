import { useState, type DragEvent } from "react"
import styles from "./upload.module.css"

type DragState = "idle" | "dragover" | "invalid";

export function UploadRoute() {
    const [dragState, setDragState] = useState<DragState>("idle");
    const [file, setFile] = useState<File>()
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
        </div>
    )
}

