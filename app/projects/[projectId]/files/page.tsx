"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./filesPage.module.css";
import { ApiError, apiRequest, getToken, isValidName } from "../../../../lib/api";

type Project = { id: number; name: string };
type ProjectFile = { id: number; name: string; content?: string; version?: number };

function languageFor(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  return ({ js: "JavaScript", ts: "TypeScript", py: "Python", java: "Java", json: "JSON", html: "HTML", css: "CSS", md: "Markdown" } as Record<string, string>)[extension ?? ""] ?? "Plain Text";
}

export default function FilesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const router = useRouter();
  const [projectName, setProjectName] = useState("Project");
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingFileId, setEditingFileId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  function reportError(err: unknown) {
    if (err instanceof ApiError && err.status === 401) { router.replace("/login"); return; }
    setError(err instanceof Error ? err.message : "Something went wrong.");
  }

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    let cancelled = false;
    Promise.all([apiRequest<ProjectFile[]>(`/projects/${projectId}/files`), apiRequest<Project[]>("/projects")])
      .then(([fileData, projectData]) => { if (!cancelled) { setFiles(fileData); setProjectName(projectData.find((project) => String(project.id) === projectId)?.name ?? "Project"); } })
      .catch((err) => { if (!cancelled) reportError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // reportError intentionally uses the stable route for this page
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, router]);

  async function createFile() {
    const name = newFileName.trim();
    if (!isValidName(name, "file")) { setError("File names must be 1-120 characters and cannot include slashes."); return; }
    setCreating(true); setError(null);
    try {
      const result = await apiRequest<ProjectFile>(`/projects/${projectId}/files`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, content: "" }) });
      setFiles((previous) => [...previous, result]); setNewFileName("");
    } catch (err) { reportError(err); } finally { setCreating(false); }
  }

  async function renameFile(fileId: number) {
    const name = editingName.trim();
    if (!isValidName(name, "file")) { setError("File names must be 1-120 characters and cannot include slashes."); return; }
    setSavingRename(true); setError(null);
    try {
      const updated = await apiRequest<ProjectFile>(`/projects/${projectId}/files/${fileId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      setFiles((previous) => previous.map((file) => file.id === fileId ? { ...file, ...updated } : file));
      setEditingFileId(null);
    } catch (err) { reportError(err); } finally { setSavingRename(false); }
  }

  async function deleteFile(fileId: number) {
    if (!window.confirm("Delete this file?")) return;
    setError(null);
    try { await apiRequest<void>(`/projects/${projectId}/files/${fileId}`, { method: "DELETE" }); setFiles((previous) => previous.filter((file) => file.id !== fileId)); }
    catch (err) { reportError(err); }
  }

  if (loading) return <p style={{ padding: 40 }}>Loading files...</p>;
  return <div className={styles.page}><div className={styles.container}><h1 className={styles.title}>{projectName}</h1><p className={styles.subtitle}>Files in this project</p>
    {error && <p className="notice-error" role="alert">{error}</p>}
    <div className={styles.createRow}><input className={styles.input} aria-label="New file name" placeholder="New file name" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void createFile(); }} disabled={creating} /><button className={styles.primaryButton} onClick={() => void createFile()} disabled={creating}>{creating ? "Creating..." : "Create"}</button><button className={styles.backButton} onClick={() => router.push("/projects")}>Back</button></div>
    {!files.length ? <p>No files yet.</p> : <ul>{files.map((file) => <li key={file.id} className={styles.fileItem}><div className={styles.fileMeta}>{editingFileId === file.id ? <input aria-label="File name" value={editingName} onChange={(e) => setEditingName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void renameFile(file.id); if (e.key === "Escape") setEditingFileId(null); }} autoFocus /> : <><Link href={`/projects/${projectId}/files/${file.id}`} className={styles.fileLink}>{file.name}</Link><span className={styles.badge}>{languageFor(file.name)}</span></>}</div><div className={styles.actions}>{editingFileId === file.id ? <><button onClick={() => void renameFile(file.id)} disabled={savingRename}>Save</button><button onClick={() => setEditingFileId(null)} disabled={savingRename}>Cancel</button></> : <button onClick={() => { setEditingFileId(file.id); setEditingName(file.name); }}>Rename</button>}<button className={styles.danger} onClick={() => void deleteFile(file.id)}>Delete</button></div></li>)}</ul>}
  </div></div>;
}
