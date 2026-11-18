"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./projects.module.css";
import { ApiError, apiRequest, clearToken, getToken, isValidName, isValidUsername } from "../../lib/api";

type Project = { id: number; name: string; owner_id: number };
type User = { id: number; username: string };

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newProject, setNewProject] = useState("");
  const [creating, setCreating] = useState(false);
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareProjectId, setShareProjectId] = useState("");
  const [shareUsername, setShareUsername] = useState("");
  const [sharing, setSharing] = useState(false);

  const signOut = useCallback(() => { clearToken(); router.replace("/login"); }, [router]);
  const handleError = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.status === 401) { signOut(); return; }
    setError(err instanceof Error ? err.message : "Something went wrong.");
  }, [signOut]);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    let cancelled = false;
    Promise.all([apiRequest<Project[]>("/projects"), apiRequest<User>("/auth/me")])
      .then(([projectData, user]) => { if (!cancelled) { setProjects(projectData); setCurrentUser(user); } })
      .catch((err) => { if (!cancelled) handleError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [handleError, router]);

  async function createProject() {
    const name = newProject.trim();
    if (!isValidName(name, "project")) { setError("Project names must be 1-120 characters."); return; }
    setError(null); setCreating(true);
    try {
      const result = await apiRequest<{ project: Project }>("/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      setProjects((previous) => [...previous, result.project]); setNewProject("");
    } catch (err) { handleError(err); } finally { setCreating(false); }
  }

  async function renameProject(projectId: number) {
    const name = renameValue.trim();
    if (!isValidName(name, "project")) { setError("Project names must be 1-120 characters."); return; }
    setSavingRename(true); setError(null);
    try {
      const updated = await apiRequest<Project>(`/projects/${projectId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      setProjects((previous) => previous.map((project) => project.id === projectId ? updated : project));
      setRenameId(null);
    } catch (err) { handleError(err); } finally { setSavingRename(false); }
  }

  async function deleteProject(projectId: number) {
    if (!window.confirm("Delete this project and its files?")) return;
    setError(null);
    try { await apiRequest<void>(`/projects/${projectId}`, { method: "DELETE" }); setProjects((previous) => previous.filter((project) => project.id !== projectId)); }
    catch (err) { handleError(err); }
  }

  async function shareProject() {
    const projectId = Number(shareProjectId);
    const username = shareUsername.trim();
    if (!Number.isInteger(projectId) || !isValidUsername(username)) { setError("Choose a project and enter a valid username."); return; }
    setSharing(true); setError(null);
    try {
      await apiRequest(`/projects/${projectId}/members?username=${encodeURIComponent(username)}`, { method: "POST" });
      setShareOpen(false); setShareUsername(""); setShareProjectId("");
    } catch (err) { handleError(err); } finally { setSharing(false); }
  }

  if (loading) return <p style={{ padding: 40 }}>Loading projects...</p>;
  const ownedProjects = projects.filter((project) => project.owner_id === currentUser?.id);
  return <div className="app-layout"><aside className="sidebar"><h2 className="logo">CodeCollab</h2><nav className="nav"><span className="nav-item active">Projects</span></nav><button onClick={signOut}>Log out</button></aside>
    <main className="main-content"><div className={styles.page}><header><h1 className={styles.title}>My Projects</h1><p>Create, manage, and share your work</p></header>
      {error && <p className="notice-error" role="alert">{error}</p>}
      <section className={styles.actions}><input className={styles.input} aria-label="New project name" placeholder="New project name" value={newProject} onChange={(e) => setNewProject(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void createProject(); }} disabled={creating} /><button className={styles.primaryBtn} onClick={() => void createProject()} disabled={creating}>{creating ? "Creating..." : "+ Create"}</button><button className={styles.secondaryBtn} onClick={() => setShareOpen(true)} disabled={!ownedProjects.length}>Share</button></section>
      {!projects.length ? <p>No projects yet.</p> : <ul className={styles.grid}>{projects.map((project) => <li key={project.id} className={styles.card}>
        <div className={styles.cardMain}>{renameId === project.id ? <input aria-label="Project name" className={styles.input} value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void renameProject(project.id); if (e.key === "Escape") setRenameId(null); }} autoFocus /> : <Link href={`/projects/${project.id}/files`}><h3>{project.name}</h3><span className={styles.meta}>Project #{project.id}{project.owner_id === currentUser?.id ? " · Owner" : " · Shared"}</span></Link>}</div>
        {project.owner_id === currentUser?.id && <div className={styles.cardActions}>{renameId === project.id ? <><button className={styles.iconBtn} onClick={() => void renameProject(project.id)} disabled={savingRename}>Save</button><button className={styles.iconBtn} onClick={() => setRenameId(null)} disabled={savingRename}>Cancel</button></> : <button className={styles.iconBtn} onClick={() => { setRenameId(project.id); setRenameValue(project.name); }}>Rename</button>}<button className={styles.dangerBtn} onClick={() => void deleteProject(project.id)}>Delete</button></div>}
      </li>)}</ul>}
      {shareOpen && <div className={styles.modalBackdrop}><div className={styles.modal}><h3>Share Project</h3><select value={shareProjectId} onChange={(e) => setShareProjectId(e.target.value)}><option value="">Choose a project</option>{ownedProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><input aria-label="Username to add" placeholder="Username" value={shareUsername} onChange={(e) => setShareUsername(e.target.value)} /><div className={styles.modalActions}><button onClick={() => setShareOpen(false)} disabled={sharing}>Cancel</button><button onClick={() => void shareProject()} disabled={sharing}>{sharing ? "Sharing..." : "Share"}</button></div></div></div>}
    </div></main></div>;
}
