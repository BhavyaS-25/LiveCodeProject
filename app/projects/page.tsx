"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./projects.module.css";
import { useRouter } from "next/navigation";



type Project = {
    id: number;
    name: string;
    owner_id: number;
};

export default function ProjectsPage() {

    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newProject, setNewProject] = useState("");
    const [creating, setCreating] = useState(false);
    const [memberInputs, setMemberInputs] = useState<Record<number, string>>({});
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [shareOpen, setShareOpen] = useState(false);
    const [shareProjectId, setShareProjectId] = useState("");
    const [shareUsername, setShareUsername] = useState("");
    const router = useRouter();


    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/");
        }
    }, [])
    
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = "/login";
            return;
        }
        async function fetchProjects() {
            try {
                const res = await fetch("http://localhost:8000/projects", {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    
                }
            );
                if (!res.ok) {
                    throw new Error("failed to fetch projects.");
                }
                const data = await res.json();
                setProjects(data)
            } catch (err: any) {
                setError(err.message || "Something went wrong")
            } finally {
                setLoading(false)

            }
        }
        fetchProjects();
    }, []);
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;

        fetch("http://localhost:8000/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) => setCurrentUserId(data.id));
        }, []);

    async function addMember(projectId: number, username: string) {
        const token = localStorage.getItem("token");
        if (!token) {
            alert("Not authenticated");
            return;
        }
        const res = await fetch(
            `http://localhost:8000/projects/${projectId}/members?username=${encodeURIComponent(
            username
            )}`,
            {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
            },
            }
        );
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || "Failed to add member");
        }
        return await res.json();
    }
    async function deleteProject(projectId: number) {
        const token = localStorage.getItem("token");
        if (!token) throw new Error("Not authenticated");

        const res = await fetch(`http://localhost:8000/projects/${projectId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Failed to delete project");
            }
     }

    async function createProject() {
        const token = localStorage.getItem("token");
        if(!token) {
            window.location.href = "/login";
            return;
        }
        if (!newProject.trim()) return;
        
        try {
            setCreating(true);
            const res = await fetch("http://localhost:8000/projects", {
                method: "POST",
                headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({name: newProject}),
            });
            if (!res.ok) {
                throw new Error("Failed to create Project")
            }
            const data = await res.json();
            setProjects((prev) => [...prev, data.project]);
            setNewProject("");
        } catch (err: any) {
            setError(err.message || "Could not create Project");
        } finally {
            setCreating(false);
        }
    }
    async function shareProject() {
        const token = localStorage.getItem("token");
        if (!token) return;

        if (!shareProjectId || !shareUsername.trim()) {
            alert("Please enter both Project ID and Username");
            return;
        }

        const res = await fetch(
            `http://localhost:8000/projects/${Number(
            shareProjectId
            )}/members?username=${encodeURIComponent(shareUsername)}`,
            {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
            },
            }
        );

        if (!res.ok) {
            const err = await res.json();
            alert(err.detail || "Failed to share project");
            return;
        }

        setShareOpen(false);
        setShareUsername("");
        setShareProjectId("");
        alert("Project shared!");
        }

     

    if (loading) {
        return <p style = {{ padding: 40 }}>Loading projects...</p>
    }
    if (error) {
        return (
            <div style = {{padding: 40}}>
                <p style = {{color: "red"}}>{error}</p>
                <button onClick={() => (window.location.href = "/login")}>
                    Back to Login Page
                </button>
            </div>
        );
    }
    return (
    <div className="app-layout">
        <aside className="sidebar">
            <h2 className="logo">CodeCollab</h2>

            <nav className="nav">
            <a className="nav-item active">Projects</a>
            <a className="nav-item">Shared</a>
            <a className="nav-item">Settings</a>
            </nav>
        </aside>

        <main className="main-content">
        <div className = {styles.page}> 
            <header> 
                <h1 className = {styles.title}> My Projects </h1>
                <p> Create, manage, and share your work </p> 
            </header> 

            <section className={styles.actions}>
                <input
                    className={styles.input}
                    placeholder="New project name"
                    value={newProject}
                    onChange={(e) => setNewProject(e.target.value)}
                />

                <button
                    className={styles.primaryBtn}
                    onClick={createProject}
                    disabled={creating}
                >
                    {creating ? "Creating..." : "+ Create"}
                </button>

                <button
                    className={styles.secondaryBtn}
                    onClick={() => setShareOpen(true)}
                >
                    Share
                </button>
            </section>

            <section>
            {projects.length === 0 && <p>No projects yet.</p>}

            <ul className={styles.grid}>
                {projects.map((project) => (
                <li key={project.id} className={styles.card}>
                    <Link
                    href={`/projects/${project.id}/files`}
                    className={styles.cardMain}
                    >
                    <h3>{project.name}</h3>
                    <span className={styles.meta}>Project #{project.id}</span>
                    </Link>

                    <div className={styles.cardActions}>
                    <button className={styles.iconBtn}>Rename</button>

                    {project.owner_id === currentUserId && (
                        <button
                        className={styles.dangerBtn}
                        onClick={async () => {
                            if (!confirm("Delete this project?")) return;
                            await deleteProject(project.id);
                            setProjects((prev) =>
                            prev.filter((p) => p.id !== project.id)
                            );
                        }}
                        >
                        Delete
                        </button>
                    )}
                    </div>
                </li>
                ))}
            </ul>
            </section>

            {shareOpen && (
                <div className={styles.modalBackdrop}>
                    <div className={styles.modal}>
                    <h3>Share Project</h3>

                    <input
                        placeholder="Project ID"
                        value={shareProjectId}
                        onChange={(e) => setShareProjectId(e.target.value)}
                    />

                    <input
                        placeholder="Username"
                        value={shareUsername}
                        onChange={(e) => setShareUsername(e.target.value)}
                    />

                    <div className={styles.modalActions}>
                        <button onClick={() => setShareOpen(false)}>Cancel</button>
                        <button onClick={shareProject}>Share
                        </button>
                        </div>
                    </div>
                </div>
                )}
            </div>
        </main>
    </div>
    )
}