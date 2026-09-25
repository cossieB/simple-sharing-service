import type { LoaderFunctionArgs } from "react-router";
import { API_URL } from "../env";
import { fetchAuthSession } from "@aws-amplify/auth";
import { use, useEffect, useState } from "react";

    type FileResponse = {
        contentType: string;
        createdAt: string;
        fileName: string;
        id: string;
        s3Key: string;
        status: 'uploaded' | 'pending';
        userId: string;
    };

export function FilesList() {
    const [files, setFiles] = useState<FileResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const abortController = new AbortController();

        async function fetchFiles() {
            try {
                const session = await fetchAuthSession();
                const token = session.tokens?.accessToken?.toString();

                if (!token) {
                    alert("Session expired. Please login again");
                    return;
                }

                const res = await fetch(`${API_URL}/files`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: abortController.signal
                });

                if (!res.ok) {
                    throw new Error("Failed to fetch files");
                }
                const data = await res.json();
                setFiles(data)
            } 
            catch (error: any) {
                if (error.name !== 'AbortError') {
                    console.error(error);
                    alert(error.message || "Failed to fetch files");
                }
            } finally {
                setIsLoading(false);
            }
        }

        fetchFiles();
        return () => {
            abortController.abort();
        };
    }, []);

    if (isLoading) return <div>Loading files...</div>;

    return (
        <div>
            <h3>Your Files</h3>
            {files.length === 0 ? (
                <p>No files found.</p>
            ) : (
                <ul>
                    {files.map((file) => (
                        <li key={file.id}>{file.fileName}</li>
                    ))}
                </ul>
            )}
        </div>
    );
}
