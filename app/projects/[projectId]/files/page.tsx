"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "./filesPage.module.css"; 

type File = {
  id: number;
  name: string;
};


export default function FilesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const searchParams = useSearchParams();
  const [projectName, setProjectName] = useState<string>("");
  const { projectId } = use(params);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [editingFileId, setEditingFileId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
 

  function getLanguageFromFilename(filename: string) {
    const ext = filename.split(".").pop()?.toLowerCase();

    switch (ext) {
      case "js":
        return "JavaScript";
      case "ts":
        return "TypeScript";
      case "py":
        return "Python";
      case "java":
        return "Java";
      case "json":
        return "JSON";
      case "html":
        return "HTML";
      case "css":
        return "CSS";
      case "md":
        return "Markdown";
      default:
        return "Plain Text";
    }
}

  useEffect(() => {
    
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    fetch(`http://localhost:8000/projects/${projectId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
      if (!res.ok) throw new Error("Failed to fetch project");
        return res.json();
    })
      .then((data) => {
        setProjectName(data.name);
    })
      .catch((err) => {
        console.error(err);
    });

    fetch(`http://localhost:8000/projects/${projectId}/files`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch files");
        return res.json();
      })
      .then((data) => {
        setFiles(data);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [projectId]);
  
  const createFile = async () => {
    if (!newFileName.trim()) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    const res = await fetch(
      `http://localhost:8000/projects/${projectId}/files`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newFileName,
          content: "",
        }),
      }
    );

    if (!res.ok) {
      alert("Failed to create file");
      return;
    }

    const newFile = await res.json();
    setFiles((prev) => [...prev, newFile]);
    setNewFileName("");
  };
  async function deleteFile(fileId: number) {
    const confirmed = confirm("Do you want to delete this file?")
    if (!confirmed) {
      return;
    }
    const token = localStorage.getItem("token");
    const res = await fetch(
      `http://localhost:8000/projects/${projectId}/files/${fileId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        }
      }
    );
    const text = await res.text();

    console.log("DELETE status:", res.status);
    console.log("DELETE response:", text);

    if (!res.ok) {
      alert("Failed to delete this file");
      return;
    }
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }

  async function renameFile(fileId: number) {
    const token = localStorage.getItem("token");
    if (!token) {
      return;
    }
    const res = await fetch (
       `http://localhost:8000/projects/${projectId}/files/${fileId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type" : "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editingName,
        }),
      }
    );
    if (!res.ok) {
      alert("Failed to rename file");
      return;
    }
    const updated = await res.json();
    setFiles((prev) => prev.map((f) => (f.id === fileId ? updated : f)));
    setEditingFileId(null);
    setEditingName("");
  }
  if (loading) {
    return <p style={{ padding: 40 }}>Loading files...</p>;
  }

  if (error) {
    return (
      <div style={{ padding: 40 }}>
        <p style={{ color: "red" }}>{error}</p>
      </div>
    );
  }

  return (
    <div className = {styles.page}>
      <div className = {styles.container}>
        <h1 className= {styles.title}>{projectName || "Project"}</h1>
        <p className= {styles.subtitle}>
        Files in this project
        </p>



      <div className = {styles.createRow}> 
        <input
          className = {styles.input}
          placeholder = "New file name"
          value = {newFileName}
          onChange = {(e) => setNewFileName(e.target.value)}

        />
        <button 
            className = {styles.primaryButton}
            onClick={createFile}>
          Create
        </button>
      </div>

      {files.length === 0 && <p>No files yet.</p>}

      <ul>
        {files.map((file) => (
          <li key={file.id} className={styles.fileItem}>
            <div className={styles.fileMeta}>
              <Link
                href={`/projects/${projectId}/files/${file.id}`}
                className={styles.fileLink}
              >
                {file.name}
              </Link>

              <span className={styles.badge}>
                {getLanguageFromFilename(file.name)}
              </span>
            </div>

            <div className={styles.actions}>
              <button
                onClick={() => {
                  setEditingFileId(file.id);
                  setEditingName(file.name);
                }}
              >
                Rename
              </button>

              <button
                className={styles.danger}
                onClick={() => deleteFile(file.id)}
              >
                Delete
              </button>
            </div>
          </li>

        ))}
      </ul>
    </div>
  </div>
  );
}
