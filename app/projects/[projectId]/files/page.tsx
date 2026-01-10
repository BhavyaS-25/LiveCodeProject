"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";

type File = {
  id: number;
  name: string;
};

export default function FilesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const [projectName, setProjectName] = useState<string>("");
  const { projectId } = use(params);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [editingFileId, setEditingFileId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");


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
    
    <div style={{ padding: 40 }}>
      <h1>{projectName || "Project"}</h1>
      <p style={{ color: "#666", marginBottom: 20 }}>
       Files in this project
      </p>



      <div style={{ marginBottom: 20 }}> 
        <input
          placeholder="New file name"
          value={newFileName}
          onChange={(e) => setNewFileName(e.target.value)}
        />
        <button onClick={createFile} style={{ marginLeft: 8 }}>
          Create
        </button>
      </div>

      {files.length === 0 && <p>No files yet.</p>}

      <ul>
        {files.map((file) => (
          <li key={file.id} style= {{ display: "flex", gap: 10, alignItems: "center"}}>
            {editingFileId === file.id ? (
              <>
              <input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                if (e.key === "Enter") {
                  renameFile(file.id);
                }
                if (e.key === "Escape") {
                  setEditingFileId(null);
                }
              }}
            autoFocus
          />
        <button onClick={() => renameFile(file.id)}>Save</button>
      </>
      ) : (
      <>
      <Link href={`/projects/${projectId}/files/${file.id}`}>
      {file.name}
      </Link>
      <button
        onClick={() => {
          setEditingFileId(file.id);
          setEditingName(file.name);
        }}
      > Rename </button></>
)}

            <button onClick={() => deleteFile(file.id)} style = {{color: "red"}}> Delete </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
